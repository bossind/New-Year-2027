/**
 * Privacy-conscious Client Analytics & Live Heartbeat Tracker
 * Generates anonymous visitor IDs, deduplicates refreshes, and sends non-blocking events.
 */
import { resolveApiUrl } from './api-client';

function randomId(prefix: string): string {
  const bytes = new Uint8Array(12);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}_${hex}`;
}

export function getAnonymousVisitorId(): string {
  try {
    let vid = localStorage.getItem('ny2027_vid');
    if (!vid || !/^[a-zA-Z0-9_-]{10,64}$/.test(vid)) {
      vid = randomId('v');
      localStorage.setItem('ny2027_vid', vid);
    }
    return vid;
  } catch {
    return randomId('v');
  }
}

function checkIsNewSession(): boolean {
  try {
    const existing = sessionStorage.getItem('ny2027_active_session');
    if (!existing) {
      sessionStorage.setItem('ny2027_active_session', String(Date.now()));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function trackPageVisit(lang: string) {
  const visitorId = getAnonymousVisitorId();
  const isNewSession = checkIsNewSession();
  const sp = new URLSearchParams(window.location.search);
  const utmSource = sp.get('utm_source') || sp.get('ref') || undefined;

  sendAnalyticsPayload({
    eventId: randomId('evt_visit'),
    eventType: 'page_visit',
    visitorId,
    lang,
    referrer: document.referrer || undefined,
    utmSource,
    isNewSession,
  });
}

export function trackWishCreated(params: {
  name: string;
  lang: string;
  animId: string;
  msgId: number;
}) {
  const visitorId = getAnonymousVisitorId();
  sendAnalyticsPayload({
    eventId: randomId('evt_wish'),
    eventType: 'wish_created',
    visitorId,
    name: params.name,
    lang: params.lang,
    animId: params.animId,
    msgId: params.msgId,
  });
}

export function trackShareClick(params: {
  platform:
    | 'whatsapp'
    | 'telegram'
    | 'facebook'
    | 'x'
    | 'native'
    | 'copy_link'
    | 'other';
  lang: string;
  animId?: string;
  msgId?: number;
}) {
  const visitorId = getAnonymousVisitorId();
  sendAnalyticsPayload({
    eventId: randomId('evt_share'),
    eventType: 'share_click',
    visitorId,
    sharePlatform: params.platform,
    lang: params.lang,
    animId: params.animId,
    msgId: params.msgId,
  });
}

export function trackGiftOpened(params: {
  lang: string;
  animId: string;
  msgId: number;
}) {
  const visitorId = getAnonymousVisitorId();
  sendAnalyticsPayload({
    eventId: randomId('evt_gift'),
    eventType: 'gift_opened',
    visitorId,
    lang: params.lang,
    animId: params.animId,
    msgId: params.msgId,
  });
}

function sendAnalyticsPayload(payload: Record<string, unknown>) {
  try {
    fetch(resolveApiUrl('/api/analytics/event'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Never disrupt user experience on network issues
    });
  } catch {
    // ignore
  }
}

export function sendVisitorHeartbeat() {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return;
  }
  const visitorId = getAnonymousVisitorId();
  try {
    fetch(resolveApiUrl('/api/analytics/heartbeat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore
  }
}
