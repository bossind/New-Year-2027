import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import {
  DEFAULT_MUSIC_CATALOG,
  extractGoogleDriveFileId,
} from './src/engine/music.ts';
import {
  ADMIN_COOKIE_NAME,
  AuthRequest,
  extractAdminTokenFromRequest,
  requireAdminAuth,
} from './src/middleware/auth.ts';
import {
  changeAdminPassword,
  claimInitialAdminPassword,
  consumeApprovedChallengeAndCreateSession,
  createTelegramLoginChallenge,
  enrollTelegramAdmin,
  getAdminAuthStatus,
  getChallengeById,
  getSecurityAuditLogs,
  hashIp,
  revokeAdminSessionToken,
  verifyAdminCredentials,
  verifyAdminSessionToken,
} from './src/db/security.ts';
import {
  DateFilterPreset,
  getDashboardAnalytics,
  getISTDateParts,
  recordAnalyticsEvent,
  recordVisitorHeartbeat,
} from './src/db/analytics.ts';
import {
  connectTelegramBotWebhook,
  disconnectTelegramBot,
  getAllNotificationSettings,
  getNotificationHistory,
  getTelegramBotStatus,
  handleTelegramUpdate,
  pollTelegramUpdatesForChallenge,
  queueTelegramNotification,
  saveTelegramBotToken,
  sendTelegramLoginChallengeMessage,
  testTelegramConnection,
  triggerScheduledReportNotification,
  updateNotificationSetting,
  verifyTelegramWebhookSecretHeader,
} from './src/db/telegram.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);

// Strict JSON body size limit (6mb for wish photo/bg asset saves, 64kb for other routes)
app.use('/api/wishes', express.json({ limit: '6mb' }));
app.use(express.json({ limit: '64kb' }));

// Security HTTP Headers Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'camera=(self), microphone=(), geolocation=(), payment=()'
  );

  // Restrict CORS on /api/* to configured FRONTEND_ORIGIN or same host
  const allowedOrigin = process.env.FRONTEND_ORIGIN;
  const reqOrigin = req.headers.origin;
  if (allowedOrigin && reqOrigin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-CSRF-Token, X-Requested-With'
    );
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    );
  }
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// Simple In-Memory Rate Limiter per IP Hash
interface RateBucket {
  count: number;
  resetAt: number;
}
const rateBuckets = new Map<string, RateBucket>();

