import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  UI,
  MSG,
  LANG_DEFAULT_MSG,
  LangCode,
  detectInitialLang,
  formatTemplate,
} from './data/i18n';
import {
  formatPersonalizedMessage,
  getTemplatesForLanguageAndCategory,
} from './data/messages';
import {
  getBackgroundById,
  resolveAutomaticBackground,
} from './data/backgrounds';
import { STATIC_PAGES, PageId } from './data/pages';
import { ANIM, ANIM_IDS, AnimId, Engine } from './engine/animations';
import { MUSIC } from './engine/music';
import { SND } from './engine/sound';
import {
  FontStyleId,
  PhotoDisplayMode,
  PhotoFrameId,
  TextColorId,
  WishConfig,
} from './types/wish';
import {
  drawFramedPhotoOnCanvas,
  loadImageElement,
} from './utils/imageProcessor';
import {
  detectVideoExportSupport,
  exportWishAsAnimatedVideo,
  exportWishAsHDImage,
} from './utils/exporter';
import { QRCodeDesigner } from './components/QRCodeModal';
import { CreatorStudio } from './components/CreatorStudio';
import { AdminPortal } from './components/AdminDashboard';
import {
  sendVisitorHeartbeat,
  trackGiftOpened,
  trackPageVisit,
  trackShareClick,
  trackWishCreated,
} from './lib/analytics-client';

const YEAR = 2027;
// January 1, 2027 00:00:00 India Standard Time (Asia/Kolkata, UTC+05:30)
const IST_TARGET_TIMESTAMP = new Date('2027-01-01T00:00:00+05:30').getTime();

// Core 6 languages for the selector
const PHASE1_LANGS: LangCode[] = ['hi', 'en', 'bn', 'mr', 'hinglish', 'ur'];

type MobileNavTab = 'home' | 'create' | 'featured';

/* SVG Icons from original Blogger XML + Mobile Nav Icons */
const Icons = {
  wa: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2.2A9.8 9.8 0 0 0 3.6 17l-1.4 4.8 5-1.3A9.8 9.8 0 1 0 12 2.2zm0 17.9a8 8 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.1 8.1 0 1 1 12 20.1zm4.5-6c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"
      />
    </svg>
  ),
  fb: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M14 8.5h2.8V5H14c-2.6 0-4.3 1.7-4.3 4.4v1.9H7.4v3.4h2.3V22h3.6v-7.3h2.8l.5-3.4h-3.3V9.6c0-.7.3-1.1.7-1.1z"
      />
    </svg>
  ),
  tg: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.4 3.6 2.9 10.8c-1 .4-1 1.6 0 1.9l4.6 1.4 1.8 5.6c.2.7 1.1.9 1.6.4l2.6-2.4 4.8 3.5c.6.4 1.4.1 1.6-.6l3-15.7c.2-.9-.7-1.6-1.5-1.3zM9.7 14.4l-.4 3.4-1.3-4 9.5-6.4-7.8 7z"
      />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M17.6 3h3.1l-6.8 7.7 8 10.3h-6.2l-4.9-6.3L5.2 21H2.1l7.2-8.3L1.6 3H8l4.4 5.8zm-1.1 16.2h1.7L7.4 4.7H5.6z"
      />
    </svg>
  ),
  copy: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 3h11a2 2 0 0 1 2 2v11h-2V5H8zm-3 4h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm0 2v10h10V9z"
      />
    </svg>
  ),
  more: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M18 16a3 3 0 0 0-2.3 1.1l-6.9-3.6a3 3 0 0 0 0-1l6.9-3.6A3 3 0 1 0 15 7l-6.9 3.5a3 3 0 1 0 0 3L15 17a3 3 0 1 0 3-1z"
      />
    </svg>
  ),
  soundOn: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 9h4l5-4v14l-5-4H4zm12.5-1.8a6.5 6.5 0 0 1 0 9.6l-1.4-1.4a4.5 4.5 0 0 0 0-6.8zM19.3 4.4a10.5 10.5 0 0 1 0 15.2l-1.4-1.4a8.5 8.5 0 0 0 0-12.4z"
      />
    </svg>
  ),
  soundOff: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 9h4l5-4v14l-5-4H4zm11.6.4 1.4-1.4 2 2 2-2 1.4 1.4-2 2 2 2-1.4 1.4-2-2-2 2-1.4-1.4 2-2z"
      />
    </svg>
  ),
  replay: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"
      />
    </svg>
  ),
  home: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3.2 3 10.5V21h6.5v-6.5h5V21H21V10.5L12 3.2z"
      />
    </svg>
  ),
  create: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"
      />
    </svg>
  ),
  featured: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9L12 2.5z"
      />
    </svg>
  ),
  giftBox: (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id="wxg1" x1="0" x2="1">
          <stop offset="0" stopColor="#ff4d66" />
          <stop offset="1" stopColor="#b3122a" />
        </linearGradient>
        <linearGradient id="wxg2" x1="0" x2="1">
          <stop offset="0" stopColor="#d99a1e" />
          <stop offset=".5" stopColor="#fff0a8" />
          <stop offset="1" stopColor="#c98a14" />
        </linearGradient>
      </defs>
      <rect x="18" y="52" width="84" height="58" rx="6" fill="url(#wxg1)" />
      <rect x="12" y="36" width="96" height="20" rx="5" fill="#ff5d73" />
      <rect x="52" y="36" width="16" height="74" fill="url(#wxg2)" />
      <path
        d="M60 36c-6-14-26-22-30-12-4 9 14 12 30 12zm0 0c6-14 26-22 30-12 4 9-14 12-30 12z"
        fill="#ffd76a"
        stroke="#b8780f"
        strokeWidth="2.5"
      />
      <circle cx="60" cy="35" r="6" fill="#f5b52e" />
      <rect x="18" y="52" width="84" height="6" fill="rgba(0,0,0,.18)" />
    </svg>
  ),
};

