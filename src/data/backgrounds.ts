import { AnimId } from '../engine/animations';
import { BackgroundCategory, MusicMood } from '../types/wish';

export const BACKGROUND_CATEGORIES: Array<{
  id: BackgroundCategory;
  label: string;
  icon: string;
}> = [
  { id: 'Celebration', label: 'Celebration', icon: '🎉' },
  { id: 'Fireworks', label: 'Fireworks', icon: '🎆' },
  { id: 'Romantic', label: 'Romantic', icon: '🌹' },
  { id: 'Luxury', label: 'Luxury', icon: '👑' },
  { id: 'Nature', label: 'Nature', icon: '🌿' },
  { id: 'Galaxy', label: 'Galaxy', icon: '🌌' },
  { id: 'City Night', label: 'City Night', icon: '🏙️' },
  { id: 'Abstract', label: 'Abstract', icon: '✨' },
];

export interface BackgroundPreset {
  id: string;
  name: string;
  category: BackgroundCategory;
  cssGradient: string;
  canvasStops: Array<[number, string]>;
  accentGlow: string;
  pattern: 'skyline' | 'stars' | 'bokeh' | 'aurora' | 'rays' | 'hearts';
}

export const BACKGROUND_GALLERY: BackgroundPreset[] = [
  // 1. Celebration
  {
    id: 'bg-cel-gold',
    name: 'Imperial Golden Eve',
    category: 'Celebration',
    cssGradient:
      'radial-gradient(circle at 50% 25%, rgba(255, 200, 75, 0.36) 0%, rgba(44, 18, 84, 0.85) 55%, #060314 100%)',
    canvasStops: [
      [0, '#2a124c'],
      [0.5, '#13072b'],
      [1, '#05020f'],
    ],
    accentGlow: 'rgba(255, 205, 85, 0.42)',
    pattern: 'bokeh',
  },
  {
    id: 'bg-cel-royal',
    name: 'Midnight Carnival',
    category: 'Celebration',
    cssGradient:
      'radial-gradient(circle at 50% 20%, rgba(168, 85, 247, 0.42) 0%, rgba(30, 12, 68, 0.9) 58%, #050212 100%)',
    canvasStops: [
      [0, '#361466'],
      [0.55, '#160836'],
      [1, '#04010d'],
    ],
    accentGlow: 'rgba(190, 120, 255, 0.4)',
    pattern: 'rays',
  },

  // 2. Fireworks
  {
    id: 'bg-fw-amber',
    name: 'Golden Firework Sky',
    category: 'Fireworks',
    cssGradient:
      'linear-gradient(180deg, #060214 0%, #1a0b3e 52%, #3d1635 100%)',
    canvasStops: [
      [0, '#060214'],
      [0.52, '#1a0b3e'],
      [1, '#3d1635'],
    ],
    accentGlow: 'rgba(255, 175, 65, 0.45)',
    pattern: 'stars',
  },
  {
    id: 'bg-fw-crimson',
    name: 'Festival Sparkle Night',
    category: 'Fireworks',
    cssGradient:
      'linear-gradient(180deg, #08020f 0%, #2b092c 55%, #521329 100%)',
    canvasStops: [
      [0, '#08020f'],
      [0.55, '#2b092c'],
      [1, '#521329'],
    ],
    accentGlow: 'rgba(255, 95, 130, 0.42)',
    pattern: 'bokeh',
  },

  // 3. Romantic
  {
    id: 'bg-rom-velvet',
    name: 'Velvet Rose Midnight',
    category: 'Romantic',
    cssGradient:
      'radial-gradient(circle at 50% 35%, #5e1134 0%, #280619 60%, #0d0108 100%)',
    canvasStops: [
      [0, '#5e1134'],
      [0.6, '#280619'],
      [1, '#0d0108'],
    ],
    accentGlow: 'rgba(255, 110, 155, 0.48)',
    pattern: 'hearts',
  },
  {
    id: 'bg-rom-blush',
    name: 'Champagne Romance',
    category: 'Romantic',
    cssGradient:
      'linear-gradient(180deg, #1f0a24 0%, #4a153b 52%, #29091e 100%)',
    canvasStops: [
      [0, '#1f0a24'],
      [0.52, '#4a153b'],
      [1, '#29091e'],
    ],
    accentGlow: 'rgba(255, 165, 195, 0.44)',
    pattern: 'bokeh',
  },

  // 4. Luxury
  {
    id: 'bg-lux-24k',
    name: '24K Obsidian Gold',
    category: 'Luxury',
    cssGradient:
      'radial-gradient(circle at 50% 25%, #4a340b 0%, #1c1304 58%, #070502 100%)',
    canvasStops: [
      [0, '#4a340b'],
      [0.58, '#1c1304'],
      [1, '#070502'],
    ],
    accentGlow: 'rgba(255, 215, 106, 0.55)',
    pattern: 'rays',
  },
  {
    id: 'bg-lux-palace',
    name: 'Royal Palace Gold',
    category: 'Luxury',
    cssGradient:
      'linear-gradient(180deg, #1a1105 0%, #332008 48%, #0d0802 100%)',
    canvasStops: [
      [0, '#1a1105'],
      [0.48, '#332008'],
      [1, '#0d0802'],
    ],
    accentGlow: 'rgba(255, 200, 80, 0.48)',
    pattern: 'bokeh',
  },

  // 5. Nature
  {
    id: 'bg-nat-aurora',
    name: 'Himalayan Starlight',
    category: 'Nature',
    cssGradient:
      'linear-gradient(180deg, #020c1b 0%, #072a42 54%, #0d3d4d 100%)',
    canvasStops: [
      [0, '#020c1b'],
      [0.54, '#072a42'],
      [1, '#0d3d4d'],
    ],
    accentGlow: 'rgba(75, 240, 190, 0.38)',
    pattern: 'aurora',
  },
  {
    id: 'bg-nat-lantern',
    name: 'Twilight River Reflection',
    category: 'Nature',
    cssGradient:
      'linear-gradient(180deg, #0b0b2e 0%, #3a1c5c 54%, #8c3454 100%)',
    canvasStops: [
      [0, '#0b0b2e'],
      [0.54, '#3a1c5c'],
      [1, '#8c3454'],
    ],
    accentGlow: 'rgba(255, 170, 90, 0.42)',
    pattern: 'stars',
  },

  // 6. Galaxy
  {
    id: 'bg-gal-nebula',
    name: 'Cosmic Golden Nebula',
    category: 'Galaxy',
    cssGradient:
      'radial-gradient(circle at 35% 30%, #2a115e 0%, #0e0629 55%, #03010a 100%)',
    canvasStops: [
      [0, '#2a115e'],
      [0.55, '#0e0629'],
      [1, '#03010a'],
    ],
    accentGlow: 'rgba(130, 95, 255, 0.48)',
    pattern: 'stars',
  },
  {
    id: 'bg-gal-stardust',
    name: 'Deep Space Stardust',
    category: 'Galaxy',
    cssGradient:
      'linear-gradient(180deg, #02010a 0%, #120938 50%, #061838 100%)',
    canvasStops: [
      [0, '#02010a'],
      [0.5, '#120938'],
      [1, '#061838'],
    ],
    accentGlow: 'rgba(80, 210, 255, 0.42)',
    pattern: 'stars',
  },

  // 7. City Night
  {
    id: 'bg-city-gold',
    name: 'Celebration City Skyline',
    category: 'City Night',
    cssGradient:
      'linear-gradient(180deg, #040210 0%, #140a3c 58%, #2e1650 100%)',
    canvasStops: [
      [0, '#040210'],
      [0.58, '#140a3c'],
      [1, '#2e1650'],
    ],
    accentGlow: 'rgba(255, 205, 90, 0.45)',
    pattern: 'skyline',
  },
  {
    id: 'bg-city-neon',
    name: 'Cyber Metropolis 2027',
    category: 'City Night',
    cssGradient:
      'linear-gradient(180deg, #040012 0%, #1c0538 55%, #3d0952 100%)',
    canvasStops: [
      [0, '#040012'],
      [0.55, '#1c0538'],
      [1, '#3d0952'],
    ],
    accentGlow: 'rgba(43, 232, 255, 0.48)',
    pattern: 'skyline',
  },

  // 8. Abstract
  {
    id: 'bg-abs-prism',
    name: 'Golden Silk Waves',
    category: 'Abstract',
    cssGradient:
      'radial-gradient(circle at 70% 25%, #3d2408 0%, #1b0d38 55%, #060312 100%)',
    canvasStops: [
      [0, '#3d2408'],
      [0.55, '#1b0d38'],
      [1, '#060312'],
    ],
    accentGlow: 'rgba(255, 200, 95, 0.45)',
    pattern: 'rays',
  },
  {
    id: 'bg-abs-emerald',
    name: 'Emerald & Gold Velvet',
    category: 'Abstract',
    cssGradient:
      'linear-gradient(180deg, #031712 0%, #093026 52%, #04120e 100%)',
    canvasStops: [
      [0, '#031712'],
      [0.52, '#093026'],
      [1, '#04120e'],
    ],
    accentGlow: 'rgba(110, 250, 204, 0.4)',
    pattern: 'bokeh',
  },
];