function createRateLimiter(maxRequests: number, windowMs: number, keyPrefix: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ipH = hashIp(req.ip || req.socket.remoteAddress);
    const key = `${keyPrefix}:${ipH}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please wait before trying again.',
      });
    }
    next();
  };
}

const publicAnalyticsLimiter = createRateLimiter(90, 60 * 1000, 'pub_analytics');
const adminLoginLimiter = createRateLimiter(12, 5 * 60 * 1000, 'admin_login');

function emitSecureSessionCookie(res: Response, token: string, maxAgeSec: number) {
  const cookieStr = `${ADMIN_COOKIE_NAME}=${encodeURIComponent(
    token
  )}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; Secure; SameSite=None; Partitioned`;
  res.setHeader('Set-Cookie', cookieStr);
}

function clearSecureSessionCookie(res: Response) {
  const cookieStr = `${ADMIN_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None; Partitioned`;
  res.setHeader('Set-Cookie', cookieStr);
}

// ==================================================
// 1. HEALTH CHECK ENDPOINT
// ==================================================
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const status = await getAdminAuthStatus();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'indian-newyear-wishes-2027',
      authConfigured: status.isPasswordConfigured,
    });
  } catch (error) {
    console.error('Health check error:', error);
    queueTelegramNotification({
      eventKey: 'database_error',
      title: 'Database Connection Error',
      text: '🚨 *DATABASE HEALTH CHECK FAILED*\n\nPostgreSQL connection check failed on `/api/health`.',
    });
    res.status(503).json({ status: 'degraded', error: 'Service check failed' });
  }
});

// ==================================================
// 2. PUBLIC ANALYTICS COLLECTION ENDPOINTS
// ==================================================
app.post(
  '/api/analytics/event',
  publicAnalyticsLimiter,
  async (req: Request, res: Response) => {
    try {
      const {
        eventId,
        eventType,
        visitorId,
        lang,
        animId,
        msgId,
        name,
        sharePlatform,
        referrer,
        utmSource,
        isNewSession,
      } = req.body || {};

      const allowedTypes = [
        'page_visit',
        'wish_created',
        'share_click',
        'gift_opened',
      ];
      if (!eventId || !visitorId || !allowedTypes.includes(eventType)) {
        return res.status(400).json({ error: 'Invalid analytics event payload.' });
      }

      const result = await recordAnalyticsEvent({
        eventId: String(eventId),
        eventType,
        visitorId: String(visitorId),
        lang: lang ? String(lang) : undefined,
        animId: animId ? String(animId) : undefined,
        msgId: typeof msgId === 'number' ? msgId : undefined,
        name: name ? String(name) : undefined,
        sharePlatform: sharePlatform ? String(sharePlatform) : undefined,
        referrer: referrer ? String(referrer) : undefined,
        utmSource: utmSource ? String(utmSource) : undefined,
        isNewSession: Boolean(isNewSession),
        userAgent: req.headers['user-agent'],
      });

      // Dispatch non-blocking Telegram notifications if newly recorded
      if (result.recorded) {
        if (eventType === 'page_visit' && result.isFirstUniqueVisitor) {
          queueTelegramNotification({
            eventKey: 'new_visitor',
            title: 'New Website Visitor',
            text: `👋 *NEW WEBSITE VISITOR*\n\nSource: \`${result.trafficSource}\`\nLanguage: \`${lang || 'hi'}\`\nDate (IST): \`${getISTDateParts().date}\``,
          });
        } else if (eventType === 'wish_created') {
          const cleanDisplay = String(name || 'Friend')
            .replace(/[*_`]/g, '')
            .slice(0, 24);
          queueTelegramNotification({
            eventKey: 'new_wish',
            title: 'New Wish Created',
            text: `🎆 *NEW WISH CREATED*\n\nName: *${cleanDisplay}*\nLanguage: \`${lang || 'hi'}\`\nAnimation: \`${animId || 'sparkler'}\``,
          });
        } else if (eventType === 'share_click') {
          queueTelegramNotification({
            eventKey: 'share_clicked',
            title: 'Share Button Clicked',
            text: `📲 *SHARE BUTTON CLICKED*\n\nPlatform: *${String(sharePlatform || 'whatsapp').toUpperCase()}*\nLanguage: \`${lang || 'hi'}\``,
          });
        }
      }

      res.json({ ok: true, recorded: result.recorded });
    } catch (error) {
      console.error('Analytics event error:', error);
      res.status(500).json({ error: 'Failed to process analytics event.' });
    }
  }
);

app.post(
  '/api/analytics/heartbeat',
  publicAnalyticsLimiter,
  async (req: Request, res: Response) => {
    try {
      const { visitorId } = req.body || {};
      if (!visitorId) {
        return res.status(400).json({ error: 'Missing visitorId' });
      }
      await recordVisitorHeartbeat({
        visitorId: String(visitorId),
        userAgent: req.headers['user-agent'],
      });
      res.json({ ok: true });
    } catch (error) {
      console.error('Heartbeat error:', error);
      res.status(500).json({ error: 'Heartbeat failed.' });
    }
  }
);

// ==================================================
// 3. TELEGRAM WEBHOOK ENDPOINT
// ==================================================
app.post('/api/telegram/webhook', async (req: Request, res: Response) => {
  try {
    const secretHeader = req.headers[
      'x-telegram-bot-api-secret-token'
    ] as string | undefined;
    const valid = await verifyTelegramWebhookSecretHeader(secretHeader);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid webhook secret token.' });
    }

    await handleTelegramUpdate(req.body || {});
    res.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing error' });
  }
});

