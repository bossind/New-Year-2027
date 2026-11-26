import { LangCode } from '../data/i18n';
import { AnimId } from '../engine/animations';

export type MessageCategory =
  | 'Love'
  | 'Family'
  | 'Friends'
  | 'Romantic'
  | 'Best Wishes'
  | 'Inspirational';

export type PhotoDisplayMode = 'card' | 'background';

export type PhotoFrameId = 'golden' | 'royal' | 'cinematic' | 'elegant';

export type BackgroundCategory =
  | 'Celebration'
  | 'Fireworks'
  | 'Romantic'
  | 'Luxury'
  | 'Nature'
  | 'Galaxy'
  | 'City Night'
  | 'Abstract';

export type BackgroundMode = 'auto' | 'custom';

export type MusicMood =
  | 'energetic'
  | 'royal'
  | 'romantic'
  | 'magical'
  | 'serene'
  | 'upbeat';

export type MusicCategory =
  | 'Celebration'
  | 'Bollywood Festive'
  | 'Romantic'
  | 'Royal Instrumental'
  | 'EDM Party'
  | 'Peaceful & Spiritual';

export type FontStyleId =
  | 'cinzel'
  | 'greatvibes'
  | 'poppins'
  | 'playfair'
  | 'royalserif';

export type TextColorId =
  | 'gold'
  | 'rose'
  | 'platinum'
  | 'emerald'
  | 'neoncyan'
  | 'crimson';

export type QRStyleId = 'golden' | 'royal' | 'minimal';

export interface PhotoCropConfig {
  zoom: number; // 1 to 3
  offsetX: number; // -100 to 100 percentage offset
  offsetY: number; // -100 to 100 percentage offset
}

export interface MusicCatalogEntry {
  songId: string;
  songName: string;
  googleDriveLink: string;
  category: MusicCategory;
  mood: MusicMood;
  active: boolean;
  duration?: string;
  previewInfo?: string;
  tempoBpm?: number;
  synthPreset?: number;
}

export interface WishConfig {
  wishId: string;
  recipientName: string; // WISH TO
  senderName: string; // WISH FROM
  messageCategory: MessageCategory;
  messageId: number;
  customMessage: string;
  isCustomMessage: boolean;
  language: LangCode;
  animationId: AnimId;
  photoAssetId: string | null;
  photoDataUrl: string | null;
  photoCrop: PhotoCropConfig;
  photoDisplayMode: PhotoDisplayMode;
  photoFrameId: PhotoFrameId;
  backgroundMode: BackgroundMode;
  backgroundId: string;
  customBgDataUrl: string | null;
  musicMode: 'auto' | 'manual';
  musicId: string;
  fontId: FontStyleId;
  textColor: TextColorId;
  passwordProtected: boolean;
  createdAt: string;
}

export interface FontOption {
  id: FontStyleId;
  label: string;
  fontFamily: string;
  sample: string;
}

export interface TextColorOption {
  id: TextColorId;
  label: string;
  primaryHex: string;
  secondaryHex: string;
  glowRgba: string;
  cssGradient: string;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: 'cinzel',
    label: 'Royal Cinzel 3D',
    fontFamily: "'Cinzel', Georgia, serif",
    sample: '2027 Royal',
  },
  {
    id: 'greatvibes',
    label: 'Calligraphy Script',
    fontFamily: "'Great Vibes', cursive",
    sample: 'Celebration',
  },
  {
    id: 'poppins',
    label: 'Modern Bold',
    fontFamily: "'Poppins', system-ui, sans-serif",
    sample: 'Modern 2027',
  },
  {
    id: 'playfair',
    label: 'Editorial Luxe',
    fontFamily: "Georgia, 'Times New Roman', serif",
    sample: 'Golden Era',
  },
  {
    id: 'royalserif',
    label: 'Imperial Serif',
    fontFamily: "'Cinzel', 'Noto Sans Devanagari', serif",
    sample: 'Imperial',
  },
];