/**
 * Mode A: Automatic Background Selection
 * Chooses a harmonious background preset based on the active animation and music mood.
 */
export function resolveAutomaticBackground(
  animId: AnimId,
  mood?: MusicMood
): BackgroundPreset {
  if (mood === 'romantic') {
    return (
      BACKGROUND_GALLERY.find((b) => b.id === 'bg-rom-velvet') ||
      BACKGROUND_GALLERY[0]
    );
  }
  switch (animId) {
    case 'fireworks':
      return (
        BACKGROUND_GALLERY.find((b) => b.id === 'bg-city-gold') ||
        BACKGROUND_GALLERY[0]
      );
    case 'galaxy':
      return (
        BACKGROUND_GALLERY.find((b) => b.id === 'bg-gal-nebula') ||
        BACKGROUND_GALLERY[0]
      );
    case 'gold':
      return (
        BACKGROUND_GALLERY.find((b) => b.id === 'bg-lux-24k') ||
        BACKGROUND_GALLERY[0]
      );
    case 'neon':
      return (
        BACKGROUND_GALLERY.find((b) => b.id === 'bg-city-neon') ||
        BACKGROUND_GALLERY[0]
      );
    case 'aurora':
      return (
        BACKGROUND_GALLERY.find((b) => b.id === 'bg-nat-aurora') ||
        BACKGROUND_GALLERY[0]
      );
    case 'lanterns':
      return (
        BACKGROUND_GALLERY.find((b) => b.id === 'bg-nat-lantern') ||
        BACKGROUND_GALLERY[0]
      );
    case 'gift':
      return (
        BACKGROUND_GALLERY.find((b) => b.id === 'bg-rom-velvet') ||
        BACKGROUND_GALLERY[0]
      );
    case 'countdown':
      return (
        BACKGROUND_GALLERY.find((b) => b.id === 'bg-cel-royal') ||
        BACKGROUND_GALLERY[0]
      );
    case 'sparkler':
    default:
      return (
        BACKGROUND_GALLERY.find((b) => b.id === 'bg-cel-gold') ||
        BACKGROUND_GALLERY[0]
      );
  }
}

export function getBackgroundById(id: string): BackgroundPreset | undefined {
  return BACKGROUND_GALLERY.find((b) => b.id === id);
}