// ==================================================
// 4. ADMIN AUTHENTICATION & TELEGRAM LOGIN FLOW
// ==================================================
app.get('/api/admin/auth/status', async (req: Request, res: Response) => {
  try {
    const status = await getAdminAuthStatus();
    const { token } = extractAdminTokenFromRequest(req);
    const activeSession = token ? await verifyAdminSessionToken(token) : null;
    const botStatus = await getTelegramBotStatus();

    res.json({
      username: status.username,
      isPasswordConfigured: status.isPasswordConfigured,
      usingEnvHash: status.usingEnvHash,
      hasAuthorizedTelegram: status.hasAuthorizedTelegram,
      authorizedTelegramUsers: status.authorizedTelegramUsers,
      botConfigured: botStatus.configured,
      botUsername: botStatus.botUsername,
      bootstrapSecretRequired: Boolean(
        process.env.ADMIN_BOOTSTRAP_SECRET &&
          process.env.ADMIN_BOOTSTRAP_SECRET.trim()
      ),
      authenticated: Boolean(activeSession),
      session: activeSession
        ? {
            username: activeSession.username,
            csrfToken: activeSession.csrfToken,
            expiresAt: activeSession.expiresAt,
          }
        : null,
    });
  } catch (error) {
    console.error('Failed to get admin auth status:', error);
    res.status(500).json({ error: 'Failed to check authentication status.' });
  }
});

// First-run atomic password claim route (only active when ADMIN_PASSWORD_HASH is unset and no DB hash exists)
app.post(
  '/api/admin/auth/claim-password',
  adminLoginLimiter,
  async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body || {};
      const ipH = hashIp(req.ip || req.socket.remoteAddress);
      await claimInitialAdminPassword(
        String(username || ''),
        String(password || ''),
        ipH
      );
      res.json({
        ok: true,
        message: 'Administrator password hashed with bcrypt and locked.',
      });
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : 'Failed to claim password.';
      res.status(400).json({ error: msg });
    }
  }
);

// First-time Telegram Admin numeric User ID enrollment
app.post(
  '/api/admin/auth/enroll-telegram',
  adminLoginLimiter,
  async (req: Request, res: Response) => {
    try {
      const {
        username,
        password,
        bootstrapSecret,
        telegramUserId,
        telegramUsername,
        firstName,
        botToken,
      } = req.body || {};
      const ipH = hashIp(req.ip || req.socket.remoteAddress);

      // Verify admin username & password first so random visitors cannot enroll
      const credCheck = await verifyAdminCredentials(
        String(username || ''),
        String(password || ''),
        ipH
      );
      if (!credCheck.ok) {
        return res
          .status(401)
          .json({ error: credCheck.error || 'Invalid admin credentials.' });
      }

      // Optionally save bot token during first-time setup if provided
      if (botToken && String(botToken).trim()) {
        await saveTelegramBotToken(String(botToken).trim(), ipH);
      }

      const enrolled = await enrollTelegramAdmin({
        bootstrapSecretInput: String(bootstrapSecret || ''),
        telegramUserId: String(telegramUserId || ''),
        telegramUsername: telegramUsername ? String(telegramUsername) : undefined,
        firstName: firstName ? String(firstName) : undefined,
        ipHash: ipH,
      });

      res.json({
        ok: true,
        enrolled: {
          telegramUserId: enrolled.telegramUserId,
          firstName: enrolled.firstName,
        },
      });
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : 'Failed to enroll Telegram admin.';
      res.status(400).json({ error: msg });
    }
  }
);

