import { MSG } from '../data/i18n';
import {
  getBackgroundById,
  resolveAutomaticBackground,
} from '../data/backgrounds';
import { ANIM_IDS, Engine } from '../engine/animations';
import { MUSIC } from '../engine/music';
import {
  FONT_OPTIONS,
  TEXT_COLOR_OPTIONS,
  WishConfig,
} from '../types/wish';
import {
  drawFramedPhotoOnCanvas,
  loadImageElement,
} from './imageProcessor';

const YEAR = 2027;

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 5);
}

/**
 * Draws the complete composite Wish frame (background, animation canvas, photo & frame,
 * recipient/sender typography, custom font/color, and greeting message) onto a target canvas.
 */
async function drawCompositeWishFrame(options: {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  animCanvas: HTMLCanvasElement;
  config: WishConfig;
  formattedMessage: string;
  photoImg: HTMLImageElement | null;
  customBgImg: HTMLImageElement | null;
  revealProgress: number; // 0..1
  energyPulse: number; // 0..1
}) {
  const {
    ctx,
    width: W,
    height: H,
    animCanvas,
    config,
    formattedMessage,
    photoImg,
    customBgImg,
    revealProgress,
    energyPulse,
  } = options;

  const song = MUSIC.getSongById(config.musicId);
  const presetBg =
    config.backgroundMode === 'custom'
      ? getBackgroundById(config.backgroundId) ||
        resolveAutomaticBackground(config.animationId, song.mood)
      : resolveAutomaticBackground(config.animationId, song.mood);

  const fontOpt =
    FONT_OPTIONS.find((f) => f.id === config.fontId) || FONT_OPTIONS[0];
  const colorOpt =
    TEXT_COLOR_OPTIONS.find((c) => c.id === config.textColor) ||
    TEXT_COLOR_OPTIONS[0];
  const m = MSG[config.messageId] || MSG[0];

  ctx.save();

  // 1. Draw Base Background
  if (
    config.photoDisplayMode === 'background' &&
    photoImg
  ) {
    // Photo as Main Background with crop/zoom/pan
    ctx.fillStyle = '#050312';
    ctx.fillRect(0, 0, W, H);
    const iw = photoImg.naturalWidth || photoImg.width || 1;
    const ih = photoImg.naturalHeight || photoImg.height || 1;
    const scale = Math.max(W / iw, H / ih) * (config.photoCrop.zoom || 1);
    const dw = iw * scale;
    const dh = ih * scale;
    const px = ((config.photoCrop.offsetX || 0) / 100) * (W * 0.35);
    const py = ((config.photoCrop.offsetY || 0) / 100) * (H * 0.35);
    ctx.drawImage(photoImg, (W - dw) / 2 + px, (H - dh) / 2 + py, dw, dh);

    // Dark luxury vignette over background photo so text & fireworks shine
    const vig = ctx.createLinearGradient(0, 0, 0, H);
    vig.addColorStop(0, 'rgba(6, 3, 20, 0.55)');
    vig.addColorStop(0.5, 'rgba(6, 3, 20, 0.38)');
    vig.addColorStop(1, 'rgba(6, 3, 20, 0.78)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  } else if (config.backgroundMode === 'custom' && customBgImg) {
    const iw = customBgImg.naturalWidth || customBgImg.width || 1;
    const ih = customBgImg.naturalHeight || customBgImg.height || 1;
    const scale = Math.max(W / iw, H / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(customBgImg, (W - dw) / 2, (H - dh) / 2, dw, dh);

    const vig = ctx.createLinearGradient(0, 0, 0, H);
    vig.addColorStop(0, 'rgba(5, 3, 18, 0.45)');
    vig.addColorStop(1, 'rgba(5, 3, 18, 0.72)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  } else {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    presetBg.canvasStops.forEach(([stop, col]) => bgGrad.addColorStop(stop, col));
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
  }

  // 2. Blend the Live Animation Canvas on top (using screen/lighter blend when custom photo bg is active)
  ctx.save();
  if (
    (config.photoDisplayMode === 'background' && photoImg) ||
    (config.backgroundMode === 'custom' && customBgImg)
  ) {
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.88;
  } else {
    ctx.globalAlpha = 0.92;
  }
  ctx.drawImage(animCanvas, 0, 0, W, H);
  ctx.restore();

  // 3. Music-Synchronized Golden Aura Halo
  ctx.save();
  const haloR = Math.min(W, H) * (0.42 + 0.08 * energyPulse);
  const halo = ctx.createRadialGradient(
    W / 2,
    H * 0.45,
    0,
    W / 2,
    H * 0.45,
    haloR
  );
  halo.addColorStop(0, colorOpt.glowRgba.replace(/[\d.]+\)$/, `${0.26 * revealProgress})`));
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // 4. Outer Luxury Frame Border on Poster
  ctx.save();
  const pad = Math.round(W * 0.032);
  ctx.strokeStyle = 'rgba(255, 215, 106, 0.42)';
  ctx.lineWidth = Math.max(2, Math.round(W * 0.003));
  ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);
  ctx.restore();

  // 5. Layout Vertical Cursor
  let cursorY = H * 0.11;

  // Recipient Badge (WISH TO)
  const recipient = (config.recipientName || '').trim();
  if (recipient) {
    ctx.save();
    ctx.globalAlpha = revealProgress;
    const badgeText = `✨ WISH FOR ${recipient.toUpperCase()} ✨`;
    const badgeFontPx = Math.round(W * 0.032);
    ctx.font = `700 ${badgeFontPx}px 'Poppins', sans-serif`;
    const tw = ctx.measureText(badgeText).width;
    const bw = Math.min(W * 0.86, tw + W * 0.08);
    const bh = badgeFontPx * 2.1;
    ctx.fillStyle = 'rgba(15, 9, 42, 0.78)';
    ctx.strokeStyle = colorOpt.primaryHex;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(W / 2 - bw / 2, cursorY - bh / 2, bw, bh, bh / 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = colorOpt.primaryHex;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, W / 2, cursorY);
    ctx.restore();
    cursorY += bh * 0.95;
  }

  // 6. Framed Photo Medallion (when photoDisplayMode === 'card' and photoImg exists)
  if (photoImg && config.photoDisplayMode === 'card') {
    const diameter = Math.round(Math.min(W, H) * 0.24);
    const photoCy = cursorY + diameter * 0.52;
    drawFramedPhotoOnCanvas(
      ctx,
      photoImg,
      W / 2,
      photoCy,
      diameter,
      config.photoCrop,
      config.photoFrameId
    );
    cursorY = photoCy + diameter * 0.64;
  } else {
    cursorY += H * 0.05;
  }

  // 7. Sender Name (3D Metallic Typography)
  const sender = (config.senderName || '').trim() || 'Your Friend';
  ctx.save();
  ctx.globalAlpha = revealProgress;
  let senderFontSize = Math.round(W * 0.082);
  ctx.font = `900 ${senderFontSize}px ${fontOpt.fontFamily}`;
  const measuredSender = ctx.measureText(sender).width;
  if (measuredSender > W * 0.86 && measuredSender > 0) {
    senderFontSize = Math.round(senderFontSize * ((W * 0.86) / measuredSender));
    ctx.font = `900 ${senderFontSize}px ${fontOpt.fontFamily}`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 3D depth extrusion layers
  const depth = Math.max(3, Math.round(senderFontSize * 0.07));
  for (let d = depth; d > 0; d--) {
    ctx.fillStyle = 'rgba(65, 36, 6, 0.9)';
    ctx.fillText(sender, W / 2, cursorY + d);
  }
  ctx.shadowColor = colorOpt.glowRgba;
  ctx.shadowBlur = senderFontSize * 0.3;
  const senderGrad = ctx.createLinearGradient(
    0,
    cursorY - senderFontSize * 0.5,
    0,
    cursorY + senderFontSize * 0.5
  );
  senderGrad.addColorStop(0, '#ffffff');
  senderGrad.addColorStop(0.45, colorOpt.primaryHex);
  senderGrad.addColorStop(1, colorOpt.secondaryHex);
  ctx.fillStyle = senderGrad;
  ctx.fillText(sender, W / 2, cursorY);
  ctx.restore();

  cursorY += senderFontSize * 0.88;

  // 8. "wishes you a" line
  ctx.save();
  ctx.globalAlpha = revealProgress;
  const wishLinePx = Math.round(W * 0.032);
  ctx.font = `600 ${wishLinePx}px 'Poppins', sans-serif`;
  ctx.fillStyle = '#f5f0ff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 10;
  ctx.fillText(m.wish, W / 2, cursorY);
  ctx.restore();

  cursorY += wishLinePx * 1.65;

  // 9. "Happy New Year" Script / Native Heading
  ctx.save();
  ctx.globalAlpha = revealProgress;
  const hnyPx = Math.round(W * (m.cls ? 0.068 : 0.095));
  ctx.font = m.cls
    ? `800 ${hnyPx}px 'Poppins', 'Noto Sans Devanagari', sans-serif`
    : `400 ${hnyPx}px 'Great Vibes', cursive`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = colorOpt.glowRgba;
  ctx.shadowBlur = 26;
  ctx.fillText(m.hny, W / 2, cursorY);
  ctx.restore();

  cursorY += hnyPx * 1.05;

  // 10. Giant 3D "2027"
  ctx.save();
  ctx.globalAlpha = revealProgress;
  const yearPx = Math.round(W * 0.185);
  ctx.font = `900 ${yearPx}px 'Cinzel', Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const yDepth = Math.max(4, Math.round(yearPx * 0.06));
  for (let d = yDepth; d > 0; d--) {
    ctx.fillStyle = `rgb(${68 + d * 4}, ${38 + d * 2}, 8)`;
    ctx.fillText(String(YEAR), W / 2, cursorY + d);
  }
  ctx.shadowColor = colorOpt.glowRgba;
  ctx.shadowBlur = yearPx * 0.25;
  const yGrad = ctx.createLinearGradient(
    0,
    cursorY - yearPx * 0.5,
    0,
    cursorY + yearPx * 0.5
  );
  yGrad.addColorStop(0, '#fffdf0');
  yGrad.addColorStop(0.35, colorOpt.primaryHex);
  yGrad.addColorStop(0.7, '#fff1b5');
  yGrad.addColorStop(1, colorOpt.secondaryHex);
  ctx.fillStyle = yGrad;
  ctx.fillText(String(YEAR), W / 2, cursorY);
  ctx.restore();

  cursorY += yearPx * 0.72;

  // 11. Greeting Message Glass Card
  ctx.save();
  ctx.globalAlpha = revealProgress;
  const msgFontPx = Math.round(W * 0.032);
  ctx.font = `600 ${msgFontPx}px 'Poppins', 'Noto Sans Devanagari', sans-serif`;
  const maxTextW = W * 0.78;
  const lines = wrapTextLines(ctx, formattedMessage, maxTextW);
  const lineHeight = msgFontPx * 1.48;
  const boxH = lines.length * lineHeight + msgFontPx * 1.4;
  const boxW = W * 0.86;
  const boxY = Math.min(cursorY, H - boxH - H * 0.065);

  ctx.fillStyle = 'rgba(10, 6, 30, 0.68)';
  ctx.strokeStyle = 'rgba(255, 215, 120, 0.36)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(W / 2 - boxW / 2, boxY, boxW, boxH, 24);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((ln, idx) => {
    const ly = boxY + msgFontPx * 0.95 + idx * lineHeight;
    ctx.fillText(ln, W / 2, ly);
  });
  ctx.restore();

  // 12. Subtle Footer Signature
  ctx.save();
  ctx.font = `600 ${Math.round(W * 0.022)}px 'Poppins', sans-serif`;
  ctx.fillStyle = 'rgba(255, 215, 106, 0.75)';
  ctx.textAlign = 'center';
  ctx.fillText(`✨ Happy New Year ${YEAR} · Celebration City Edition ✨`, W / 2, H - pad * 1.4);
  ctx.restore();

  ctx.restore();
}

/**
 * A. HD Image Download (1080 x 1350 Portrait Poster)
 */
export async function exportWishAsHDImage(
  config: WishConfig,
  formattedMessage: string,
  onProgress?: (pct: number) => void
): Promise<void> {
  const report = onProgress || (() => {});
  report(10);

  const W = 1080;
  const H = 1350;

  let photoImg: HTMLImageElement | null = null;
  let customBgImg: HTMLImageElement | null = null;

  if (config.photoDataUrl) {
    try {
      photoImg = await loadImageElement(config.photoDataUrl);
    } catch {
      photoImg = null;
    }
  }
  if (config.customBgDataUrl) {
    try {
      customBgImg = await loadImageElement(config.customBgDataUrl);
    } catch {
      customBgImg = null;
    }
  }
  report(35);

  // Offscreen canvas for running the selected animation to its golden reveal climax
  const animCanvas = document.createElement('canvas');
  animCanvas.width = W;
  animCanvas.height = H;
  Object.defineProperty(animCanvas, 'getBoundingClientRect', {
    value: () => ({ width: W, height: H, left: 0, top: 0 }),
  });

  const eng = new Engine(animCanvas, {
    id: ANIM_IDS.includes(config.animationId) ? config.animationId : 'fireworks',
    year: YEAR,
    nameText: () => config.senderName || 'Your Friend',
  });

  // Step 90 frames (~3 seconds) so fireworks/particles/sparkler are rich and full
  for (let i = 0; i < 90; i++) {
    eng.frame(1 / 30);
  }
  report(72);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = W;
  outCanvas.height = H;
  const ctx = outCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize HD Canvas context on this device.');
  }

  await drawCompositeWishFrame({
    ctx,
    width: W,
    height: H,
    animCanvas,
    config,
    formattedMessage,
    photoImg,
    customBgImg,
    revealProgress: 1,
    energyPulse: 0.85,
  });
  report(90);

  const blob: Blob = await new Promise((resolve, reject) => {
    outCanvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Failed to encode HD PNG image.'));
    }, 'image/png');
  });

  const safeSlug =
    (config.senderName || 'wish')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || '2027';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `new-year-2027-wish-${safeSlug}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  report(100);
}

/**
 * Detects whether the user's browser supports animated video recording from canvas.
 */
export function detectVideoExportSupport(): {
  supported: boolean;
  mimeType: string;
  extension: string;
  reason?: string;
} {
  if (typeof window === 'undefined') {
    return {
      supported: false,
      mimeType: '',
      extension: '',
      reason: 'Browser environment unavailable.',
    };
  }
  const hasCapture =
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function';
  const hasRecorder = typeof window.MediaRecorder !== 'undefined';

  if (!hasCapture || !hasRecorder) {
    return {
      supported: false,
      mimeType: '',
      extension: '',
      reason:
        'Your current mobile browser does not support direct video encoding (MediaRecorder). Please use HD Image Download or open in Chrome/Edge.',
    };
  }

  const candidates: Array<{ mime: string; ext: string }> = [
    { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
    { mime: 'video/mp4', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
  ];

  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c.mime)) {
        return {
          supported: true,
          mimeType: c.mime,
          extension: c.ext,
        };
      }
    } catch {
      // continue checking
    }
  }

  return {
    supported: true,
    mimeType: '',
    extension: 'webm',
  };
}

