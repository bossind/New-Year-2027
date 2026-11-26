import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from './index.ts';
import {
  analyticsEvents,
  dailyAnalytics,
  nameAnalytics,
  visitorSessions,
} from './schema.ts';

// Helper to get current IST date (YYYY-MM-DD), month (YYYY-MM), and hour (0..23)
export function getISTDateParts(d: Date = new Date()): {
  date: string;
  month: string;
  hour: number;
} {
  // IST is UTC + 5:30 (330 minutes)
  const istTime = new Date(d.getTime() + 330 * 60 * 1000);
  const year = istTime.getUTCFullYear();
  const monthNum = String(istTime.getUTCMonth() + 1).padStart(2, '0');
  const dayNum = String(istTime.getUTCDate()).padStart(2, '0');
  const hour = istTime.getUTCHours();

  return {
    date: `${year}-${monthNum}-${dayNum}`,
    month: `${year}-${monthNum}`,
    hour,
  };
}

export function subtractDaysIST(baseDateStr: string, days: number): string {
  const [y, m, d] = baseDateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export type DateFilterPreset =
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | 'month'
  | 'all'
  | 'custom';

export function resolveDateRange(
  preset: DateFilterPreset,
  customStart?: string,
  customEnd?: string
): { startDate: string; endDate: string } {
  const { date: today, month: thisMonth } = getISTDateParts();
  switch (preset) {
    case 'today':
      return { startDate: today, endDate: today };
    case 'yesterday': {
      const yest = subtractDaysIST(today, 1);
      return { startDate: yest, endDate: yest };
    }
    case '7d':
      return { startDate: subtractDaysIST(today, 6), endDate: today };
    case '30d':
      return { startDate: subtractDaysIST(today, 29), endDate: today };
    case 'month':
      return { startDate: `${thisMonth}-01`, endDate: today };
    case 'custom': {
      const s =
        customStart && /^\d{4}-\d{2}-\d{2}$/.test(customStart)
          ? customStart
          : subtractDaysIST(today, 6);
      const e =
        customEnd && /^\d{4}-\d{2}-\d{2}$/.test(customEnd) ? customEnd : today;
      return s <= e ? { startDate: s, endDate: e } : { startDate: e, endDate: s };
    }
    case 'all':
    default:
      return { startDate: '2020-01-01', endDate: '2099-12-31' };
  }
}

export function isAutomatedBotUserAgent(ua: string | undefined): boolean {
  if (!ua) return false;
  return /bot|crawl|spider|slurp|lighthouse|headless|pingdom|uptimerobot|gtmetrix|facebookexternalhit|whatsapp\/[0-9].*preview/i.test(
    ua
  );
}

export function classifyTrafficSource(
  referrer?: string,
  utmSource?: string
): 'direct' | 'google' | 'whatsapp' | 'telegram' | 'facebook' | 'other' {
  const src = `${utmSource || ''} ${referrer || ''}`.toLowerCase();
  if (!src.trim()) return 'direct';
  if (src.includes('whatsapp') || src.includes('wa.me')) return 'whatsapp';
  if (src.includes('telegram') || src.includes('t.me') || src.includes('tg:'))
    return 'telegram';
  if (src.includes('facebook') || src.includes('fb.com') || src.includes('m.facebook'))
    return 'facebook';
  if (src.includes('google.')) return 'google';
  if (referrer && referrer.trim().length > 0) return 'other';
  return 'direct';
}

export function normalizeWishName(rawName: string): {
  normalizedName: string;
  displayName: string;
} {
  const cleaned = String(rawName || '')
    .replace(/[\u0000-\u001f<>"'`\\{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);

  if (!cleaned) {
    return { normalizedName: '', displayName: '' };
  }

  const normalizedName = cleaned.toLowerCase();
  // Title-case Latin words while preserving Indian script characters intact
  const displayName = cleaned
    .split(' ')
    .map((word) => {
      if (/^[a-zA-Z]+$/.test(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word;
    })
    .join(' ');

  return { normalizedName, displayName };
}

async function ensureDailyAnalyticsRow(dateStr: string) {
  const existing = await db
    .select()
    .from(dailyAnalytics)
    .where(eq(dailyAnalytics.date, dateStr));
  if (existing.length > 0) {
    return existing[0];
  }
  const inserted = await db
    .insert(dailyAnalytics)
    .values({
      date: dateStr,
      totalVisits: 0,
      uniqueVisitors: 0,
      newVisitors: 0,
      returningVisitors: 0,
      wishesCreated: 0,
      shareClicks: 0,
    })
    .onConflictDoNothing()
    .returning();

  if (inserted.length > 0) return inserted[0];
  const retry = await db
    .select()
    .from(dailyAnalytics)
    .where(eq(dailyAnalytics.date, dateStr));
  return retry[0];
}

export async function recordVisitorHeartbeat(params: {
  visitorId: string;
  userAgent?: string;
}) {
  try {
    if (isAutomatedBotUserAgent(params.userAgent)) {
      return { ignored: true };
    }
    const cleanVisitorId = String(params.visitorId || '')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 64);
    if (!cleanVisitorId) return { ignored: true };

    const { date } = getISTDateParts();
    const existing = await db
      .select()
      .from(visitorSessions)
      .where(eq(visitorSessions.visitorId, cleanVisitorId));

    if (existing.length > 0) {
      await db
        .update(visitorSessions)
        .set({
          lastActiveAt: new Date(),
          lastSeenDate: date,
        })
        .where(eq(visitorSessions.visitorId, cleanVisitorId));
    }
    return { ok: true };
  } catch (error) {
    console.error('Database query failed in recordVisitorHeartbeat:', error);
    throw new Error('Failed to record heartbeat.', { cause: error });
  }
}

export async function recordAnalyticsEvent(params: {
  eventId: string;
  eventType: 'page_visit' | 'wish_created' | 'share_click' | 'gift_opened';
  visitorId: string;
  lang?: string;
  animId?: string;
  msgId?: number;
  name?: string;
  sharePlatform?: string;
  referrer?: string;
  utmSource?: string;
  isNewSession?: boolean;
  userAgent?: string;
}): Promise<{
  recorded: boolean;
  duplicate?: boolean;
  isFirstUniqueVisitor?: boolean;
  trafficSource: string;
}> {
  try {
    const trafficSource = classifyTrafficSource(params.referrer, params.utmSource);
    if (isAutomatedBotUserAgent(params.userAgent)) {
      return { recorded: false, trafficSource };
    }

    const cleanEventId = String(params.eventId || '')
      .replace(/[^a-zA-Z0-9_:-]/g, '')
      .slice(0, 80);
    const cleanVisitorId = String(params.visitorId || '')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 64);

    if (!cleanEventId || !cleanVisitorId) {
      return { recorded: false, trafficSource };
    }

    // 1. Check idempotency key to prevent duplicate events
    const existingEvent = await db
      .select()
      .from(analyticsEvents)
      .where(eq(analyticsEvents.eventId, cleanEventId));

    if (existingEvent.length > 0) {
      return { recorded: false, duplicate: true, trafficSource };
    }

    const { date, month, hour } = getISTDateParts();

    // 2. Insert analytics event
    await db
      .insert(analyticsEvents)
      .values({
        eventId: cleanEventId,
        eventType: params.eventType,
        visitorId: cleanVisitorId,
        eventDate: date,
        eventHour: hour,
        eventMonth: month,
        lang: params.lang ? String(params.lang).slice(0, 16) : null,
        animId: params.animId ? String(params.animId).slice(0, 24) : null,
        msgId:
          typeof params.msgId === 'number' && !isNaN(params.msgId)
            ? params.msgId
            : null,
        sharePlatform: params.sharePlatform
          ? String(params.sharePlatform).slice(0, 24)
          : null,
        trafficSource,
      })
      .onConflictDoNothing();

    // 3. Upsert visitor session and compute unique/returning flags for today
    const existingVisitorRows = await db
      .select()
      .from(visitorSessions)
      .where(eq(visitorSessions.visitorId, cleanVisitorId));

    let isFirstUniqueVisitorEver = false;
    let isFirstVisitTodayForVisitor = false;
    let isReturningVisitor = false;

    if (existingVisitorRows.length === 0) {
      isFirstUniqueVisitorEver = true;
      isFirstVisitTodayForVisitor = true;
      isReturningVisitor = false;

      await db
        .insert(visitorSessions)
        .values({
          visitorId: cleanVisitorId,
          sessionCount: 1,
          isReturning: false,
          firstSeenDate: date,
          lastSeenDate: date,
          lastActiveAt: new Date(),
          trafficSource,
          initialLang: params.lang ? String(params.lang).slice(0, 16) : 'hi',
        })
        .onConflictDoNothing();
    } else {
      const v = existingVisitorRows[0];
      isFirstVisitTodayForVisitor = v.lastSeenDate !== date;
      const newSessionCount =
        params.isNewSession || isFirstVisitTodayForVisitor
          ? v.sessionCount + 1
          : v.sessionCount;
      isReturningVisitor = v.firstSeenDate !== date || newSessionCount > 1;

      await db
        .update(visitorSessions)
        .set({
          sessionCount: newSessionCount,
          isReturning: isReturningVisitor,
          lastSeenDate: date,
          lastActiveAt: new Date(),
        })
        .where(eq(visitorSessions.visitorId, cleanVisitorId));
    }

    // 4. Update daily_analytics rollup
    const dailyRow = await ensureDailyAnalyticsRow(date);
    if (dailyRow) {
      const nextTotalVisits =
        params.eventType === 'page_visit'
          ? dailyRow.totalVisits + 1
          : dailyRow.totalVisits;
      const nextUnique =
        params.eventType === 'page_visit' && isFirstVisitTodayForVisitor
          ? dailyRow.uniqueVisitors + 1
          : dailyRow.uniqueVisitors;
      const nextNew =
        params.eventType === 'page_visit' && isFirstUniqueVisitorEver
          ? dailyRow.newVisitors + 1
          : dailyRow.newVisitors;
      const nextReturning =
        params.eventType === 'page_visit' &&
        isFirstVisitTodayForVisitor &&
        !isFirstUniqueVisitorEver
          ? dailyRow.returningVisitors + 1
          : dailyRow.returningVisitors;
      const nextWishes =
        params.eventType === 'wish_created'
          ? dailyRow.wishesCreated + 1
          : dailyRow.wishesCreated;
      const nextShares =
        params.eventType === 'share_click'
          ? dailyRow.shareClicks + 1
          : dailyRow.shareClicks;

      await db
        .update(dailyAnalytics)
        .set({
          totalVisits: nextTotalVisits,
          uniqueVisitors: nextUnique,
          newVisitors: nextNew,
          returningVisitors: nextReturning,
          wishesCreated: nextWishes,
          shareClicks: nextShares,
          updatedAt: new Date(),
        })
        .where(eq(dailyAnalytics.id, dailyRow.id));
    }

    // 5. If wish_created with a name, aggregate into name_analytics
    if (params.eventType === 'wish_created' && params.name) {
      const { normalizedName, displayName } = normalizeWishName(params.name);
      if (normalizedName && displayName) {
        const normalizedKey = `${normalizedName}|${date}`;
        const existingNameRows = await db
          .select()
          .from(nameAnalytics)
          .where(eq(nameAnalytics.normalizedKey, normalizedKey));

        if (existingNameRows.length === 0) {
          await db
            .insert(nameAnalytics)
            .values({
              normalizedKey,
              normalizedName,
              displayName,
              date,
              wishesCount: 1,
              lastLanguage: params.lang || 'hi',
              lastAnimation: params.animId || 'sparkler',
            })
            .onConflictDoNothing();
        } else {
          const nr = existingNameRows[0];
          await db
            .update(nameAnalytics)
            .set({
              wishesCount: nr.wishesCount + 1,
              lastLanguage: params.lang || nr.lastLanguage,
              lastAnimation: params.animId || nr.lastAnimation,
              updatedAt: new Date(),
            })
            .where(eq(nameAnalytics.id, nr.id));
        }
      }
    }

    return {
      recorded: true,
      isFirstUniqueVisitor: isFirstUniqueVisitorEver,
      trafficSource,
    };
  } catch (error) {
    console.error('Database query failed in recordAnalyticsEvent:', error);
    throw new Error('Failed to record analytics event.', { cause: error });
  }
}

export async function getDashboardAnalytics(params: {
  preset: DateFilterPreset;
  customStart?: string;
  customEnd?: string;
  searchName?: string;
  filterLang?: string;
  filterAnim?: string;
}) {
  try {
    const { startDate, endDate } = resolveDateRange(
      params.preset,
      params.customStart,
      params.customEnd
    );
    const { date: todayDate } = getISTDateParts();

    // 1. Live active visitors (active in the last 2 minutes)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const liveVisitorRows = await db
      .select()
      .from(visitorSessions)
      .where(gte(visitorSessions.lastActiveAt, twoMinutesAgo));
    const liveVisitorsCount = liveVisitorRows.length;

    // 2. All visitor sessions for unique/new/returning calculation
    const allVisitors = await db.select().from(visitorSessions);
    const filteredVisitors = allVisitors.filter(
      (v) => v.lastSeenDate >= startDate && v.lastSeenDate <= endDate
    );
    const uniqueVisitorsInPeriod = filteredVisitors.length;
    const returningVisitorsInPeriod = filteredVisitors.filter(
      (v) => v.isReturning
    ).length;
    const newVisitorsInPeriod =
      uniqueVisitorsInPeriod - returningVisitorsInPeriod;

    // 3. Daily analytics rows
    const allDailyRows = await db
      .select()
      .from(dailyAnalytics)
      .orderBy(dailyAnalytics.date);

    const todayRow = allDailyRows.find((r) => r.date === todayDate) || {
      totalVisits: 0,
      uniqueVisitors: 0,
      newVisitors: 0,
      returningVisitors: 0,
      wishesCreated: 0,
      shareClicks: 0,
    };

    // 4. Fetch events in range for granular breakdowns (language, animation, greeting, shares, hourly, traffic sources)
    const eventsInRange = await db
      .select()
      .from(analyticsEvents)
      .where(
        and(
          gte(analyticsEvents.eventDate, startDate),
          lte(analyticsEvents.eventDate, endDate)
        )
      );

    // Apply optional language / animation filters to events
    const matchingEvents = eventsInRange.filter((ev) => {
      if (params.filterLang && params.filterLang !== 'all') {
        if (ev.lang !== params.filterLang) return false;
      }
      if (params.filterAnim && params.filterAnim !== 'all') {
        if (ev.animId !== params.filterAnim) return false;
      }
      return true;
    });

    const visitEvents = matchingEvents.filter((e) => e.eventType === 'page_visit');
    const wishEvents = matchingEvents.filter((e) => e.eventType === 'wish_created');
    const shareEvents = matchingEvents.filter((e) => e.eventType === 'share_click');

    const totalWebsiteVisits = visitEvents.length;
    const totalWishesCreated = wishEvents.length;
    const totalShareClicks = shareEvents.length;

    // 5. Daily trend graph
    const dailyMap = new Map<
      string,
      { date: string; visits: number; uniqueVisitors: number; wishes: number; shares: number }
    >();
    for (const r of allDailyRows) {
      if (r.date >= startDate && r.date <= endDate) {
        dailyMap.set(r.date, {
          date: r.date,
          visits: r.totalVisits,
          uniqueVisitors: r.uniqueVisitors,
          wishes: r.wishesCreated,
          shares: r.shareClicks,
        });
      }
    }
    if (dailyMap.size === 0) {
      dailyMap.set(todayDate, {
        date: todayDate,
        visits: todayRow.totalVisits,
        uniqueVisitors: todayRow.uniqueVisitors,
        wishes: todayRow.wishesCreated,
        shares: todayRow.shareClicks,
      });
    }
    const dailyGraph = Array.from(dailyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // 6. Hourly traffic graph (00:00 to 23:00 IST)
    const hourlyCounts = Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, '0')}:00`,
      visits: 0,
      wishes: 0,
      shares: 0,
    }));
    for (const ev of matchingEvents) {
      const h = ev.eventHour >= 0 && ev.eventHour < 24 ? ev.eventHour : 0;
      if (ev.eventType === 'page_visit') hourlyCounts[h].visits += 1;
      if (ev.eventType === 'wish_created') hourlyCounts[h].wishes += 1;
      if (ev.eventType === 'share_click') hourlyCounts[h].shares += 1;
    }

    // 7. Monthly traffic graph
    const monthlyMap = new Map<
      string,
      { month: string; visits: number; wishes: number; shares: number }
    >();
    for (const ev of matchingEvents) {
      const m = ev.eventMonth || todayDate.slice(0, 7);
      const cur = monthlyMap.get(m) || {
        month: m,
        visits: 0,
        wishes: 0,
        shares: 0,
      };
      if (ev.eventType === 'page_visit') cur.visits += 1;
      if (ev.eventType === 'wish_created') cur.wishes += 1;
      if (ev.eventType === 'share_click') cur.shares += 1;
      monthlyMap.set(m, cur);
    }
    if (monthlyMap.size === 0) {
      const m = todayDate.slice(0, 7);
      monthlyMap.set(m, { month: m, visits: 0, wishes: 0, shares: 0 });
    }
    const monthlyGraph = Array.from(monthlyMap.values()).sort((a, b) =>
      a.month.localeCompare(b.month)
    );

    // 8. Language Analytics (including the 6 core highlighted languages + any regional languages)
    const langCounter = new Map<string, { visits: number; wishes: number }>();
    const coreLangs = ['hi', 'en', 'bn', 'mr', 'hinglish', 'ur'];
    for (const code of coreLangs) {
      langCounter.set(code, { visits: 0, wishes: 0 });
    }
    for (const ev of matchingEvents) {
      if (!ev.lang) continue;
      const cur = langCounter.get(ev.lang) || { visits: 0, wishes: 0 };
      if (ev.eventType === 'page_visit') cur.visits += 1;
      if (ev.eventType === 'wish_created') cur.wishes += 1;
      langCounter.set(ev.lang, cur);
    }
    const totalLangActivity =
      Array.from(langCounter.values()).reduce(
        (acc, v) => acc + v.visits + v.wishes,
        0
      ) || 1;
    const languageAnalytics = Array.from(langCounter.entries())
      .map(([code, counts]) => {
        const combined = counts.visits + counts.wishes;
        return {
          code,
          visits: counts.visits,
          wishes: counts.wishes,
          total: combined,
          percentage:
            Array.from(langCounter.values()).reduce(
              (acc, v) => acc + v.visits + v.wishes,
              0
            ) === 0
              ? 0
              : Math.round((combined / totalLangActivity) * 1000) / 10,
        };
      })
      .sort((a, b) => b.wishes - a.wishes || b.visits - a.visits);

    // 9. Animation Analytics (All 9 animations)
    const allAnimIds = [
      'sparkler',
      'fireworks',
      'galaxy',
      'countdown',
      'lanterns',
      'gold',
      'neon',
      'gift',
      'aurora',
    ];
    const animCounter = new Map<string, number>();
    for (const id of allAnimIds) animCounter.set(id, 0);
    for (const ev of wishEvents) {
      if (ev.animId) {
        animCounter.set(ev.animId, (animCounter.get(ev.animId) || 0) + 1);
      }
    }
    const totalAnimSelections =
      Array.from(animCounter.values()).reduce((a, b) => a + b, 0) || 1;
    const animationAnalytics = Array.from(animCounter.entries())
      .map(([animId, count]) => ({
        animId,
        count,
        percentage:
          wishEvents.length === 0
            ? 0
            : Math.round((count / totalAnimSelections) * 1000) / 10,
      }))
      .sort((a, b) => b.count - a.count)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    // 10. Greeting Message Category Analytics
    const msgCounter = new Map<number, number>();
    for (const ev of wishEvents) {
      if (typeof ev.msgId === 'number') {
        msgCounter.set(ev.msgId, (msgCounter.get(ev.msgId) || 0) + 1);
      }
    }
    const greetingAnalytics = Array.from(msgCounter.entries())
      .map(([msgId, count]) => ({
        msgId,
        count,
        percentage:
          wishEvents.length === 0
            ? 0
            : Math.round((count / (wishEvents.length || 1)) * 1000) / 10,
      }))
      .sort((a, b) => b.count - a.count);

    // 11. Share Click Analytics (Explicitly labeled as Share Clicks, not confirmed deliveries)
    const sharePlatforms = [
      'whatsapp',
      'telegram',
      'facebook',
      'x',
      'native',
      'copy_link',
    ];
    const shareCounter = new Map<string, number>();
    for (const p of sharePlatforms) shareCounter.set(p, 0);
    for (const ev of shareEvents) {
      const p = ev.sharePlatform || 'other';
      shareCounter.set(p, (shareCounter.get(p) || 0) + 1);
    }
    const sharingAnalytics = Array.from(shareCounter.entries())
      .map(([platform, clicks]) => ({
        platform,
        clicks,
        percentage:
          shareEvents.length === 0
            ? 0
            : Math.round((clicks / (shareEvents.length || 1)) * 1000) / 10,
      }))
      .sort((a, b) => b.clicks - a.clicks);

    // 12. Traffic Sources Analytics
    const sourceKeys = [
      'direct',
      'google',
      'whatsapp',
      'telegram',
      'facebook',
      'other',
    ];
    const sourceCounter = new Map<string, number>();
    for (const k of sourceKeys) sourceCounter.set(k, 0);
    for (const ev of visitEvents) {
      const s = ev.trafficSource || 'direct';
      sourceCounter.set(s, (sourceCounter.get(s) || 0) + 1);
    }
    const trafficSources = Array.from(sourceCounter.entries())
      .map(([source, visits]) => ({
        source,
        visits,
        percentage:
          visitEvents.length === 0
            ? 0
            : Math.round((visits / (visitEvents.length || 1)) * 1000) / 10,
      }))
      .sort((a, b) => b.visits - a.visits);

    // 13. Name Analytics (Aggregated by normalizedName within date range, searchable and sortable)
    const nameRowsInRange = await db
      .select()
      .from(nameAnalytics)
      .where(
        and(
          gte(nameAnalytics.date, startDate),
          lte(nameAnalytics.date, endDate)
        )
      )
      .orderBy(desc(nameAnalytics.wishesCount));

    const aggregatedNamesMap = new Map<
      string,
      {
        normalizedName: string;
        displayName: string;
        wishesCount: number;
        lastLanguage: string;
        lastAnimation: string;
        lastDate: string;
      }
    >();

    for (const row of nameRowsInRange) {
      if (
        params.filterLang &&
        params.filterLang !== 'all' &&
        row.lastLanguage !== params.filterLang
      ) {
        continue;
      }
      if (
        params.filterAnim &&
        params.filterAnim !== 'all' &&
        row.lastAnimation !== params.filterAnim
      ) {
        continue;
      }
      const existing = aggregatedNamesMap.get(row.normalizedName);
      if (!existing) {
        aggregatedNamesMap.set(row.normalizedName, {
          normalizedName: row.normalizedName,
          displayName: row.displayName,
          wishesCount: row.wishesCount,
          lastLanguage: row.lastLanguage || 'hi',
          lastAnimation: row.lastAnimation || 'sparkler',
          lastDate: row.date,
        });
      } else {
        existing.wishesCount += row.wishesCount;
        if (row.date >= existing.lastDate) {
          existing.displayName = row.displayName;
          existing.lastDate = row.date;
          existing.lastLanguage = row.lastLanguage || existing.lastLanguage;
          existing.lastAnimation = row.lastAnimation || existing.lastAnimation;
        }
      }
    }

    let nameAnalyticsList = Array.from(aggregatedNamesMap.values()).sort(
      (a, b) => b.wishesCount - a.wishesCount
    );

    if (params.searchName && params.searchName.trim()) {
      const q = params.searchName.trim().toLowerCase();
      nameAnalyticsList = nameAnalyticsList.filter(
        (n) =>
          n.normalizedName.includes(q) ||
          n.displayName.toLowerCase().includes(q)
      );
    }

    const mostPopularLanguage =
      languageAnalytics.find((l) => l.total > 0)?.code || 'hi';
    const mostPopularAnimation =
      animationAnalytics.find((a) => a.count > 0)?.animId || 'sparkler';
    const mostPopularGreetingId =
      greetingAnalytics.length > 0 ? greetingAnalytics[0].msgId : 1;

    return {
      dateRange: { startDate, endDate, preset: params.preset, todayDate },
      overview: {
        totalWebsiteVisits,
        uniqueVisitors: uniqueVisitorsInPeriod,
        returningVisitors: returningVisitorsInPeriod,
        newVisitors: newVisitorsInPeriod,
        totalWishesCreated,
        totalShareClicks,
        liveVisitors: liveVisitorsCount,
        todayVisitors: todayRow.uniqueVisitors,
        todayVisits: todayRow.totalVisits,
        todayWishesCreated: todayRow.wishesCreated,
        todayShareClicks: todayRow.shareClicks,
        mostPopularLanguage,
        mostPopularAnimation,
        mostPopularGreetingId,
      },
      dailyGraph,
      hourlyGraph: hourlyCounts,
      monthlyGraph,
      languageAnalytics,
      animationAnalytics,
      greetingAnalytics,
      sharingAnalytics,
      trafficSources,
      nameAnalytics: nameAnalyticsList.slice(0, 200),
    };
  } catch (error) {
    console.error('Database query failed in getDashboardAnalytics:', error);
    throw new Error('Failed to load dashboard analytics from database.', {
      cause: error,
    });
  }
}