// Step 1 of Normal Login: Verify Username & Password -> Create Single-Use 2-Minute Telegram Challenge
app.post(
  '/api/admin/auth/login',
  adminLoginLimiter,
  async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body || {};
      const ipH = hashIp(req.ip || req.socket.remoteAddress);
      const ua = String(req.headers['user-agent'] || 'Unknown browser');

      const verifyRes = await verifyAdminCredentials(
        String(username || ''),
        String(password || ''),
        ipH
      );

      if (!verifyRes.ok || !verifyRes.adminUser) {
        queueTelegramNotification({
          eventKey: verifyRes.suspicious
            ? 'suspicious_login'
            : 'admin_login_failed',
          title: verifyRes.suspicious
            ? 'Suspicious Login Attempt'
            : 'Admin Login Failed',
          text: `🚨 *${verifyRes.suspicious ? 'SUSPICIOUS ADMIN LOGIN ATTEMPT' : 'ADMIN LOGIN FAILED'}*\n\nUsername: \`${String(username || '').slice(0, 32)}\`\nIP Hash: \`${ipH}\`\nReason: ${verifyRes.error}`,
          bypassCooldown: true,
        });
        return res.status(401).json({
          error: verifyRes.error || 'Invalid credentials.',
          locked: Boolean(verifyRes.locked),
        });
      }

      const authStatus = await getAdminAuthStatus();
      const botStatus = await getTelegramBotStatus();

      if (!authStatus.hasAuthorizedTelegram || !botStatus.configured) {
        return res.status(428).json({
          requiresEnrollment: true,
          hasAuthorizedTelegram: authStatus.hasAuthorizedTelegram,
          botConfigured: botStatus.configured,
          error: !botStatus.configured
            ? 'Telegram Bot Token is not configured yet. Please complete First-Time Telegram Bot & Admin Enrollment below.'
            : 'No authorized Telegram Admin numeric user ID is enrolled yet. Complete First-Time Telegram Admin Enrollment below.',
        });
      }

      const challenge = await createTelegramLoginChallenge({
        adminUserId: verifyRes.adminUser.id,
        ipHash: ipH,
        userAgent: ua,
      });

      const tgDispatch = await sendTelegramLoginChallengeMessage({
        challengeId: challenge.challengeId,
        username: verifyRes.adminUser.username,
        ipHash: ipH,
        userAgent: ua,
        expiresAt: challenge.expiresAt,
      });

      if (!tgDispatch.sent) {
        return res.status(502).json({
          error:
            tgDispatch.reason ||
            'Failed to send Telegram verification request to your bot.',
        });
      }

      res.json({
        ok: true,
        challengeRequired: true,
        challengeId: challenge.challengeId,
        expiresAt: challenge.expiresAt,
        botUsername: botStatus.botUsername,
      });
    } catch (error) {
      console.error('Login error:', error);
      queueTelegramNotification({
        eventKey: 'backend_error',
        title: 'Backend Server Error',
        text: '🚨 *BACKEND ERROR*\n\nException in `/api/admin/auth/login`.',
      });
      res.status(500).json({ error: 'Authentication service failed.' });
    }
  }
);

// Step 2 of Normal Login: Poll challenge approval & issue secure session once approved via Telegram
app.post(
  '/api/admin/auth/verify-challenge',
  adminLoginLimiter,
  async (req: Request, res: Response) => {
    try {
      const { challengeId } = req.body || {};
      if (!challengeId) {
        return res.status(400).json({ error: 'Missing challengeId.' });
      }

      // Poll Telegram getUpdates if running in preview/polling mode without HTTPS webhook
      await pollTelegramUpdatesForChallenge();

      const challenge = await getChallengeById(String(challengeId));
      if (!challenge) {
        return res.status(404).json({ error: 'Login challenge not found.' });
      }

      if (new Date() > challenge.expiresAt && challenge.status === 'pending') {
        return res.json({
          status: 'expired',
          error: 'Login challenge expired (2-minute limit). Please log in again.',
        });
      }

      if (challenge.status === 'pending') {
        return res.json({
          status: 'pending',
          expiresAt: challenge.expiresAt,
        });
      }

      if (challenge.status === 'rejected') {
        return res.status(403).json({
          status: 'rejected',
          error: 'Login request was rejected from Telegram.',
        });
      }

      if (challenge.status === 'consumed') {
        return res.status(400).json({
          status: 'consumed',
          error: 'This single-use login challenge has already been used.',
        });
      }

      if (challenge.status === 'approved') {
        const ipH = hashIp(req.ip || req.socket.remoteAddress);
        const ua = String(req.headers['user-agent'] || 'Unknown browser');

        const session = await consumeApprovedChallengeAndCreateSession({
          challengeId: challenge.challengeId,
          ipHash: ipH,
          userAgent: ua,
        });

        emitSecureSessionCookie(res, session.rawSessionToken, 12 * 3600);

        queueTelegramNotification({
          eventKey: 'admin_login_success',
          title: 'Admin Login Successful',
          text: `✅ *ADMIN LOGIN SUCCESSFUL*\n\nUsername: \`Roynorules\`\nApproved By Telegram ID: \`${challenge.approvedByTelegramId}\`\nIP Hash: \`${ipH}\``,
          bypassCooldown: true,
        });

        return res.json({
          status: 'approved',
          authenticated: true,
          sessionToken: session.rawSessionToken,
          csrfToken: session.csrfToken,
          expiresAt: session.expiresAt,
        });
      }

      res.json({ status: challenge.status });
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : 'Failed to verify login challenge.';
      res.status(400).json({ error: msg });
    }
  }
);