/**
 * B. Animated Video Download (5-second 30fps HD Animated Video with Music when supported)
 */
export async function exportWishAsAnimatedVideo(
  config: WishConfig,
  formattedMessage: string,
  onProgress?: (pct: number) => void
): Promise<void> {
  const cap = detectVideoExportSupport();
  if (!cap.supported) {
    throw new Error(
      cap.reason ||
        'Animated video export is not supported on this browser. Please use HD Image Download.'
    );
  }

  const report = onProgress || (() => {});
  report(5);

  const W = 720;
  const H = 900;

  let photoImg: HTMLImageElement | null = null;
  let customBgImg: HTMLImageElement | null = null;

  if (config.photoDataUrl) {
    try {
      photoImg = await loadImageElement(config.photoDataUrl);
    } catch {
      photoImg = null;
    }
  }
  if (config.customBgDataUrl) {
    try {
      customBgImg = await loadImageElement(config.customBgDataUrl);
    } catch {
      customBgImg = null;
    }
  }

  const animCanvas = document.createElement('canvas');
  animCanvas.width = W;
  animCanvas.height = H;
  Object.defineProperty(animCanvas, 'getBoundingClientRect', {
    value: () => ({ width: W, height: H, left: 0, top: 0 }),
  });

  const eng = new Engine(animCanvas, {
    id: ANIM_IDS.includes(config.animationId) ? config.animationId : 'fireworks',
    year: YEAR,
    nameText: () => config.senderName || 'Your Friend',
  });

  const outCanvas = document.createElement('canvas');
  outCanvas.width = W;
  outCanvas.height = H;
  const ctx = outCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize video rendering canvas.');
  }

  const videoStream = outCanvas.captureStream(30);

  // Attach live music audio track if music is active and supported
  const audioStream = MUSIC.createExportAudioStream();
  if (audioStream) {
    audioStream.getAudioTracks().forEach((track) => {
      try {
        videoStream.addTrack(track);
      } catch {
        // ignore if browser blocks combined track
      }
    });
  }

  const chunks: BlobPart[] = [];
  const recorderOptions: MediaRecorderOptions = cap.mimeType
    ? { mimeType: cap.mimeType, videoBitsPerSecond: 4_500_000 }
    : { videoBitsPerSecond: 4_500_000 };

  const recorder = new MediaRecorder(videoStream, recorderOptions);
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  const finishedPromise = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      if (chunks.length === 0) {
        reject(new Error('Video encoder produced an empty stream.'));
        return;
      }
      resolve(
        new Blob(chunks, {
          type: cap.mimeType || 'video/webm',
        })
      );
    };
    recorder.onerror = () => {
      reject(new Error('Video recording interrupted on this device.'));
    };
  });

  recorder.start(200);

  const totalFrames = 135; // 4.5 seconds @ 30fps
  const dt = 1 / 30;

  for (let f = 0; f < totalFrames; f++) {
    eng.frame(dt);
    const sync = MUSIC.getSyncSnapshot(f * dt);
    const revealProgress = Math.min(1, Math.max(0.15, (f + 10) / 35));

    await drawCompositeWishFrame({
      ctx,
      width: W,
      height: H,
      animCanvas,
      config,
      formattedMessage,
      photoImg,
      customBgImg,
      revealProgress,
      energyPulse: sync.pulse,
    });

    report(Math.min(95, Math.round(((f + 1) / totalFrames) * 90) + 5));
    await new Promise((r) => window.setTimeout(r, 22));
  }

  recorder.stop();
  const videoBlob = await finishedPromise;
  report(99);

  const safeSlug =
    (config.senderName || 'wish')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || '2027';
  const url = URL.createObjectURL(videoBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `new-year-2027-wish-${safeSlug}.${cap.extension}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  report(100);
}