/* Sanitize user-entered name to prevent XSS and control characters */
export function cleanName(raw: string | null | undefined): string {
  const s = String(raw || '')
    .replace(/[\u0000-\u001f<>"'`\\{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(s).slice(0, 24).join('');
}

function cleanCustomText(raw: string | null | undefined): string {
  return String(raw || '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/g, '')
    .trim()
    .slice(0, 320);
}

function parseAnimIndex(val: string | null): number {
  if (!val) return 1;
  const asNum = parseInt(val, 10);
  if (!isNaN(asNum) && asNum >= 0 && asNum < ANIM_IDS.length) {
    return asNum;
  }
  const bySlug = ANIM_IDS.indexOf(val as AnimId);
  return bySlug >= 0 ? bySlug : 0;
}

function parseMsgIndex(val: string | null, lang: LangCode): number {
  if (val !== null && val !== '') {
    const asNum = parseInt(val, 10);
    if (!isNaN(asNum) && asNum >= 0 && asNum < MSG.length) {
      return asNum;
    }
  }
  return LANG_DEFAULT_MSG[lang] ?? 1;
}

function createDefaultWishConfig(overrides?: Partial<WishConfig>): WishConfig {
  const lang = overrides?.language || 'hi';
  const defMsgId = LANG_DEFAULT_MSG[lang] ?? 1;
  const defaultTpl =
    getTemplatesForLanguageAndCategory(lang, 'Best Wishes')[0]?.text ||
    MSG[defMsgId]?.text ||
    MSG[0].text;
  const randomSong = MUSIC.pickRandomActiveSongId();

  return {
    wishId: '',
    recipientName: '',
    senderName: '',
    messageCategory: 'Best Wishes',
    messageId: defMsgId,
    customMessage: defaultTpl,
    isCustomMessage: false,
    language: lang,
    animationId: 'fireworks',
    photoAssetId: null,
    photoDataUrl: null,
    photoCrop: { zoom: 1, offsetX: 0, offsetY: 0 },
    photoDisplayMode: 'card',
    photoFrameId: 'golden',
    backgroundMode: 'auto',
    backgroundId: 'bg-cel-gold',
    customBgDataUrl: null,
    musicMode: 'auto',
    musicId: randomSong,
    fontId: 'cinzel',
    textColor: 'gold',
    passwordProtected: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function parseUrlState() {
  const sp = new URLSearchParams(window.location.search);
  const lang = detectInitialLang(sp.get('lang'));
  const senderName = cleanName(sp.get('n'));
  const recipientName = cleanName(sp.get('to'));
  const wid = (sp.get('wid') || '').trim();
  const hasAnimParam = sp.has('a');
  const a = hasAnimParam ? parseAnimIndex(sp.get('a')) : 1; // Royal Fireworks default showcase
  const animId = ANIM_IDS[a] || 'fireworks';
  const w = parseMsgIndex(sp.get('w'), lang);
  const songIdParam = sp.get('m') || '';
  const resolvedSong = songIdParam
    ? MUSIC.getSongById(songIdParam).songId
    : MUSIC.pickRandomActiveSongId();
  const bgParam = sp.get('bg') || '';
  const frameParam = (sp.get('fr') as PhotoFrameId) || 'golden';
  const pmParam = (sp.get('pm') as PhotoDisplayMode) || 'card';
  const fnParam = (sp.get('fn') as FontStyleId) || 'cinzel';
  const tcParam = (sp.get('tc') as TextColorId) || 'gold';
  const cmParam = cleanCustomText(sp.get('cm'));
  const pwLocked = sp.get('pw') === '1';

  const pageParam = sp.get('page');
  const page =
    pageParam && pageParam in STATIC_PAGES ? (pageParam as PageId) : null;

  const defaultTpl =
    cmParam ||
    MSG[w]?.text ||
    getTemplatesForLanguageAndCategory(lang, 'Best Wishes')[0]?.text ||
    MSG[0].text;

  const config = createDefaultWishConfig({
    wishId: wid,
    senderName,
    recipientName,
    language: lang,
    animationId: animId,
    messageId: w,
    customMessage: defaultTpl,
    isCustomMessage: Boolean(cmParam),
    musicId: resolvedSong,
    backgroundMode: bgParam ? 'custom' : 'auto',
    backgroundId: bgParam || 'bg-cel-gold',
    photoFrameId: ['golden', 'royal', 'cinematic', 'elegant'].includes(
      frameParam
    )
      ? frameParam
      : 'golden',
    photoDisplayMode: pmParam === 'background' ? 'background' : 'card',
    fontId: ['cinzel', 'greatvibes', 'poppins', 'playfair', 'royalserif'].includes(
      fnParam
    )
      ? fnParam
      : 'cinzel',
    textColor: ['gold', 'rose', 'platinum', 'emerald', 'neoncyan', 'crimson'].includes(
      tcParam
    )
      ? tcParam
      : 'gold',
    passwordProtected: pwLocked,
  });

  const isSharedWish = Boolean(senderName || wid);
  return { config, isSharedWish, page };
}

function getBaseUrl(): string {
  return window.location.origin + window.location.pathname;
}

export function buildWishUrlFromConfig(cfg: WishConfig): string {
  const params = new URLSearchParams();
  const cleanedSender = cleanName(cfg.senderName);
  const cleanedRecipient = cleanName(cfg.recipientName);
  const animIdx = Math.max(0, ANIM_IDS.indexOf(cfg.animationId));

  if (cleanedSender) params.set('n', cleanedSender);
  if (cleanedRecipient) params.set('to', cleanedRecipient);
  params.set('a', String(animIdx));
  params.set('w', String(cfg.messageId));
  params.set('lang', cfg.language);
  params.set('m', cfg.musicId);

  if (cfg.backgroundMode === 'custom' && cfg.backgroundId) {
    params.set('bg', cfg.backgroundId);
  }
  if (cfg.photoFrameId !== 'golden') {
    params.set('fr', cfg.photoFrameId);
  }
  if (cfg.photoDisplayMode !== 'card') {
    params.set('pm', cfg.photoDisplayMode);
  }
  if (cfg.fontId !== 'cinzel') {
    params.set('fn', cfg.fontId);
  }
  if (cfg.textColor !== 'gold') {
    params.set('tc', cfg.textColor);
  }
  if (cfg.wishId) {
    params.set('wid', cfg.wishId);
  }
  if (cfg.passwordProtected) {
    params.set('pw', '1');
  }
  if (cfg.customMessage && !cfg.wishId) {
    params.set('cm', cfg.customMessage.slice(0, 180));
  }

  return `${getBaseUrl()}?${params.toString()}`;
}

function getSafeStorage(key: string): string {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function setSafeStorage(key: string, val: string) {
  try {
    localStorage.setItem(key, val);
  } catch {
    // ignore storage errors
  }
}

/* ---------- Canvas-Rendered Framed Photo Medallion (No Inline Styles) ---------- */
const StageFramedPhotoCanvas: React.FC<{
  photoDataUrl: string;
  crop: WishConfig['photoCrop'];
  frameId: PhotoFrameId;
}> = ({ photoDataUrl, crop, frameId }) => {
  const cvRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      const cv = cvRef.current;
      if (!cv || !photoDataUrl) return;
      const img = await loadImageElement(photoDataUrl);
      if (cancelled) return;
      const size = 240;
      cv.width = size;
      cv.height = size;
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, size, size);
      drawFramedPhotoOnCanvas(
        ctx,
        img,
        size / 2,
        size / 2 + 4,
        size * 0.78,
        crop,
        frameId
      );
    };
    render().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [photoDataUrl, crop, frameId]);

  return (
    <div className="wx-stage-photo-wrap">
      <canvas
        ref={cvRef}
        className="wx-stage-photo-canvas"
        aria-label="Framed personalized wish photo"
      />
    </div>
  );
};

/* ---------- Canvas-Rendered Custom Background Layer (No Inline Styles) ---------- */
const StageCustomBackgroundCanvas: React.FC<{
  dataUrl: string;
  crop?: WishConfig['photoCrop'];
}> = ({ dataUrl, crop }) => {
  const cvRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      const cv = cvRef.current;
      if (!cv || !dataUrl) return;
      const img = await loadImageElement(dataUrl);
      if (cancelled) return;
      const W = 720;
      const H = 900;
      cv.width = W;
      cv.height = H;
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);

      const iw = img.naturalWidth || img.width || 1;
      const ih = img.naturalHeight || img.height || 1;
      const zoom = crop ? Math.max(1, Math.min(3, crop.zoom || 1)) : 1;
      const scale = Math.max(W / iw, H / ih) * zoom;
      const dw = iw * scale;
      const dh = ih * scale;
      const px = crop ? ((crop.offsetX || 0) / 100) * (W * 0.35) : 0;
      const py = crop ? ((crop.offsetY || 0) / 100) * (H * 0.35) : 0;
      ctx.drawImage(img, (W - dw) / 2 + px, (H - dh) / 2 + py, dw, dh);
    };
    render().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [dataUrl, crop]);

  return (
    <canvas
      ref={cvRef}
      className="wx-stage-custom-bg"
      aria-hidden="true"
    />
  );
};

/* ---------- 8-Second Cinematic Intro Component ---------- */
const CinematicIntro: React.FC<{
  lang: LangCode;
  onComplete: () => void;
}> = ({ lang, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [fadingOut, setFadingOut] = useState(false);
  const [soundOn, setSoundOn] = useState(SND.isOn);
  const T = UI[lang];

  useEffect(() => {
    return SND.subscribe((on) => setSoundOn(on));
  }, []);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;

    const eng = new Engine(cv, {
      id: 'fireworks',
      year: YEAR,
      sfx: (k) => SND.play(k),
    });
    eng.start();

    const t1 = window.setTimeout(() => setStep(1), 2000);
    const t2 = window.setTimeout(() => {
      setStep(2);
      if (SND.isOn) SND.open();
    }, 4000);
    const t3 = window.setTimeout(() => setStep(3), 6000);
    const tFade = window.setTimeout(() => setFadingOut(true), 7450);
    const tDone = window.setTimeout(() => {
      onComplete();
    }, 8000);

    const handleResize = () => eng.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      eng.stop();
      window.removeEventListener('resize', handleResize);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(tFade);
      window.clearTimeout(tDone);
    };
  }, [onComplete]);

  const handleToggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    SND.toggle();
  };

  const handleSkip = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFadingOut(true);
    window.setTimeout(onComplete, 320);
  };

  return (
    <div
      className={`wx-intro-overlay ${fadingOut ? 'fading-out' : ''}`}
      role="dialog"
      aria-label="New Year 2027 Cinematic Intro"
    >
      <canvas ref={canvasRef} className="wx-intro-canvas" />
      {step >= 1 && <div className="wx-particles-layer" />}

      <div className="wx-intro-top-controls">
        <button
          type="button"
          className={`wx-intro-ctrl-btn ${soundOn ? 'active' : ''}`}
          onClick={handleToggleSound}
        >
          {soundOn ? Icons.soundOn : Icons.soundOff}
          <span>{soundOn ? 'Sound On' : 'Tap for Sound'}</span>
        </button>

        <button
          type="button"
          className="wx-intro-ctrl-btn"
          onClick={handleSkip}
        >
          <span>Enter {YEAR} ›</span>
        </button>
      </div>

      <div className="wx-intro-stage-center">
        {step === 0 && (
          <div className="wx-intro-phase-badge">
            🎆 Celebration City {YEAR}
          </div>
        )}

        {step >= 1 && (
          <div className="wx-intro-year-3d" aria-hidden="true">
            {YEAR}
          </div>
        )}

        {step >= 2 && (
          <div className="wx-intro-gift-wrap opening">
            <div className="wx-intro-gift-burst" />
            {Icons.giftBox}
          </div>
        )}

        {step >= 3 && (
          <div className="wx-intro-hny-reveal">
            <div className="wx-intro-hny-script">Happy New Year {YEAR}</div>
            <div className="wx-intro-hny-sub">
              {formatTemplate(T.h1, YEAR)} {T.h1b}
            </div>
          </div>
        )}
      </div>

      <div className="wx-intro-progress-bar">
        <div className="wx-intro-progress-track">
          <div className="wx-intro-progress-fill" />
        </div>
      </div>
    </div>
  );
};