app.post(
  '/api/admin/auth/logout',
  requireAdminAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const ipH = hashIp(req.ip || req.socket.remoteAddress);
      if (req.adminSession?.rawToken) {
        await revokeAdminSessionToken(req.adminSession.rawToken, ipH);
      }
      clearSecureSessionCookie(res);
      res.json({ ok: true });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Failed to log out.' });
    }
  }
);

app.post(
  '/api/admin/auth/change-password',
  requireAdminAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body || {};
      const ipH = hashIp(req.ip || req.socket.remoteAddress);
      if (!req.adminSession) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      await changeAdminPassword({
        adminUserId: req.adminSession.adminUserId,
        currentPassword: String(currentPassword || ''),
        newPassword: String(newPassword || ''),
        ipHash: ipH,
      });
      res.json({ ok: true, message: 'Administrator password updated.' });
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : 'Failed to change password.';
      res.status(400).json({ error: msg });
    }
  }
);

// ==================================================
// 5. PROTECTED ADMIN DASHBOARD & ANALYTICS ENDPOINTS
// ==================================================
app.get(
  '/api/admin/analytics',
  requireAdminAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const preset = (req.query.preset as DateFilterPreset) || '30d';
      const customStart = req.query.startDate as string | undefined;
      const customEnd = req.query.endDate as string | undefined;
      const searchName = req.query.searchName as string | undefined;
      const filterLang = req.query.filterLang as string | undefined;
      const filterAnim = req.query.filterAnim as string | undefined;

      const data = await getDashboardAnalytics({
        preset,
        customStart,
        customEnd,
        searchName,
        filterLang,
        filterAnim,
      });

      res.json(data);
    } catch (error) {
      console.error('Admin analytics error:', error);
      res.status(500).json({ error: 'Failed to load dashboard analytics.' });
    }
  }
);