export const TEXT_COLOR_OPTIONS: TextColorOption[] = [
  {
    id: 'gold',
    label: '24K Imperial Gold',
    primaryHex: '#ffd76a',
    secondaryHex: '#c98618',
    glowRgba: 'rgba(255, 195, 65, 0.65)',
    cssGradient:
      'linear-gradient(180deg, #fffdf0 0%, #ffe08a 30%, #f2b531 52%, #fff1b3 68%, #c98618 100%)',
  },
  {
    id: 'rose',
    label: 'Royal Rose Gold',
    primaryHex: '#ffb3c6',
    secondaryHex: '#c95b7a',
    glowRgba: 'rgba(255, 130, 170, 0.65)',
    cssGradient:
      'linear-gradient(180deg, #fff0f5 0%, #ffb6c9 35%, #e36f8f 60%, #ffd6e0 78%, #a83c5b 100%)',
  },
  {
    id: 'platinum',
    label: 'Diamond Platinum',
    primaryHex: '#f0f6ff',
    secondaryHex: '#8ba3c7',
    glowRgba: 'rgba(180, 220, 255, 0.65)',
    cssGradient:
      'linear-gradient(180deg, #ffffff 0%, #d9ecff 35%, #94b8e0 58%, #f0f8ff 75%, #6586b0 100%)',
  },
  {
    id: 'emerald',
    label: 'Emerald Jewel',
    primaryHex: '#6efacc',
    secondaryHex: '#15996b',
    glowRgba: 'rgba(65, 235, 165, 0.65)',
    cssGradient:
      'linear-gradient(180deg, #eafff7 0%, #7ef7cc 35%, #1ebd87 58%, #b8ffea 76%, #0d7a54 100%)',
  },
  {
    id: 'neoncyan',
    label: 'Cyber Neon Cyan',
    primaryHex: '#5ef2ff',
    secondaryHex: '#00a3c4',
    glowRgba: 'rgba(43, 232, 255, 0.75)',
    cssGradient:
      'linear-gradient(180deg, #ffffff 0%, #8cf7ff 35%, #1cd8f5 58%, #c7fcff 75%, #0689a3 100%)',
  },
  {
    id: 'crimson',
    label: 'Festive Ruby Gold',
    primaryHex: '#ff758f',
    secondaryHex: '#b81435',
    glowRgba: 'rgba(255, 75, 110, 0.7)',
    cssGradient:
      'linear-gradient(180deg, #fff2b2 0%, #ff859d 35%, #e01e45 58%, #ffc2ce 75%, #8f0924 100%)',
  },
];

export interface PhotoFrameOption {
  id: PhotoFrameId;
  label: string;
  tagline: string;
  borderGradient: string;
  accentColor: string;
  cornerOrnament: string;
}

export const PHOTO_FRAME_OPTIONS: PhotoFrameOption[] = [
  {
    id: 'golden',
    label: 'Golden Frame',
    tagline: '24K metallic bevel with starlight glow',
    borderGradient: 'linear-gradient(135deg, #fff6c4, #ffd04a 45%, #b8780f 80%, #fff0a8)',
    accentColor: '#ffd76a',
    cornerOrnament: '✦',
  },
  {
    id: 'royal',
    label: 'Royal Frame',
    tagline: 'Imperial crest filigree & ruby-gold trim',
    borderGradient: 'linear-gradient(135deg, #ffd76a, #d4264c 35%, #ffd76a 68%, #8f5804)',
    accentColor: '#ff758f',
    cornerOrnament: '♛',
  },
  {
    id: 'cinematic',
    label: 'Cinematic Frame',
    tagline: 'Luxury studio glass with warm golden rim',
    borderGradient: 'linear-gradient(135deg, #ffffff, #ffd76a 50%, #302060 85%, #ffd76a)',
    accentColor: '#ffe28a',
    cornerOrnament: '◈',
  },
  {
    id: 'elegant',
    label: 'Elegant Frame',
    tagline: 'Minimalist champagne pearl double border',
    borderGradient: 'linear-gradient(135deg, #fffdf5, #e6c675 50%, #a8822a)',
    accentColor: '#f5e1a4',
    cornerOrnament: '❖',
  },
];
