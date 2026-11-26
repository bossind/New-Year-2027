import { PhotoCropConfig, PhotoFrameId } from '../types/wish';

export interface ProcessedImageResult {
  dataUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
}

const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

/**
 * Validates, resizes, and compresses an uploaded image file (Photo or Custom Background)
 * for smooth mobile performance while preserving crisp visual quality.
 */
export function compressAndOptimizeImage(
  file: File,
  options: {
    maxDimension?: number;
    quality?: number;
    onProgress?: (percent: number) => void;
  } = {}
): Promise<ProcessedImageResult> {
  const maxDim = options.maxDimension || 1080;
  const quality = options.quality || 0.84;
  const onProgress = options.onProgress || (() => {});

  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No image file was selected.'));
      return;
    }

    const isImageMime =
      ALLOWED_IMAGE_MIMES.includes(file.type.toLowerCase()) ||
      file.type.startsWith('image/');
    if (!isImageMime) {
      reject(
        new Error(
          'Unsupported file format. Please select a valid JPG, PNG, or WebP image.'
        )
      );
      return;
    }

    if (file.size > 18 * 1024 * 1024) {
      reject(
        new Error(
          'Image file is too large (over 18 MB). Please choose a smaller photo.'
        )
      );
      return;
    }

    onProgress(15);

    const reader = new FileReader();
    reader.onprogress = (ev) => {
      if (ev.lengthComputable) {
        const pct = Math.min(60, Math.round((ev.loaded / ev.total) * 50) + 15);
        onProgress(pct);
      }
    };
    reader.onerror = () => {
      reject(new Error('Failed to read the selected image file.'));
    };
    reader.onload = () => {
      onProgress(68);
      const img = new Image();
      img.onload = () => {
        try {
          onProgress(82);
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;
          if (w < 20 || h < 20) {
            reject(
              new Error('Image resolution is too small. Please choose a clearer photo.')
            );
            return;
          }

          if (w > maxDim || h > maxDim) {
            if (w >= h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Graphics context unavailable on this device.'));
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);

          onProgress(94);
          let dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          const approxBytes = Math.round((dataUrl.length * 3) / 4);
          onProgress(100);
          resolve({
            dataUrl,
            width: w,
            height: h,
            sizeBytes: approxBytes,
          });
        } catch {
          reject(new Error('Could not process this image on your device.'));
        }
      };
      img.onerror = () => {
        reject(
          new Error(
            'This image file appears corrupted or unsupported by your browser.'
          )
        );
      };
      img.src = String(reader.result);
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Loads an HTMLImageElement from a dataURL or URL safely.
 */
export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image asset'));
    img.src = src;
  });
}

/**
 * Draws the user's personalized photo with crop/zoom/pan and one of the 4 luxury frames
 * ('golden' | 'royal' | 'cinematic' | 'elegant') directly onto any Canvas 2D context.
 * Used by both HD Image Export and Animated Video Export so output matches Live Preview.
 */
export function drawFramedPhotoOnCanvas(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  diameter: number,
  crop: PhotoCropConfig,
  frameId: PhotoFrameId
) {
  const r = diameter / 2;
  ctx.save();

  // Outer glow
  ctx.shadowColor =
    frameId === 'royal'
      ? 'rgba(255, 95, 135, 0.7)'
      : frameId === 'cinematic'
      ? 'rgba(255, 220, 140, 0.65)'
      : 'rgba(255, 195, 60, 0.75)';
  ctx.shadowBlur = diameter * 0.16;

  // Frame shape path helper
  const traceFrameShape = (radius: number) => {
    ctx.beginPath();
    if (frameId === 'cinematic') {
      const w = radius * 2.15;
      const h = radius * 1.85;
      const rx = radius * 0.28;
      ctx.roundRect(cx - w / 2, cy - h / 2, w, h, rx);
    } else {
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    }
  };

  // Draw outer frame border
  const borderThickness = Math.max(6, diameter * 0.065);
  traceFrameShape(r + borderThickness);
  const frameGrad = ctx.createLinearGradient(
    cx - r,
    cy - r,
    cx + r,
    cy + r
  );
  if (frameId === 'golden') {
    frameGrad.addColorStop(0, '#fff7cc');
    frameGrad.addColorStop(0.35, '#ffd04a');
    frameGrad.addColorStop(0.7, '#b8780f');
    frameGrad.addColorStop(1, '#fff0a8');
  } else if (frameId === 'royal') {
    frameGrad.addColorStop(0, '#ffd76a');
    frameGrad.addColorStop(0.35, '#d4264c');
    frameGrad.addColorStop(0.7, '#ffd76a');
    frameGrad.addColorStop(1, '#8f5804');
  } else if (frameId === 'cinematic') {
    frameGrad.addColorStop(0, '#ffffff');
    frameGrad.addColorStop(0.45, '#ffd76a');
    frameGrad.addColorStop(0.8, '#281858');
    frameGrad.addColorStop(1, '#ffd76a');
  } else {
    // elegant
    frameGrad.addColorStop(0, '#fffdf5');
    frameGrad.addColorStop(0.5, '#e6c675');
    frameGrad.addColorStop(1, '#a8822a');
  }
  ctx.fillStyle = frameGrad;
  ctx.fill();

  // Reset shadow for inner clipping
  ctx.shadowBlur = 0;

  // Clip inner photo area
  ctx.save();
  traceFrameShape(r);
  ctx.clip();

  // Fill dark backdrop inside frame
  ctx.fillStyle = '#0c0724';
  ctx.fillRect(cx - r * 1.3, cy - r * 1.3, r * 2.6, r * 2.6);

  // Compute cover + zoom + pan
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const boxW = frameId === 'cinematic' ? r * 2.15 : diameter;
  const boxH = frameId === 'cinematic' ? r * 1.85 : diameter;
  const baseScale = Math.max(boxW / iw, boxH / ih);
  const zoom = Math.max(1, Math.min(3, crop.zoom || 1));
  const drawW = iw * baseScale * zoom;
  const drawH = ih * baseScale * zoom;
  const panX = ((crop.offsetX || 0) / 100) * (boxW * 0.45);
  const panY = ((crop.offsetY || 0) / 100) * (boxH * 0.45);

  ctx.drawImage(
    img,
    cx - drawW / 2 + panX,
    cy - drawH / 2 + panY,
    drawW,
    drawH
  );
  ctx.restore();

  // Inner metallic ring highlight
  traceFrameShape(r);
  ctx.lineWidth = Math.max(2, diameter * 0.018);
  ctx.strokeStyle = 'rgba(255, 250, 220, 0.85)';
  ctx.stroke();

  // Royal / Golden crown or star ornament at top of frame
  ctx.fillStyle = '#fff6cf';
  ctx.font = `700 ${Math.round(diameter * 0.14)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const ornament =
    frameId === 'royal'
      ? '♛'
      : frameId === 'golden'
      ? '✦'
      : frameId === 'cinematic'
      ? '◈'
      : '❖';
  const topY = frameId === 'cinematic' ? cy - r * 0.92 - borderThickness * 0.4 : cy - r - borderThickness * 0.35;
  ctx.fillText(ornament, cx, topY);

  ctx.restore();
}