app.get(
  '/api/admin/analytics/export-csv',
  requireAdminAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const preset = (req.query.preset as DateFilterPreset) || 'all';
      const customStart = req.query.startDate as string | undefined;
      const customEnd = req.query.endDate as string | undefined;

      const data = await getDashboardAnalytics({
        preset,
        customStart,
        customEnd,
      });

      const lines: string[] = [];
      const escCsv = (val: string | number) => {
        const s = String(val ?? '');
        if (/[",\n\r]/.test(s)) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      lines.push('SECTION,METRIC / KEY,VALUE / COUNT,EXTRA');
      lines.push(
        `OVERVIEW,Total Website Visits,${data.overview.totalWebsiteVisits},Range ${data.dateRange.startDate} to ${data.dateRange.endDate}`
      );
      lines.push(`OVERVIEW,Unique Visitors,${data.overview.uniqueVisitors},`);
      lines.push(`OVERVIEW,Returning Visitors,${data.overview.returningVisitors},`);
      lines.push(`OVERVIEW,New Visitors,${data.overview.newVisitors},`);
      lines.push(`OVERVIEW,Total Wishes Created,${data.overview.totalWishesCreated},`);
      lines.push(`OVERVIEW,Total Share Clicks,${data.overview.totalShareClicks},`);
      lines.push(`OVERVIEW,Live Active Visitors,${data.overview.liveVisitors},`);
      lines.push(`OVERVIEW,Today Visitors,${data.overview.todayVisitors},`);
      lines.push(`OVERVIEW,Today Wishes Created,${data.overview.todayWishesCreated},`);
      lines.push(`OVERVIEW,Today Share Clicks,${data.overview.todayShareClicks},`);

      for (const d of data.dailyGraph) {
        lines.push(
          `DAILY_TRAFFIC,${escCsv(d.date)},${d.visits},Unique:${d.uniqueVisitors} | Wishes:${d.wishes} | Shares:${d.shares}`
        );
      }

      for (const n of data.nameAnalytics) {
        lines.push(
          `NAME_ANALYTICS,${escCsv(n.displayName)},${n.wishesCount},Lang:${n.lastLanguage} | Anim:${n.lastAnimation}`
        );
      }

      for (const l of data.languageAnalytics) {
        lines.push(
          `LANGUAGE_ANALYTICS,${escCsv(l.code)},${l.wishes},Visits:${l.visits} (${l.percentage}%)`
        );
      }

      for (const a of data.animationAnalytics) {
        lines.push(
          `ANIMATION_ANALYTICS,${escCsv(a.animId)},${a.count},Rank #${a.rank} (${a.percentage}%)`
        );
      }

      for (const s of data.sharingAnalytics) {
        lines.push(
          `SHARE_CLICKS,${escCsv(s.platform)},${s.clicks},${s.percentage}%`
        );
      }

      const csvContent = lines.join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="indian-newyear-2027-analytics-${data.dateRange.todayDate}.csv"`
      );
      res.send(csvContent);
    } catch (error) {
      console.error('CSV export error:', error);
      res.status(500).json({ error: 'Failed to export CSV.' });
    }
  }
);

// ==================================================
// 6. PROTECTED TELEGRAM BOT & NOTIFICATION SETTINGS
// ==================================================
app.get(
  '/api/admin/telegram/status',
  requireAdminAuth,
  async (_req: AuthRequest, res: Response) => {
    try {
      const botStatus = await getTelegramBotStatus();
      const settings = await getAllNotificationSettings();
      const history = await getNotificationHistory(50);

      res.json({
        bot: botStatus,
        settings,
        history,
      });
    } catch (error) {
      console.error('Telegram status error:', error);
      res.status(500).json({ error: 'Failed to load Telegram settings.' });
    }
  }
);

app.post(
  '/api/admin/telegram/save-token',
  requireAdminAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { botToken } = req.body || {};
      const ipH = hashIp(req.ip || req.socket.remoteAddress);
      const saved = await saveTelegramBotToken(String(botToken || ''), ipH);
      res.json({
        ok: true,
        message: 'Save Successful! Bot token validated with getMe and encrypted.',
        bot: saved,
      });
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : 'Failed to save Bot Token.';
      res.status(400).json({ error: msg });
    }
  }
);

app.post(
  '/api/admin/telegram/connect',
  requireAdminAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const ipH = hashIp(req.ip || req.socket.remoteAddress);
      const publicBaseUrl =
        process.env.APP_URL ||
        process.env.FRONTEND_ORIGIN ||
        `${req.protocol}://${req.get('host')}`;
      const connected = await connectTelegramBotWebhook(publicBaseUrl, ipH);
      res.json({
        ok: true,
        ...connected,
      });
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : 'Failed to connect bot.';
      res.status(400).json({ error: msg });
    }
  }
);

app.post(
  '/api/admin/telegram/test',
  requireAdminAuth,
  async (_req: AuthRequest, res: Response) => {
    try {
      const result = await testTelegramConnection();
      res.json(result);
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : 'Failed to test Telegram connection.';
      res.status(400).json({ error: msg });
    }
  }
);

app.post(
  '/api/admin/telegram/disconnect',
  requireAdminAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const ipH = hashIp(req.ip || req.socket.remoteAddress);
      const result = await disconnectTelegramBot(ipH);
      res.json(result);
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : 'Failed to disconnect Telegram bot.';
      res.status(400).json({ error: msg });
    }
  }
);

app.post(
  '/api/admin/telegram/enroll',
  requireAdminAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { bootstrapSecret, telegramUserId, telegramUsername, firstName } =
        req.body || {};
      const ipH = hashIp(req.ip || req.socket.remoteAddress);
      const enrolled = await enrollTelegramAdmin({
        bootstrapSecretInput: String(bootstrapSecret || ''),
        telegramUserId: String(telegramUserId || ''),
        telegramUsername: telegramUsername ? String(telegramUsername) : undefined,
        firstName: firstName ? String(firstName) : undefined,
        ipHash: ipH,
      });
      res.json({ ok: true, enrolled });
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : 'Failed to enroll Telegram user ID.';
      res.status(400).json({ error: msg });
    }
  }
);

app.patch(
  '/api/admin/telegram/notifications',
  requireAdminAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { eventKey, enabled, cooldownSeconds } = req.body || {};
      if (!eventKey || typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'Invalid notification parameters.' });
      }
      const updated = await updateNotificationSetting(
        String(eventKey),
        enabled,
        typeof cooldownSeconds === 'number' ? cooldownSeconds : undefined
      );
      res.json({ ok: true, setting: updated });
    } catch (error) {
      console.error('Update notification setting error:', error);
      res.status(500).json({ error: 'Failed to update notification setting.' });
    }
  }
);

