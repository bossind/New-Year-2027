import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { QRStyleId } from '../types/wish';

interface QRCodeDesignerProps {
  wishUrl: string;
  senderName: string;
  recipientName?: string;
}

const QR_STYLES: Array<{
  id: QRStyleId;
  label: string;
  tagline: string;
  darkColor: string;
  lightColor: string;
  cardBg: [string, string];
  borderCol: string;
  titleCol: string;
  subCol: string;
}> = [
  {
    id: 'golden',
    label: 'Golden Luxury',
    tagline: '24K gold matrix on deep royal midnight',
    darkColor: '#ffd76a',
    lightColor: '#130b34',
    cardBg: ['#241458', '#0c0622'],
    borderCol: '#ffd76a',
    titleCol: '#ffd76a',
    subCol: '#efe9ff',
  },
  {
    id: 'royal',
    label: 'Royal Black & Gold',
    tagline: 'Obsidian black crest with imperial gold',
    darkColor: '#f5c142',
    lightColor: '#07050a',
    cardBg: ['#141008', '#050403'],
    borderCol: '#e0a526',
    titleCol: '#fff3b8',
    subCol: '#d6c89a',
  },
  {
    id: 'minimal',
    label: 'Minimal White & Gold',
    tagline: 'Crisp ivory card with warm bronze-gold ink',
    darkColor: '#4a2e04',
    lightColor: '#fffdf7',
    cardBg: ['#fffdf8', '#f7efd8'],
    borderCol: '#c98a14',
    titleCol: '#5c3804',
    subCol: '#7a5214',
  },
];

export const QRCodeDesigner: React.FC<QRCodeDesignerProps> = ({
  wishUrl,
  senderName,
  recipientName,
}) => {
  const [selectedStyle, setSelectedStyle] = useState<QRStyleId>('golden');
  const [downloading, setDownloading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const activeSpec =
    QR_STYLES.find((s) => s.id === selectedStyle) || QR_STYLES[0];

  useEffect(() => {
    let cancelled = false;
    const renderQRCard = async () => {
      const cv = canvasRef.current;
      if (!cv) return;

      const W = 640;
      const H = 780;
      cv.width = W;
      cv.height = H;
      const ctx = cv.getContext('2d');
      if (!ctx) return;

      // Offscreen raw QR matrix canvas
      const qrTemp = document.createElement('canvas');
      await QRCode.toCanvas(qrTemp, wishUrl, {
        width: 440,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
          dark: activeSpec.darkColor,
          light: activeSpec.lightColor,
        },
      });
      if (cancelled) return;

      // Draw luxury card background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, activeSpec.cardBg[0]);
      bgGrad.addColorStop(1, activeSpec.cardBg[1]);
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.roundRect(0, 0, W, H, 36);
      ctx.fill();

      // Double luxury border
      ctx.strokeStyle = activeSpec.borderCol;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(18, 18, W - 36, H - 36, 26);
      ctx.stroke();

      ctx.strokeStyle =
        selectedStyle === 'minimal'
          ? 'rgba(184, 120, 15, 0.35)'
          : 'rgba(255, 215, 106, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(28, 28, W - 56, H - 56, 20);
      ctx.stroke();

      // Header text
      ctx.fillStyle = activeSpec.titleCol;
      ctx.font = "900 28px 'Cinzel', Georgia, serif";
      ctx.textAlign = 'center';
      ctx.fillText('HAPPY NEW YEAR 2027', W / 2, 76);

      const subtitle = recipientName
        ? `For ${recipientName} · From ${senderName || 'Your Friend'}`
        : `A Special 3D Wish From ${senderName || 'Your Friend'}`;
      ctx.fillStyle = activeSpec.subCol;
      ctx.font = "600 18px 'Poppins', sans-serif";
      ctx.fillText(subtitle.slice(0, 42), W / 2, 112);

      // Draw QR box frame
      const qrSize = 440;
      const qrX = (W - qrSize) / 2;
      const qrY = 148;

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 24;
      ctx.fillStyle = activeSpec.lightColor;
      ctx.beginPath();
      ctx.roundRect(qrX - 14, qrY - 14, qrSize + 28, qrSize + 28, 24);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = activeSpec.borderCol;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(qrX - 14, qrY - 14, qrSize + 28, qrSize + 28, 24);
      ctx.stroke();

      ctx.drawImage(qrTemp, qrX, qrY, qrSize, qrSize);

      // Center 2027 emblem badge over QR code (Error Correction H supports center badge safely)
      const badgeW = 92;
      const badgeH = 44;
      const bx = W / 2 - badgeW / 2;
      const by = qrY + qrSize / 2 - badgeH / 2;
      ctx.fillStyle = activeSpec.lightColor;
      ctx.strokeStyle = activeSpec.borderCol;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(bx, by, badgeW, badgeH, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = activeSpec.darkColor;
      ctx.font = "900 21px 'Cinzel', Georgia, serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('2027', W / 2, by + badgeH / 2 + 1);

      // Footer instruction
      ctx.fillStyle = activeSpec.titleCol;
      ctx.font = "700 18px 'Poppins', sans-serif";
      ctx.fillText('📱 Scan to Open Your 3D Surprise Gift', W / 2, 656);

      ctx.fillStyle = activeSpec.subCol;
      ctx.font = "500 13px 'Poppins', sans-serif";
      const displayUrl =
        wishUrl.length > 56 ? wishUrl.slice(0, 53) + '...' : wishUrl;
      ctx.fillText(displayUrl, W / 2, 694);
    };

    renderQRCard().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [wishUrl, selectedStyle, activeSpec, senderName, recipientName]);

  const handleDownloadQR = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    setDownloading(true);
    cv.toBlob((blob) => {
      setDownloading(false);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `new-year-2027-qr-${selectedStyle}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    }, 'image/png');
  };

  return (
    <div className="wx-qr-card">
      <div className="wx-qr-header">
        <h3 className="wx-qr-title">👑 Luxury Wish QR Code</h3>
        <p className="wx-qr-sub">
          Choose a style and download your scannable 2027 Wish QR Card
        </p>
      </div>

      {/* 3 QR Style Selector Pills */}
      <div className="wx-qr-styles" role="radiogroup" aria-label="QR Code Design Style">
        {QR_STYLES.map((st) => (
          <button
            key={st.id}
            type="button"
            className={`wx-qr-style-btn ${selectedStyle === st.id ? 'sel' : ''}`}
            onClick={() => setSelectedStyle(st.id)}
          >
            <b>{st.label}</b>
            <span>{st.tagline}</span>
          </button>
        ))}
      </div>

      {/* Live Canvas Preview */}
      <div className="wx-qr-preview-wrap">
        <canvas
          ref={canvasRef}
          className="wx-qr-canvas"
          aria-label="Scannable QR Code for this New Year 2027 Wish"
        />
      </div>

      <button
        type="button"
        className="wx-gold-btn-secondary w-full mt-3"
        onClick={handleDownloadQR}
        disabled={downloading}
      >
        <span>
          {downloading
            ? '⏳ Preparing QR Card...'
            : `📥 Download ${activeSpec.label} QR Code`}
        </span>
      </button>
    </div>
  );
};