/* ---------- Live IST Countdown Component with Celebration Mode ---------- */
const ISTCountdown: React.FC<{ lang: LangCode }> = ({ lang }) => {
  const T = UI[lang];
  const [now, setNow] = useState(() => Date.now());
  const [previewCelebration, setPreviewCelebration] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const diffMs = IST_TARGET_TIMESTAMP - now;
  const isCelebrationMode = diffMs <= 0 || previewCelebration;

  if (isCelebrationMode) {
    return (
      <div className="wx-cd" aria-live="polite">
        <div className="wx-cd-celebration">
          <div className="wx-cd-done-title">
            🎆 🎉 {formatTemplate(T.done, YEAR)} 🎉 🎆
          </div>
          <p className="wx-cd-done-sub">
            Welcome to {YEAR}! Celebration Mode is active with live golden fireworks.
          </p>
          {diffMs > 0 && (
            <button
              type="button"
              className="wx-cd-mode-btn mt-2"
              onClick={() => setPreviewCelebration(false)}
            >
              ⏳ Back to Live {YEAR} Countdown
            </button>
          )}
        </div>
      </div>
    );
  }

  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const values = [
    String(days),
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ];

  return (
    <div className="wx-cd" aria-live="polite">
      <div className="wx-cd-head">
        <div className="wx-cd-t">⏳ {formatTemplate(T.cd, YEAR)}</div>
        <button
          type="button"
          className="wx-cd-mode-btn"
          onClick={() => setPreviewCelebration(true)}
          title="Preview what happens when January 1, 2027 arrives"
        >
          🎆 Celebration Mode
        </button>
      </div>
      <div className="wx-cd-r" dir="ltr">
        {T.units.map((unitLabel, i) => (
          <div className="wx-cd-b" key={unitLabel}>
            <b>{values[i]}</b>
            <span>{unitLabel}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ---------- Mini Live Animation Card in Picker ---------- */
const MiniAnimCard: React.FC<{
  animId: AnimId;
  index: number;
  selected: boolean;
  label: string;
  onSelect: (idx: number) => void;
}> = ({ animId, index, selected, label, onSelect }) => {
  const cardRef = useRef<HTMLButtonElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engRef = useRef<Engine | null>(null);
  const A = ANIM[animId];

  useEffect(() => {
    const card = cardRef.current;
    const cv = canvasRef.current;
    if (!card || !cv) return;

    let loopTimer = 0;
    const startMini = () => {
      if (!engRef.current) {
        engRef.current = new Engine(cv, {
          id: animId,
          small: true,
          year: YEAR,
        });
      }
      engRef.current.start();
      if (A.reveal > 1.5) {
        window.clearInterval(loopTimer);
        loopTimer = window.setInterval(() => {
          engRef.current?.set(animId);
        }, 7000);
      }
    };

    const stopMini = () => {
      engRef.current?.stop();
      window.clearInterval(loopTimer);
    };

    let obs: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) startMini();
            else stopMini();
          });
        },
        { rootMargin: '80px' }
      );
      obs.observe(card);
    } else {
      startMini();
    }

    const handleResize = () => {
      engRef.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      stopMini();
      obs?.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [animId, A.reveal]);

  const cls = [
    'wx-pc',
    `th-${A.theme}`,
    A.ownYear ? 'own-year' : '',
    selected ? 'sel' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={cardRef}
      type="button"
      className={cls}
      aria-label={label}
      aria-pressed={selected}
      onClick={() => onSelect(index)}
    >
      <canvas ref={canvasRef} />
      <span className="wx-pc-y">{YEAR}</span>
      <span className="wx-pc-l">
        <i>{A.ico}</i>
        <span>{label}</span>
      </span>
      <b className="wx-pc-ok">✓</b>
    </button>
  );
};

/* ---------- Interactive 3D Stage Component (Unified Phase 2 WishConfig) ---------- */
interface StageProps {
  mode: 'home' | 'wish';
  extraClass?: string;
  config: WishConfig;
  placeholderName: string;
  autoStart: boolean;
  showLiveBadge?: boolean;
  liveBadgeText?: string;
  readyBannerText?: string;
  onReveal?: () => void;
  gateContent?: React.ReactNode;
}

const WishStage: React.FC<StageProps> = ({
  mode,
  extraClass = '',
  config,
  placeholderName,
  autoStart,
  showLiveBadge,
  liveBadgeText,
  readyBannerText,
  onReveal,
  gateContent,
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const yearRef = useRef<HTMLDivElement | null>(null);
  const nameRef = useRef<HTMLDivElement | null>(null);
  const engRef = useRef<Engine | null>(null);

  const [revealed, setRevealed] = useState(false);
  const [soundOn, setSoundOn] = useState(SND.isOn);

  const animId = ANIM_IDS.includes(config.animationId)
    ? config.animationId
    : 'fireworks';
  const A = ANIM[animId];
  const m = MSG[config.messageId] || MSG[LANG_DEFAULT_MSG[config.language] ?? 1] || MSG[0];

  const cleanedSender = cleanName(config.senderName);
  const cleanedRecipient = cleanName(config.recipientName);
  const displayName = cleanedSender || placeholderName || 'आपका नाम';
  const nameLen = Array.from(displayName).length;
  const nfClass =
    nameLen <= 8
      ? 'nf-xl'
      : nameLen <= 12
      ? 'nf-lg'
      : nameLen <= 16
      ? 'nf-md'
      : 'nf-sm';

  const activeSong = MUSIC.getSongById(config.musicId);
  const activeBgPreset =
    config.backgroundMode === 'custom'
      ? getBackgroundById(config.backgroundId) ||
        resolveAutomaticBackground(animId, activeSong.mood)
      : resolveAutomaticBackground(animId, activeSong.mood);

  const formattedMessageText = formatPersonalizedMessage(
    config.customMessage || m.text,
    {
      year: YEAR,
      recipientName: cleanedRecipient,
      senderName: cleanedSender,
      defaultSender: displayName,
    }
  );

  useEffect(() => {
    return SND.subscribe((on) => setSoundOn(on));
  }, []);

  // Keep MUSIC controller synced with the wish's selected song
  useEffect(() => {
    if (config.musicId) {
      MUSIC.selectSong(config.musicId, false);
    }
  }, [config.musicId]);

  const triggerReveal = useCallback(() => {
    setRevealed(false);
    window.requestAnimationFrame(() => {
      setRevealed(true);
      if (onReveal) onReveal();
    });
  }, [onReveal]);

  // Initialize Engine once
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;

    const eng = new Engine(cv, {
      id: animId,
      year: YEAR,
      sfx: (k) => SND.play(k),
      onReveal: () => {
        triggerReveal();
      },
      yearRect: () => {
        if (!canvasRef.current || !yearRef.current) return null;
        const a = canvasRef.current.getBoundingClientRect();
        const b = yearRef.current.getBoundingClientRect();
        return { x: b.left - a.left, y: b.top - a.top, w: b.width, h: b.height };
      },
      nameRect: () => {
        if (!canvasRef.current || !nameRef.current) return null;
        const a = canvasRef.current.getBoundingClientRect();
        const b = nameRef.current.getBoundingClientRect();
        return {
          x: Math.max(8, a.width * 0.04),
          y: b.top - a.top,
          w: a.width - Math.max(16, a.width * 0.08),
          h: b.height,
        };
      },
      nameText: () =>
        nameRef.current?.getAttribute('data-t') ||
        cleanedSender ||
        placeholderName ||
        'आपका नाम',
    });
    engRef.current = eng;

    const handleResize = () => {
      eng.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      eng.stop();
      window.removeEventListener('resize', handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle animation switch or autoStart change
  useEffect(() => {
    const eng = engRef.current;
    if (!eng) return;
    setRevealed(false);
    eng.id = animId;
    eng.t = 0;
    eng.size();
    if (autoStart) {
      eng.start();
    } else {
      eng.stop();
    }
  }, [animId, autoStart]);

  // Relayout when displayName changes
  useEffect(() => {
    const eng = engRef.current;
    if (!eng) return;
    const t = window.setTimeout(() => {
      eng.relayout();
    }, 80);
    return () => window.clearTimeout(t);
  }, [displayName, animId]);

  const handleReplay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const eng = engRef.current;
    if (!eng) return;
    setRevealed(false);
    eng.id = animId;
    eng.t = 0;
    eng.size();
    eng.start();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!canvasRef.current || !engRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();
    engRef.current.ptr = { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const handlePointerLeave = () => {
    if (engRef.current) engRef.current.ptr = null;
  };

  const hasCardPhoto = Boolean(
    config.photoDataUrl && config.photoDisplayMode === 'card'
  );
  const hasBgPhoto = Boolean(
    config.photoDataUrl && config.photoDisplayMode === 'background'
  );
  const hasCustomUploadedBg = Boolean(
    config.backgroundMode === 'custom' && config.customBgDataUrl
  );

  const stageClass = [
    'wx-stage',
    `m-${mode}`,
    `th-${A.theme}`,
    `wx-bg-${activeBgPreset.id}`,
    `wx-font-${config.fontId}`,
    `wx-tc-${config.textColor}`,
    hasCardPhoto ? 'has-card-photo' : '',
    soundOn ? 'wx-music-active' : '',
    A.ownYear ? 'own-year' : '',
    A.ownName ? 'own-name' : '',
    A.textTop ? 'text-top' : '',
    extraClass,
  ]
    .filter(Boolean)
    .join(' ');

  const ovClass = [
    'wx-ov',
    m.cls ? `l-${m.cls} l-ind` : '',
    revealed ? 'in' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={stageRef}
      className={stageClass}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {/* Optional Photo-as-Background or Uploaded Custom Background Canvas */}
      {hasBgPhoto && config.photoDataUrl && (
        <StageCustomBackgroundCanvas
          dataUrl={config.photoDataUrl}
          crop={config.photoCrop}
        />
      )}
      {!hasBgPhoto && hasCustomUploadedBg && config.customBgDataUrl && (
        <StageCustomBackgroundCanvas dataUrl={config.customBgDataUrl} />
      )}

      <canvas ref={canvasRef} className="wx-cv" />

      <div className={ovClass} dir={UI[config.language].dir || m.dir || 'ltr'}>
        {/* Recipient Badge (WISH TO) */}
        {cleanedRecipient && (
          <div className="wx-recipient-pill">
            <span>🎁</span>
            <span>WISH FOR {cleanedRecipient}</span>
          </div>
        )}

        {/* Framed Photo Medallion (Card Mode) */}
        {hasCardPhoto && config.photoDataUrl && (
          <StageFramedPhotoCanvas
            photoDataUrl={config.photoDataUrl}
            crop={config.photoCrop}
            frameId={config.photoFrameId}
          />
        )}

        {/* Sender Name (WISH FROM) */}
        <div
          ref={nameRef}
          className={`wx-name ${nfClass}`}
          data-t={displayName}
        >
          {displayName}
        </div>
        <div className="wx-wish">{m.wish}</div>
        <div className="wx-hny" data-t={m.hny}>
          {m.hny}
        </div>
        <div ref={yearRef} className="wx-year" data-t={String(YEAR)}>
          {YEAR}
        </div>
        <p className="wx-msg">{formattedMessageText}</p>

        {cleanedRecipient && cleanedSender && (
          <div className="wx-sender-signoff">
            <span>✨ From {cleanedSender}</span>
          </div>
        )}
      </div>

      {/* Stage Chrome Tools: Sound & Replay (Music player remains visually hidden during normal viewing) */}
      <div className="wx-tools">
        <button
          type="button"
          className={`wx-tb ${soundOn ? 'on' : ''}`}
          aria-label={soundOn ? 'Sound on' : 'Sound off'}
          onClick={(e) => {
            e.stopPropagation();
            SND.toggle();
          }}
        >
          {soundOn ? Icons.soundOn : Icons.soundOff}
        </button>
        <button
          type="button"
          className="wx-tb"
          aria-label="Replay Golden Reveal"
          onClick={handleReplay}
        >
          {Icons.replay}
          <span>Replay</span>
        </button>
      </div>

      {showLiveBadge && (
        <span className="wx-live">
          <i />
          {liveBadgeText}
        </span>
      )}

      {readyBannerText && <div className="wx-ready">{readyBannerText}</div>}

      {gateContent}
    </div>
  );
};

/* ---------- Social Sharing, HD Image/Video Download, QR Code & Password Panel ---------- */
interface SharePanelProps {
  config: WishConfig;
  rawPassword?: string;
  onCopy: (txt: string, customToast?: string) => void;
  onOpenStudio: () => void;
  onPreviewGiftGate?: () => void;
}

const SharePanel: React.FC<SharePanelProps> = ({
  config,
  rawPassword = '',
  onCopy,
  onOpenStudio,
  onPreviewGiftGate,
}) => {
  const lang = config.language;
  const T = UI[lang];
  const m = MSG[config.messageId] || MSG[0];
  const animIndex = Math.max(0, ANIM_IDS.indexOf(config.animationId));
  const cleanedSender = cleanName(config.senderName) || T.defaultName;
  const cleanedRecipient = cleanName(config.recipientName);
  const link = buildWishUrlFromConfig({
    ...config,
    senderName: cleanedSender,
  });

  const formattedMessageText = formatPersonalizedMessage(
    config.customMessage || m.text,
    {
      year: YEAR,
      recipientName: cleanedRecipient,
      senderName: cleanedSender,
      defaultSender: cleanedSender,
    }
  );

  const [imgProgress, setImgProgress] = useState<number | null>(null);
  const [vidProgress, setVidProgress] = useState<number | null>(null);
  const [exportErr, setExportErr] = useState<string>('');
  const [showQR, setShowQR] = useState<boolean>(false);

  const videoCap = detectVideoExportSupport();

  const baseShareText = cleanedRecipient
    ? `🎆 Special New Year ${YEAR} 3D Wish for ${cleanedRecipient} from ${cleanedSender}! ✨`
    : formatTemplate(m.share, YEAR, cleanedSender);

  const shareTextWithPw =
    config.passwordProtected && rawPassword
      ? `${baseShareText}\n🔒 Secret Unlock Password: ${rawPassword}`
      : baseShareText;

  const enc = encodeURIComponent;
  const waUrl = `https://api.whatsapp.com/send?text=${enc(
    shareTextWithPw + '\n' + link
  )}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${enc(link)}`;
  const tgUrl = `https://t.me/share/url?url=${enc(link)}&text=${enc(
    shareTextWithPw
  )}`;
  const xUrl = `https://twitter.com/intent/tweet?text=${enc(
    baseShareText
  )}&url=${enc(link)}`;

  const handleNativeShare = () => {
    trackShareClick({
      platform: 'native',
      lang,
      animId: config.animationId,
      msgId: config.messageId,
    });
    if (navigator.share) {
      navigator
        .share({
          title: `Happy New Year ${YEAR} - ${cleanedSender}`,
          text: shareTextWithPw,
          url: link,
        })
        .catch(() => {});
    } else {
      onCopy(link);
    }
  };

  const handleDownloadHDImage = async () => {
    if (imgProgress !== null) return;
    setExportErr('');
    setImgProgress(5);
    try {
      await exportWishAsHDImage(config, formattedMessageText, (pct) =>
        setImgProgress(pct)
      );
    } catch (err) {
      setExportErr(
        err instanceof Error
          ? err.message
          : 'Could not generate HD Image on this device.'
      );
    } finally {
      window.setTimeout(() => setImgProgress(null), 600);
    }
  };

  const handleDownloadAnimatedVideo = async () => {
    if (vidProgress !== null) return;
    setExportErr('');
    if (!videoCap.supported) {
      setExportErr(
        videoCap.reason ||
          'Animated video recording is not supported by this browser. Please use HD Image Download.'
      );
      return;
    }
    setVidProgress(5);
    try {
      await exportWishAsAnimatedVideo(config, formattedMessageText, (pct) =>
        setVidProgress(pct)
      );
    } catch (err) {
      setExportErr(
        err instanceof Error
          ? err.message
          : 'Could not encode animated video on this device.'
      );
    } finally {
      window.setTimeout(() => setVidProgress(null), 700);
    }
  };

  const rsParts = T.rs.split('{n}');

  return (
    <div className="wx-box wx-share" id="wx-share-panel">
      <div className="wx-ok">🎉</div>
      <h2 className="wx-h2">{T.rt}</h2>
      <p className="wx-sub">
        {rsParts[0]}
        <b>{cleanedSender}</b>
        {rsParts[1] || ''}
        {cleanedRecipient ? ` (For ${cleanedRecipient})` : ''}
      </p>

      {/* Primary WhatsApp Share Button */}
      <a
        className="wx-wa-big"
        target="_blank"
        rel="noopener noreferrer"
        href={waUrl}
        onClick={() =>
          trackShareClick({
            platform: 'whatsapp',
            lang,
            animId: ANIM_IDS[animIndex] || 'sparkler',
            msgId: config.messageId,
          })
        }
      >
        {Icons.wa}
        <span>
          {config.passwordProtected && rawPassword
            ? `${T.wa} (Link + Password)`
            : T.wa}
        </span>
      </a>

      {/* Secondary Social Share Row: Telegram, Facebook, X, Native Share / More */}
      <div className="wx-srow">
        <a
          className="s-tg"
          target="_blank"
          rel="noopener noreferrer"
          href={tgUrl}
          onClick={() =>
            trackShareClick({
              platform: 'telegram',
              lang,
              animId: ANIM_IDS[animIndex] || 'sparkler',
              msgId: config.messageId,
            })
          }
        >
          {Icons.tg}
          <span>Telegram</span>
        </a>
        <a
          className="s-fb"
          target="_blank"
          rel="noopener noreferrer"
          href={fbUrl}
          onClick={() =>
            trackShareClick({
              platform: 'facebook',
              lang,
              animId: ANIM_IDS[animIndex] || 'sparkler',
              msgId: config.messageId,
            })
          }
        >
          {Icons.fb}
          <span>Facebook</span>
        </a>
        <a
          className="s-x"
          target="_blank"
          rel="noopener noreferrer"
          href={xUrl}
          onClick={() =>
            trackShareClick({
              platform: 'x',
              lang,
              animId: ANIM_IDS[animIndex] || 'sparkler',
              msgId: config.messageId,
            })
          }
        >
          {Icons.x}
          <span>X</span>
        </a>
        <button type="button" className="s-more" onClick={handleNativeShare}>
          {Icons.more}
          <span>{T.more}</span>
        </button>
      </div>

      {/* Password Protected Wish Controls: Copy Link, Copy Password, Share Link + Password */}
      {config.passwordProtected && (
        <div className="wx-pw-share-box">
          <div className="text-xs font-extrabold text-amber-300">
            🔒 Password Protected Wish Active
          </div>
          <p className="text-[11.5px] text-amber-100/80 mt-0.5">
            Recipients will be asked for the secret password before your wish
            opens.
          </p>
          <div className="wx-pw-share-btns">
            <button
              type="button"
              className="wx-pw-chip-btn"
              onClick={() => onCopy(link, 'Wish Link copied!')}
            >
              🔗 Copy Wish Link
            </button>
            {rawPassword && (
              <>
                <button
                  type="button"
                  className="wx-pw-chip-btn"
                  onClick={() =>
                    onCopy(rawPassword, 'Secret Password copied!')
                  }
                >
                  🔑 Copy Password ({rawPassword})
                </button>
                <button
                  type="button"
                  className="wx-pw-chip-btn"
                  onClick={() =>
                    onCopy(
                      `${shareTextWithPw}\n${link}`,
                      'Link + Password copied!'
                    )
                  }
                >
                  📋 Copy Link + Password
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Copy Link Box */}
      <div className="wx-link" dir="ltr">
        <input
          readOnly
          aria-label="Shareable personalized wish link"
          value={link}
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <button
          type="button"
          onClick={() => {
            trackShareClick({
              platform: 'copy_link',
              lang,
              animId: ANIM_IDS[animIndex] || 'sparkler',
              msgId: config.messageId,
            });
            onCopy(link);
          }}
        >
          {Icons.copy}
          <span>{T.copy}</span>
        </button>
      </div>

      {/* Phase 2 Download System: HD Image Download & Animated Video Download + QR Code Toggle */}
      <div className="wx-download-grid">
        <button
          type="button"
          className="wx-dl-btn"
          onClick={handleDownloadHDImage}
          disabled={imgProgress !== null}
        >
          <span>🖼️</span>
          <span>
            {imgProgress !== null
              ? `Rendering HD Image (${imgProgress}%)...`
              : 'Download HD Wish Image'}
          </span>
        </button>

        <button
          type="button"
          className="wx-dl-btn"
          onClick={handleDownloadAnimatedVideo}
          disabled={vidProgress !== null}
        >
          <span>🎬</span>
          <span>
            {vidProgress !== null
              ? `Recording 3D Video (${vidProgress}%)...`
              : 'Download Animated Video'}
          </span>
        </button>
      </div>

      {exportErr && <p className="wx-err mb-2">{exportErr}</p>}

      {/* QR Code Generator Toggle & Designer (3 Luxury Styles) */}
      <div className="mt-2">
        <button
          type="button"
          className="wx-dl-btn w-full"
          onClick={() => setShowQR((v) => !v)}
        >
          <span>📱</span>
          <span>
            {showQR
              ? 'Hide Luxury Wish QR Code'
              : '👑 Generate Scannable Wish QR Code (3 Styles)'}
          </span>
        </button>

        {showQR && (
          <QRCodeDesigner
            wishUrl={link}
            senderName={cleanedSender}
            recipientName={cleanedRecipient}
          />
        )}
      </div>

      <p className="wx-tip mt-3">{T.tip}</p>

      <div className="wx-share-actions">
        {onPreviewGiftGate && (
          <button
            type="button"
            className="wx-again"
            onClick={onPreviewGiftGate}
          >
            {T.previewGift}
          </button>
        )}
        <button type="button" className="wx-again" onClick={onOpenStudio}>
          ✨ Customize in Creator Studio
        </button>
      </div>
    </div>
  );
};

/* ---------- Prominent Create Your Own Wish CTA Component ---------- */
const CreateYourOwnCTA: React.FC<{
  lang: LangCode;
  onOpenCreator: () => void;
}> = ({ lang, onOpenCreator }) => {
  const T = UI[lang];
  return (
    <div className="wx-creator-cta">
      <button
        type="button"
        className="wx-creator-btn"
        onClick={onOpenCreator}
      >
        <span>🎉 CREATE YOUR OWN WISH 🎉</span>
      </button>
      <p className="wx-creator-sub">
        Create your own personalized New Year wishes and share happiness with everyone!
        {lang !== 'en' && (
          <span className="wx-creator-sub-local">
            {formatTemplate(T.owns, YEAR)}
          </span>
        )}
      </p>
    </div>
  );
};

/* ---------- Featured 3D Animations Showcase (Tab 3: Featured) ---------- */
const FeaturedWishesView: React.FC<{
  lang: LangCode;
  selectedAnimId: AnimId;
  onPreviewAnim: (animId: AnimId) => void;
  onCustomizeAnim: (animId: AnimId) => void;
}> = ({ lang, selectedAnimId, onPreviewAnim, onCustomizeAnim }) => {
  const T = UI[lang];
  return (
    <div className="wx-wrap wx-featured-section">
      <div className="wx-box">
        <h2 className="wx-h2">✨ Featured {YEAR} 3D Wish Themes</h2>
        <p className="wx-sub">
          Explore all 9 signature 3D New Year {YEAR} experiences. Tap any theme
          to preview or personalize in the Creator Studio.
        </p>

        <div className="wx-grid mt-4">
          {ANIM_IDS.map((id, i) => (
            <MiniAnimCard
              key={id}
              animId={id}
              index={i}
              selected={selectedAnimId === id}
              label={T.animNames[id] || ANIM[id].name}
              onSelect={(idx) => onPreviewAnim(ANIM_IDS[idx] || 'fireworks')}
            />
          ))}
        </div>

        <div className="wx-featured-grid">
          {ANIM_IDS.map((id, i) => {
            const A = ANIM[id];
            const title = T.animNames[id] || A.name;
            return (
              <div className="wx-featured-card" key={id}>
                <div className="wx-featured-card-top">
                  <span className="text-2xl">{A.ico}</span>
                  <span className="wx-featured-badge">3D Theme #{i + 1}</span>
                </div>
                <div className="wx-featured-title">{title}</div>
                <p className="wx-featured-desc">
                  Interactive {A.name} 3D celebration with metallic golden{' '}
                  {YEAR} reveal and synchronized music.
                </p>
                <div className="wx-featured-actions">
                  <button
                    type="button"
                    className="wx-featured-btn"
                    onClick={() => onCustomizeAnim(id)}
                  >
                    <span>✨ Open in Creator Studio</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ---------- Main Application ---------- */
export default function App() {
  const initial = useRef(parseUrlState());

  const [lang, setLang] = useState<LangCode>(initial.current.config.language);
  const [activePage, setActivePage] = useState<PageId | null>(
    initial.current.page
  );

  // Mode: 'home' when no shared wish params in URL, 'wish' when shared wish is opened
  const [isWishView, setIsWishView] = useState<boolean>(
    initial.current.isSharedWish
  );

  // 8-Second Cinematic Intro runs when landing on the Homepage (never on shared wish links)
  const [showIntro, setShowIntro] = useState<boolean>(
    !initial.current.isSharedWish && !initial.current.page
  );

  // Mobile bottom navigation tab ('home' | 'create' | 'featured')
  const [activeTab, setActiveTab] = useState<MobileNavTab>('home');

  // Active WishConfig (used for the displayed shared wish & homepage showcase)
  const [wishConfig, setWishConfig] = useState<WishConfig>(() => {
    const savedSender = cleanName(getSafeStorage('wx_name'));
    const cfg = initial.current.config;
    return {
      ...cfg,
      senderName: cfg.senderName || savedSender,
    };
  });

  // Full-Screen Creator Studio State (Never opens automatically on shared wish links; no draft persistence if user exits without publishing)
  const [studioOpen, setStudioOpen] = useState<boolean>(false);
  const [studioDraft, setStudioDraft] = useState<WishConfig>(() =>
    createDefaultWishConfig({
      language: initial.current.config.language,
      senderName: cleanName(getSafeStorage('wx_name')) || '',
    })
  );
  const [studioRawPassword, setStudioRawPassword] = useState<string>('');
  const [publishedRawPassword, setPublishedRawPassword] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState<boolean>(false);

  const [homeShareExpanded, setHomeShareExpanded] = useState<boolean>(false);

  // Password Lock Gate state for recipients opening a password-protected wish
  const [isPasswordLocked, setIsPasswordLocked] = useState<boolean>(
    initial.current.config.passwordProtected
  );
  const [unlockPasswordInput, setUnlockPasswordInput] = useState<string>('');
  const [unlockError, setUnlockError] = useState<string>('');
  const [isUnlocking, setIsUnlocking] = useState<boolean>(false);

  // Gift Opening Experience state
  const [isCreatorSession, setIsCreatorSession] = useState<boolean>(false);
  const [giftGateOpen, setGiftGateOpen] = useState<boolean>(false);
  const [gateClosing, setGateClosing] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string>('');
  const [adminPortalOpen, setAdminPortalOpen] = useState<boolean>(false);

  const shareSectionRef = useRef<HTMLDivElement | null>(null);
  const logoHoldTimerRef = useRef<number | null>(null);
  const logoLongPressTriggeredRef = useRef<boolean>(false);
  const visitTrackedRef = useRef<boolean>(false);

  const T = UI[lang];
  const currentMsg =
    MSG[wishConfig.messageId] || MSG[LANG_DEFAULT_MSG[lang] ?? 1] || MSG[0];

  // Track initial page visit and start 30-second live visitor heartbeat
  useEffect(() => {
    if (!visitTrackedRef.current) {
      visitTrackedRef.current = true;
      trackPageVisit(initial.current.config.language);
    }
    const hbId = window.setInterval(() => {
      sendVisitorHeartbeat();
    }, 30000);
    return () => window.clearInterval(hbId);
  }, []);

  // Fetch stored wish payload when a shared link includes `?wid=...`
  useEffect(() => {
    const wid = wishConfig.wishId;
    if (!wid || isCreatorSession) return;

    let cancelled = false;
    const loadStoredWish = async () => {
      try {
        const res = await fetch(`/api/wishes/${encodeURIComponent(wid)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.locked) {
          setIsPasswordLocked(true);
          setWishConfig((prev) => ({
            ...prev,
            senderName: data.senderName || prev.senderName,
            recipientName: data.recipientName || prev.recipientName,
            passwordProtected: true,
          }));
        } else if (data.wish) {
          setIsPasswordLocked(false);
          setWishConfig((prev) => ({
            ...prev,
            ...data.wish,
          }));
          if (data.wish.language) {
            setLang(data.wish.language);
          }
        }
      } catch {
        // Fallback gracefully to URL parameters if offline
      }
    };
    loadStoredWish();
    return () => {
      cancelled = true;
    };
  }, [wishConfig.wishId, isCreatorSession]);

  // Unlock a password-protected wish via POST /api/wishes/:wishId/unlock
  const handleUnlockProtectedWish = async (e: React.FormEvent) => {
    e.preventDefault();
    const wid = wishConfig.wishId;
    const pw = unlockPasswordInput.trim();
    if (!pw) {
      setUnlockError('Please enter the secret password.');
      return;
    }

    if (!wid) {
      setIsPasswordLocked(false);
      return;
    }

    setIsUnlocking(true);
    setUnlockError('');
    try {
      const res = await fetch(`/api/wishes/${encodeURIComponent(wid)}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (!res.ok || !data.wish) {
        setUnlockError(
          data.error || 'Incorrect password. Please try again.'
        );
        return;
      }
      setWishConfig((prev) => ({
        ...prev,
        ...data.wish,
      }));
      if (data.wish.language) {
        setLang(data.wish.language);
      }
      setIsPasswordLocked(false);
    } catch {
      setUnlockError('Could not verify password right now. Please try again.');
    } finally {
      setIsUnlocking(false);
    }
  };

  // Hidden 5-second continuous logo press handler for Admin Access
  const handleLogoPressStart = useCallback(() => {
    logoLongPressTriggeredRef.current = false;
    if (logoHoldTimerRef.current) {
      window.clearTimeout(logoHoldTimerRef.current);
    }
    logoHoldTimerRef.current = window.setTimeout(() => {
      logoLongPressTriggeredRef.current = true;
      if (navigator.vibrate) {
        try {
          navigator.vibrate(50);
        } catch {
          // ignore
        }
      }
      setAdminPortalOpen(true);
    }, 5000);
  }, []);

  const handleLogoPressCancel = useCallback(() => {
    if (logoHoldTimerRef.current) {
      window.clearTimeout(logoHoldTimerRef.current);
      logoHoldTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (logoHoldTimerRef.current) {
        window.clearTimeout(logoHoldTimerRef.current);
      }
    };
  }, []);

  // Sync HTML lang, title, and canonical link
  useEffect(() => {
    document.documentElement.lang = lang === 'hinglish' ? 'hi-Latn' : lang;
    document.documentElement.dir = T.dir || 'ltr';

    if (activePage) {
      const pg = STATIC_PAGES[activePage];
      document.title = `${pg.title} | New Year Wishes ${YEAR}`;
    } else if (isWishView && wishConfig.senderName) {
      document.title = `${cleanName(
        wishConfig.senderName
      )} sent you a Happy New Year ${YEAR} wish 🎆`;
    } else {
      document.title = `New Year Wishes ${YEAR} | ${formatTemplate(
        T.h1,
        YEAR
      )} ${T.h1b}`;
    }

    const canonicalEl = document.getElementById(
      'wx-canonical'
    ) as HTMLLinkElement | null;
    if (canonicalEl) {
      canonicalEl.href = window.location.href.split('#')[0];
    }
  }, [lang, T, activePage, isWishView, wishConfig.senderName]);

  // Listen to browser back/forward navigation
  useEffect(() => {
    const onPopState = () => {
      const st = parseUrlState();
      setLang(st.config.language);
      setActivePage(st.page);
      setStudioOpen(false);
      setActiveTab('home');
      setWishConfig(st.config);
      setIsPasswordLocked(st.config.passwordProtected);
      if (st.isSharedWish) {
        setIsWishView(true);
        setIsCreatorSession(false);
        setGiftGateOpen(false);
        setGateClosing(false);
      } else {
        setIsWishView(false);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(''), 2300);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  const handleCopyText = useCallback(
    (txt: string, customToast?: string) => {
      const done = () => showToast(customToast || UI[lang].copied);
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard
          .writeText(txt)
          .then(done)
          .catch(() => fallbackCopy(txt, done));
      } else {
        fallbackCopy(txt, done);
      }
    },
    [lang, showToast]
  );

  function fallbackCopy(txt: string, onDone: () => void) {
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.className = 'sr-only';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      onDone();
    } catch {
      // ignore
    }
    ta.remove();
  }

  // Handle manual language switch
  const handleLanguageChange = useCallback(
    (newLang: LangCode) => {
      setLang(newLang);
      setSafeStorage('wx_lang', newLang);
      const defMsg = LANG_DEFAULT_MSG[newLang] ?? 1;

      setWishConfig((prev) => {
        const nextTpl = prev.isCustomMessage
          ? prev.customMessage
          : getTemplatesForLanguageAndCategory(
              newLang,
              prev.messageCategory
            )[0]?.text ||
            MSG[defMsg]?.text ||
            prev.customMessage;
        return {
          ...prev,
          language: newLang,
          messageId: defMsg,
          customMessage: nextTpl,
        };
      });

      setStudioDraft((prev) => {
        const nextTpl = prev.isCustomMessage
          ? prev.customMessage
          : getTemplatesForLanguageAndCategory(
              newLang,
              prev.messageCategory
            )[0]?.text ||
            MSG[defMsg]?.text ||
            prev.customMessage;
        return {
          ...prev,
          language: newLang,
          messageId: defMsg,
          customMessage: nextTpl,
        };
      });

      const sp = new URLSearchParams(window.location.search);
      if (sp.has('n') || sp.has('lang') || sp.has('wid')) {
        sp.set('lang', newLang);
        const newUrl = `${getBaseUrl()}?${sp.toString()}`;
        window.history.replaceState({}, '', newUrl);
      }
    },
    []
  );

  // Open Full-Screen Creator Studio with a fresh draft (and automatic random active song)
  const handleOpenCreator = useCallback(
    (preselectedAnimId?: AnimId) => {
      setActivePage(null);
      setActiveTab('create');
      const randomSongId = MUSIC.pickRandomActiveSongId(wishConfig.musicId);
      MUSIC.selectSong(randomSongId, false);
      const savedSender = cleanName(getSafeStorage('wx_name')) || '';
      const defMsgId = LANG_DEFAULT_MSG[lang] ?? 1;
      const defaultTpl =
        getTemplatesForLanguageAndCategory(lang, 'Best Wishes')[0]?.text ||
        MSG[defMsgId]?.text ||
        MSG[0].text;

      setStudioDraft(
        createDefaultWishConfig({
          language: lang,
          senderName: savedSender,
          recipientName: '',
          animationId: preselectedAnimId || wishConfig.animationId || 'fireworks',
          messageId: defMsgId,
          messageCategory: 'Best Wishes',
          customMessage: defaultTpl,
          isCustomMessage: false,
          musicMode: 'auto',
          musicId: randomSongId,
        })
      );
      setStudioRawPassword('');
      setStudioOpen(true);
    },
    [lang, wishConfig.animationId, wishConfig.musicId]
  );

  // Exit Creator Studio without saving draft (per Section 15: no draft persistence if user exits before generating)
  const handleCloseCreatorWithoutSaving = useCallback(() => {
    setStudioOpen(false);
    setStudioRawPassword('');
    setActiveTab('home');
  }, []);

  // Handle "SHARE YOUR WISH" button on Homepage
  const handleShareYourWishClick = useCallback(() => {
    const activeSender = cleanName(wishConfig.senderName);
    if (!activeSender) {
      handleOpenCreator();
      return;
    }
    setHomeShareExpanded(true);
    window.setTimeout(() => {
      shareSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 60);
  }, [wishConfig.senderName, handleOpenCreator]);

  // Publish Personalized Wish from Creator Studio
  const handlePublishStudioWish = async () => {
    const cleanedSender = cleanName(studioDraft.senderName);
    if (!cleanedSender) return;
    const cleanedRecipient = cleanName(studioDraft.recipientName);

    setIsPublishing(true);
    let assignedWishId = '';

    // Persist wish config to backend when it has a photo, custom background, password lock, or custom message
    const needsBackendRecord = Boolean(
      studioDraft.photoDataUrl ||
        studioDraft.customBgDataUrl ||
        studioDraft.passwordProtected ||
        studioDraft.recipientName ||
        studioDraft.customMessage
    );

    const finalizedConfig: WishConfig = {
      ...studioDraft,
      senderName: cleanedSender,
      recipientName: cleanedRecipient,
      customMessage: cleanCustomText(studioDraft.customMessage),
      createdAt: new Date().toISOString(),
    };

    if (needsBackendRecord) {
      try {
        const res = await fetch('/api/wishes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wish: finalizedConfig,
            password: finalizedConfig.passwordProtected
              ? studioRawPassword.trim()
              : undefined,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.wishId) {
            assignedWishId = data.wishId;
          }
        }
      } catch {
        // Proceed with URL params if backend is unreachable
      }
    }

    const publishedConfig: WishConfig = {
      ...finalizedConfig,
      wishId: assignedWishId,
    };

    setWishConfig(publishedConfig);
    setLang(publishedConfig.language);
    setPublishedRawPassword(
      publishedConfig.passwordProtected ? studioRawPassword.trim() : ''
    );
    setIsPasswordLocked(false);
    setSafeStorage('wx_name', cleanedSender);

    trackWishCreated({
      name: cleanedSender,
      lang: publishedConfig.language,
      animId: publishedConfig.animationId,
      msgId: publishedConfig.messageId,
    });

    const url = buildWishUrlFromConfig(publishedConfig);
    window.history.pushState({}, '', url);

    setIsPublishing(false);
    setStudioOpen(false);
    setActivePage(null);
    setIsWishView(true);
    setIsCreatorSession(true);
    setActiveTab('home');
    setGiftGateOpen(true);
    setGateClosing(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Tap to Open Gift Box handler
  const handleOpenGift = () => {
    if (gateClosing || giftGateOpen) return;
    SND.set(true);
    SND.open();
    trackGiftOpened({
      lang,
      animId: wishConfig.animationId,
      msgId: wishConfig.messageId,
    });
    if (navigator.vibrate) {
      try {
        navigator.vibrate(40);
      } catch {
        // ignore
      }
    }
    setGateClosing(true);
    window.setTimeout(() => {
      setGiftGateOpen(true);
      setGateClosing(false);
    }, 680);
  };

  // Triggered when the creator wants to experience the Gift Opening screen
  const handlePreviewGiftExperience = () => {
    setIsCreatorSession(false);
    setStudioOpen(false);
    setActiveTab('home');
    setGiftGateOpen(false);
    setGateClosing(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Navigate to Home view
  const handleGoHome = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setActivePage(null);
    setIsWishView(false);
    setIsCreatorSession(false);
    setStudioOpen(false);
    setHomeShareExpanded(false);
    setActiveTab('home');
    const url = lang !== 'hi' ? `${getBaseUrl()}?lang=${lang}` : getBaseUrl();
    window.history.pushState({}, '', url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Navigate to Legal/Footer Page
  const handleOpenPage = (pageId: PageId, e: React.MouseEvent) => {
    e.preventDefault();
    setActivePage(pageId);
    setStudioOpen(false);
    const url = `${getBaseUrl()}?page=${pageId}&lang=${lang}`;
    window.history.pushState({}, '', url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle Mobile Bottom Navigation Bar tab switch
  const handleMobileNavSelect = (tab: MobileNavTab) => {
    setActivePage(null);
    if (tab === 'home') {
      setActiveTab('home');
      setStudioOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tab === 'create') {
      handleOpenCreator();
    } else if (tab === 'featured') {
      setStudioOpen(false);
      setActiveTab('featured');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const cleanedDisplayName = cleanName(wishConfig.senderName) || T.defaultName;
  const showGiftGate =
    isWishView && !isCreatorSession && !giftGateOpen && !isPasswordLocked;
  const shouldStageAutoStart =
    !isPasswordLocked && (!isWishView || isCreatorSession || giftGateOpen);

  const selectorLanguages = React.useMemo(() => {
    if (PHASE1_LANGS.includes(lang)) return PHASE1_LANGS;
    return [lang, ...PHASE1_LANGS];
  }, [lang]);

  return (
    <div
      className={[
        activePage ? 'v-post' : isWishView ? 'v-wish' : 'v-home',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Celebration City Night Skyline & Floating Golden Particles Backdrop */}
      <div className="wx-city-backdrop" aria-hidden="true">
        <div className="wx-city-glow" />
        <div className="wx-city-skyline" />
        <div className="wx-particles-layer" />
      </div>

      {/* 8-Second Cinematic Intro Overlay */}
      {showIntro && (
        <CinematicIntro
          lang={lang}
          onComplete={() => setShowIntro(false)}
        />
      )}

      {/* Full-Screen Phase 2 Creator Studio */}
      {studioOpen && (
        <CreatorStudio
          config={studioDraft}
          rawPassword={studioRawPassword}
          onChangeConfig={setStudioDraft}
          onChangePassword={setStudioRawPassword}
          onLanguageSwitch={handleLanguageChange}
          onBack={handleCloseCreatorWithoutSaving}
          onPublish={handlePublishStudioWish}
          isPublishing={isPublishing}
          renderLiveStage={() => (
            <WishStage
              mode="home"
              extraClass="live"
              config={studioDraft}
              placeholderName={UI[studioDraft.language].defaultName}
              autoStart={true}
              showLiveBadge={true}
              liveBadgeText={UI[studioDraft.language].live}
            />
          )}
          renderMiniAnimCard={(id, idx, selected, label, onSelect) => (
            <MiniAnimCard
              key={id}
              animId={id}
              index={idx}
              selected={selected}
              label={label}
              onSelect={onSelect}
            />
          )}
        />
      )}

      {/* Top Luxury Header */}
      <header className="wx-top">
        <div className="wx-wrap">
          <a
            className="wx-logo select-none"
            href={getBaseUrl()}
            onMouseDown={handleLogoPressStart}
            onMouseUp={handleLogoPressCancel}
            onMouseLeave={handleLogoPressCancel}
            onTouchStart={handleLogoPressStart}
            onTouchEnd={handleLogoPressCancel}
            onTouchCancel={handleLogoPressCancel}
            onContextMenu={(e) => {
              if (logoHoldTimerRef.current) e.preventDefault();
            }}
            onClick={(e) => {
              if (logoLongPressTriggeredRef.current) {
                e.preventDefault();
                logoLongPressTriggeredRef.current = false;
                return;
              }
              handleGoHome(e);
            }}
          >
            <i>🎆</i>
            <span>
              New Year Wishes <b>{YEAR}</b>
            </span>
          </a>

          <div className="wx-top-right">
            {!isWishView && !activePage && (
              <button
                type="button"
                className="wx-intro-replay-chip"
                onClick={() => setShowIntro(true)}
              >
                🎬 Intro
              </button>
            )}
            <select
              className="wx-lang"
              aria-label="Select Language / भाषा चुनें"
              value={lang}
              onChange={(e) => handleLanguageChange(e.target.value as LangCode)}
            >
              {selectorLanguages.map((code) => (
                <option key={code} value={code}>
                  🌐 {UI[code].nativeLabel}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* 1. STATIC / LEGAL PAGE VIEW (About, Contact, Privacy, Disclaimer, Terms) */}
      {activePage && (
        <article className="wx-post" id="wx-post">
          <a className="wx-cta" href={getBaseUrl()} onClick={handleGoHome}>
            <span>
              🎆 {formatTemplate(T.h1, YEAR)} — {T.make}
            </span>
            <b>Start ›</b>
          </a>

          <div className="wx-post-in">
            <h1>
              {lang === 'hi'
                ? STATIC_PAGES[activePage].titleHi
                : STATIC_PAGES[activePage].title}
            </h1>
            <div className="wx-post-body">
              {STATIC_PAGES[activePage].sections.map((sec, idx) => (
                <div key={idx}>
                  {sec.heading && <h2>{sec.heading}</h2>}
                  {sec.paragraphs.map((p, pi) => (
                    <p key={pi}>{p}</p>
                  ))}
                  {sec.bullets && (
                    <ul>
                      {sec.bullets.map((b, bi) => (
                        <li key={bi}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </article>
      )}

      {/* 2. FEATURED TAB VIEW (Curated 9 3D Animations Showcase) */}
      {!activePage && activeTab === 'featured' && (
        <FeaturedWishesView
          lang={lang}
          selectedAnimId={wishConfig.animationId}
          onPreviewAnim={(animId) => {
            setWishConfig((prev) => ({ ...prev, animationId: animId }));
            setActiveTab('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onCustomizeAnim={(animId) => {
            handleOpenCreator(animId);
          }}
        />
      )}

      {/* 3. CLEAN LUXURY HOMEPAGE VIEW */}
      {!activePage && activeTab !== 'featured' && !isWishView && (
        <>
          <div className="wx-wrap" id="wx-app-b">
            {/* Giant 3D Golden 2027 Title */}
            <div className="wx-hero-luxury">
              <div className="wx-hero-kicker">
                <span>✨ Celebration City Edition</span>
              </div>
              <div className="wx-giant-2027" aria-hidden="true">
                {YEAR}
              </div>
              <h1 className="wx-h1">
                {formatTemplate(T.h1, YEAR)} <span>{T.h1b}</span>
              </h1>
            </div>

            {/* Cinematic Countdown with Celebration Mode */}
            <ISTCountdown lang={lang} />

            {/* Personalized Wish Showcase with Golden Reveal & Replay Control */}
            <div className="wx-prev">
              <WishStage
                mode="home"
                extraClass="live"
                config={wishConfig}
                placeholderName={T.defaultName}
                autoStart={true}
                showLiveBadge={true}
                liveBadgeText={T.live}
              />
            </div>

            {/* Luxury Gold Action Buttons: CREATE YOUR OWN WISH & SHARE YOUR WISH */}
            <div className="wx-home-luxury-actions">
              <button
                type="button"
                className="wx-gold-btn-primary"
                onClick={() => handleOpenCreator()}
              >
                <span>✨ CREATE YOUR OWN WISH</span>
              </button>
              <button
                type="button"
                className="wx-gold-btn-secondary"
                onClick={handleShareYourWishClick}
              >
                {Icons.wa}
                <span>SHARE YOUR WISH</span>
              </button>
            </div>
          </div>

          {/* Optional Instant Share Panel on Homepage when SHARE YOUR WISH is clicked */}
          {homeShareExpanded && (
            <div className="wx-wrap" ref={shareSectionRef}>
              <SharePanel
                config={wishConfig}
                rawPassword={publishedRawPassword}
                onCopy={handleCopyText}
                onOpenStudio={() => handleOpenCreator()}
              />
            </div>
          )}
        </>
      )}

      {/* 4. SHARED WISH LINK EXPERIENCE (?n=...&a=...&w=...&lang=...) */}
      {!activePage && activeTab !== 'featured' && isWishView && (
        <>
          {/* 1. Show sender's personalized wish first (with Password Lock Gate or 3D Gift Opening gate) */}
          <div id="wx-app-a">
            <WishStage
              mode="wish"
              extraClass="full"
              config={wishConfig}
              placeholderName={T.defaultName}
              autoStart={shouldStageAutoStart}
              readyBannerText={isCreatorSession ? T.ready : undefined}
              gateContent={
                isPasswordLocked ? (
                  <div
                    className="wx-pw-gate"
                    role="dialog"
                    aria-label="Password Protected New Year Wish"
                  >
                    <form
                      className="wx-pw-gate-card"
                      onSubmit={handleUnlockProtectedWish}
                    >
                      <div className="text-4xl mb-2">🔒</div>
                      <h2 className="wx-h2">Secret New Year {YEAR} Wish</h2>
                      <p className="wx-sub mb-3">
                        <b>{cleanedDisplayName}</b> protected this special wish
                        with a secret password. Enter the password below to
                        unlock!
                      </p>
                      <div className="wx-inp mb-3">
                        <input
                          type="password"
                          placeholder="Enter secret password..."
                          aria-label="Wish unlock password"
                          value={unlockPasswordInput}
                          onChange={(e) => {
                            setUnlockError('');
                            setUnlockPasswordInput(e.target.value);
                          }}
                        />
                        <span>🔑</span>
                      </div>
                      {unlockError && (
                        <p className="wx-err mb-2">{unlockError}</p>
                      )}
                      <button
                        type="submit"
                        className="wx-gold-btn-primary w-full"
                        disabled={isUnlocking}
                      >
                        <span>
                          {isUnlocking
                            ? '⏳ Unlocking Wish...'
                            : '🔓 Unlock Special Wish'}
                        </span>
                      </button>
                    </form>
                  </div>
                ) : showGiftGate ? (
                  <div
                    className={`wx-gate ${gateClosing ? 'gone' : ''}`}
                    onClick={handleOpenGift}
                    role="button"
                    tabIndex={0}
                    aria-label={`${cleanedDisplayName} ${currentMsg.gate}. ${currentMsg.open}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenGift();
                      }
                    }}
                  >
                    <div className="wx-gift">{Icons.giftBox}</div>
                    <div className="wx-gt" dir={currentMsg.dir || 'ltr'}>
                      <b>{cleanedDisplayName}</b> {currentMsg.gate}
                      {wishConfig.recipientName ? (
                        <div className="text-sm text-amber-200 mt-1">
                          ✨ Especially for <b>{wishConfig.recipientName}</b> ✨
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="wx-open"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenGift();
                      }}
                    >
                      <span>{currentMsg.open} ✨</span>
                    </button>
                  </div>
                ) : null
              }
            />
          </div>

          {/* 2. Prominent CREATE YOUR OWN WISH & SHARE YOUR WISH actions + Countdown */}
          <div className="wx-wrap" id="wx-app-b">
            <div className="wx-home-luxury-actions">
              <button
                type="button"
                className="wx-gold-btn-primary"
                onClick={() => handleOpenCreator()}
              >
                <span>🎉 CREATE YOUR OWN WISH</span>
              </button>
              <button
                type="button"
                className="wx-gold-btn-secondary"
                onClick={() => {
                  shareSectionRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                  });
                }}
              >
                {Icons.wa}
                <span>SHARE YOUR WISH</span>
              </button>
            </div>

            {/* Live IST Countdown */}
            <ISTCountdown lang={lang} />

            {/* 3. Creator CTA opens full-screen Creator Studio on click */}
            <div id="wx-app-c">
              <CreateYourOwnCTA
                lang={lang}
                onOpenCreator={() => handleOpenCreator()}
              />
            </div>

            {/* Social Sharing, HD Image/Video Download & QR Code Panel */}
            <div ref={shareSectionRef}>
              <SharePanel
                config={wishConfig}
                rawPassword={publishedRawPassword}
                onCopy={handleCopyText}
                onOpenStudio={() => handleOpenCreator()}
                onPreviewGiftGate={
                  isCreatorSession ? handlePreviewGiftExperience : undefined
                }
              />
            </div>
          </div>
        </>
      )}

      {/* Footer with Required Legal Pages */}
      <footer className="wx-foot">
        <div className="wx-wrap">
          <nav
            className="wx-flinks"
            aria-label="Footer legal and informational links"
          >
            <ul>
              <li>
                <a
                  href="?page=about"
                  onClick={(e) => handleOpenPage('about', e)}
                >
                  About Us
                </a>
              </li>
              <li>
                <a
                  href="?page=contact"
                  onClick={(e) => handleOpenPage('contact', e)}
                >
                  Contact Us
                </a>
              </li>
              <li>
                <a
                  href="?page=privacy"
                  onClick={(e) => handleOpenPage('privacy', e)}
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="?page=disclaimer"
                  onClick={(e) => handleOpenPage('disclaimer', e)}
                >
                  Disclaimer
                </a>
              </li>
              <li>
                <a
                  href="?page=terms"
                  onClick={(e) => handleOpenPage('terms', e)}
                >
                  Terms and Conditions
                </a>
              </li>
            </ul>
          </nav>
          <p>
            © {YEAR} New Year Wishes {YEAR} · Luxury 3D Personalized Celebration
            Experience
          </p>
        </div>
      </footer>

      {/* Premium Mobile Bottom Navigation Bar (1. Home | 2. Create Wish | 3. Featured) */}
      <nav className="wx-mobile-nav" aria-label="Primary Mobile Navigation">
        <div className="wx-mobile-nav-inner">
          <button
            type="button"
            className={`wx-nav-item ${
              !activePage && activeTab === 'home' && !studioOpen
                ? 'active'
                : ''
            }`}
            onClick={() => handleMobileNavSelect('home')}
          >
            {Icons.home}
            <span>Home</span>
          </button>

          <button
            type="button"
            className={`wx-nav-item ${
              !activePage && (activeTab === 'create' || studioOpen)
                ? 'active'
                : ''
            }`}
            onClick={() => handleMobileNavSelect('create')}
          >
            {Icons.create}
            <span>Create Wish</span>
          </button>

          <button
            type="button"
            className={`wx-nav-item ${
              !activePage && activeTab === 'featured' && !studioOpen
                ? 'active'
                : ''
            }`}
            onClick={() => handleMobileNavSelect('featured')}
          >
            {Icons.featured}
            <span>Featured</span>
          </button>
        </div>
      </nav>

      {/* Toast Notification */}
      <div
        className={`wx-toast ${toastMsg ? 'on' : ''}`}
        role="status"
        aria-live="polite"
      >
        {toastMsg}
      </div>

      {/* Hidden Admin Security Gateway & Dashboard (Opened via 5-second continuous logo hold) */}
      {adminPortalOpen && (
        <AdminPortal onClose={() => setAdminPortalOpen(false)} />
      )}
    </div>
  );
}