app.post(
  '/api/admin/telegram/send-report',
  requireAdminAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { reportType } = req.body || {};
      const validTypes = ['daily', 'weekly', 'monthly'];
      const t = validTypes.includes(reportType) ? reportType : 'daily';
      const reportText = await triggerScheduledReportNotification(t);
      res.json({ ok: true, reportText });
    } catch (error) {
      console.error('Send report error:', error);
      res.status(500).json({ error: 'Failed to generate and send report.' });
    }
  }
);

// ==================================================
// 7. PROTECTED SECURITY & AUDIT LOGS ENDPOINT
// ==================================================
app.get(
  '/api/admin/security/logs',
  requireAdminAuth,
  async (_req: AuthRequest, res: Response) => {
    try {
      const auditLogs = await getSecurityAuditLogs(80);
      const notificationHistory = await getNotificationHistory(50);
      res.json({
        auditLogs,
        notificationHistory,
      });
    } catch (error) {
      console.error('Security logs error:', error);
      res.status(500).json({ error: 'Failed to load security audit logs.' });
    }
  }
);

// ==================================================
// 8. SCHEDULED BACKGROUND REPORT CHECKER (IST)
// ==================================================
let lastDailyReportSentDate = '';
setInterval(() => {
  const { date, hour } = getISTDateParts();
  // Automatically send daily report at 23:00 IST once per day
  if (hour === 23 && lastDailyReportSentDate !== date) {
    lastDailyReportSentDate = date;
    triggerScheduledReportNotification('daily').catch((err) => {
      console.error('Scheduled daily report error:', err);
    });
  }
}, 15 * 60 * 1000);

// ==================================================
// 8.5 PHASE 2 — MUSIC CATALOG, GOOGLE DRIVE COMPATIBILITY & WISH STORAGE API
// ==================================================
interface StoredWishRecord {
  wishId: string;
  config: Record<string, unknown>;
  passwordHash: string | null;
  createdAt: number;
}

const storedWishes = new Map<string, StoredWishRecord>();

// Public Music Catalog API (Admin management connects in Phase 3)
app.get('/api/music/catalog', (_req: Request, res: Response) => {
  res.json({
    songs: DEFAULT_MUSIC_CATALOG,
    phase3AdminReady: true,
  });
});

// Google Drive Audio URL Validation & Compatibility Check
app.post(
  '/api/music/validate-drive',
  publicAnalyticsLimiter,
  async (req: Request, res: Response) => {
    try {
      const { url } = req.body || {};
      const fileId = extractGoogleDriveFileId(String(url || ''));
      if (!fileId) {
        return res.json({
          valid: false,
          fileId: null,
          streamable: false,
          streamUrl: null,
          reason:
            'Invalid Google Drive URL. Use format: https://drive.google.com/file/d/<FILE_ID>/view',
        });
      }

      const directUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(
        fileId
      )}`;
      let streamable = false;
      let reason =
        'Google Drive URL validated. Note: Direct streaming requires the file to be shared publicly as an audio file.';

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        const headRes = await fetch(directUrl, {
          method: 'HEAD',
          redirect: 'follow',
          signal: controller.signal,
        });
        clearTimeout(timer);
        const ct = (headRes.headers.get('content-type') || '').toLowerCase();
        if (headRes.ok && (ct.startsWith('audio/') || ct.includes('octet-stream'))) {
          streamable = true;
          reason = 'Google Drive audio stream is publicly accessible and ready.';
        } else if (headRes.status === 403 || headRes.status === 401) {
          reason =
            'Google Drive file is restricted or private. Automatic active song fallback will be used.';
        } else if (headRes.status === 404) {
          reason =
            'Google Drive file was not found (404). Automatic active song fallback will be used.';
        } else {
          reason =
            'Google Drive link points to an HTML viewer or non-audio resource. Built-in harmonic audio engine will be used.';
        }
      } catch {
        reason =
          'Could not reach Google Drive host within timeout; automatic active song fallback enabled.';
      }

      res.json({
        valid: true,
        fileId,
        streamable,
        streamUrl: streamable ? `/api/music/stream/${encodeURIComponent(fileId)}` : null,
        reason,
      });
    } catch {
      res.status(500).json({
        valid: false,
        fileId: null,
        streamable: false,
        streamUrl: null,
        reason: 'Failed to validate Google Drive link.',
      });
    }
  }
);

// Safe Google Drive Audio Stream Proxy
app.get('/api/music/stream/:fileId', async (req: Request, res: Response) => {
  try {
    const fileId = String(req.params.fileId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!fileId || fileId.length < 10) {
      return res.status(400).json({ error: 'Invalid Google Drive file ID.' });
    }
    const directUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(
      fileId
    )}`;
    const upstream = await fetch(directUrl, { redirect: 'follow' });
    const ct = (upstream.headers.get('content-type') || '').toLowerCase();
    if (!upstream.ok || ct.includes('text/html')) {
      return res.status(422).json({
        error:
          'Google Drive file cannot be streamed directly (requires public audio sharing).',
      });
    }
    res.setHeader('Content-Type', ct || 'audio/mpeg');
    const arrayBuffer = await upstream.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch {
    res.status(502).json({ error: 'Failed to stream audio from Google Drive.' });
  }
});

// Store Generated Wish Configuration (with optional bcrypt Password Protection)
app.post(
  '/api/wishes',
  publicAnalyticsLimiter,
  async (req: Request, res: Response) => {
    try {
      const { config, password } = req.body || {};
      if (!config || typeof config !== 'object' || !config.wishId) {
        return res.status(400).json({ error: 'Invalid wish configuration payload.' });
      }

      const wishId = String(config.wishId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 36);
      if (!wishId) {
        return res.status(400).json({ error: 'Invalid wishId.' });
      }

      let passwordHash: string | null = null;
      if (config.passwordProtected && password && String(password).trim()) {
        // Hash password with bcrypt (never store plaintext!)
        passwordHash = await bcrypt.hash(String(password).trim(), 10);
      }

      const cleanConfig = {
        ...config,
        wishId,
        passwordProtected: Boolean(passwordHash),
      };

      storedWishes.set(wishId, {
        wishId,
        config: cleanConfig,
        passwordHash,
        createdAt: Date.now(),
      });

      // Prune old in-memory wishes if map exceeds 1000 entries
      if (storedWishes.size > 1000) {
        const oldestKey = storedWishes.keys().next().value;
        if (oldestKey) storedWishes.delete(oldestKey);
      }

      res.json({
        ok: true,
        wishId,
        passwordProtected: Boolean(passwordHash),
      });
    } catch (error) {
      console.error('Save wish error:', error);
      res.status(500).json({ error: 'Failed to save wish configuration.' });
    }
  }
);

// Retrieve Stored Wish Configuration (withholds content if password-protected!)
app.get('/api/wishes/:wishId', (req: Request, res: Response) => {
  const wishId = String(req.params.wishId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const record = storedWishes.get(wishId);
  if (!record) {
    return res.status(404).json({ error: 'Wish configuration not found.' });
  }

  if (record.passwordHash) {
    // Do NOT expose message, photo, or password hash before password verification
    return res.json({
      wishId: record.wishId,
      locked: true,
      passwordProtected: true,
      senderName: record.config.senderName || '',
      recipientName: record.config.recipientName || '',
      language: record.config.language || 'hi',
    });
  }

  res.json({
    wishId: record.wishId,
    locked: false,
    passwordProtected: false,
    config: record.config,
  });
});

// Verify Password & Unlock Protected Wish
app.post(
  '/api/wishes/:wishId/unlock',
  publicAnalyticsLimiter,
  async (req: Request, res: Response) => {
    try {
      const wishId = String(req.params.wishId || '').replace(/[^a-zA-Z0-9_-]/g, '');
      const { password } = req.body || {};
      const record = storedWishes.get(wishId);

      if (!record) {
        return res.status(404).json({
          error:
            'This password-protected wish session is not found on the server.',
        });
      }

      if (!record.passwordHash) {
        return res.json({
          ok: true,
          locked: false,
          config: record.config,
        });
      }

      const candidate = String(password || '').trim();
      if (!candidate) {
        return res.status(401).json({ error: 'Please enter the wish password.' });
      }

      const valid = await bcrypt.compare(candidate, record.passwordHash);
      if (!valid) {
        return res
          .status(401)
          .json({ error: 'Incorrect password. Please try again.' });
      }

      res.json({
        ok: true,
        locked: false,
        config: record.config,
      });
    } catch {
      res.status(500).json({ error: 'Failed to verify wish password.' });
    }
  }
);

// ==================================================
// 9. VITE DEV MIDDLEWARE / STATIC PROD SERVING
// ==================================================
async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Indian New Year 2027 Full-Stack Server running on http://0.0.0.0:${PORT}`
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
