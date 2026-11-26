/* ===== Original Blogger Canvas Animation Engine + All 9 Festive Animations ===== */
import { SfxType } from './sound';

const TAU = Math.PI * 2;

function R(a: number, b: number): number {
  return a + Math.random() * (b - a);
}
function RI(a: number, b: number): number {
  return Math.floor(R(a, b + 1));
}
function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}
function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}
function eo(t: number): number {
  t = clamp(t, 0, 1);
  return 1 - Math.pow(1 - t, 3);
}
function eio(t: number): number {
  t = clamp(t, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function mk(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}
function pick<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}

/* glow sprites cached by hue or css color */
const SPR: Record<string, HTMLCanvasElement> = {};

function glowH(h: number, l?: number): HTMLCanvasElement {
  h = Math.round((((h % 360) + 360) % 360) / 6) * 6;
  const lum = l || 60;
  const k = `${h}:${lum}`;
  if (SPR[k]) return SPR[k];
  const c = mk(64, 64);
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.12, `hsla(${h},100%,${lum + 20}%,1)`);
  gr.addColorStop(0.35, `hsla(${h},100%,${lum}%,.38)`);
  gr.addColorStop(1, `hsla(${h},100%,${lum}%,0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  SPR[k] = c;
  return c;
}

function softDot(col: string): HTMLCanvasElement {
  const k = 'd' + col;
  if (SPR[k]) return SPR[k];
  const c = mk(64, 64);
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, col);
  gr.addColorStop(0.55, col.replace(/[\d.]+\)$/, '0.35)'));
  gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  SPR[k] = c;
  return c;
}

/* stars */
interface Star {
  x: number;
  y: number;
  r: number;
  p: number;
  s: number;
}
function makeStars(n: number, w: number, h: number): Star[] {
  const a: Star[] = [];
  for (let i = 0; i < n; i++) {
    a.push({
      x: R(0, w),
      y: R(0, h),
      r: Math.pow(Math.random(), 2.4) * 1.6 + 0.3,
      p: R(0, TAU),
      s: R(0.6, 2.4),
    });
  }
  return a;
}
function drawStars(g: CanvasRenderingContext2D, a: Star[], t: number) {
  g.fillStyle = '#fff';
  for (let i = 0; i < a.length; i++) {
    const s = a[i];
    g.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(s.p + t * s.s));
    g.beginPath();
    g.arc(s.x, s.y, s.r, 0, TAU);
    g.fill();
  }
  g.globalAlpha = 1;
}

interface ShootStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
}
function shootStar(list: ShootStar[], w: number, h: number) {
  list.push({
    x: R(0.1, 0.9) * w,
    y: R(0, 0.35) * h,
    vx: R(-1, 1) > 0 ? R(380, 560) : -R(380, 560),
    vy: R(140, 240),
    life: 0,
    max: R(0.6, 1),
  });
}
function drawShoot(g: CanvasRenderingContext2D, list: ShootStar[], dt: number) {
  for (let i = list.length - 1; i >= 0; i--) {
    const s = list[i];
    s.life += dt;
    if (s.life > s.max) {
      list.splice(i, 1);
      continue;
    }
    const a = Math.sin((Math.PI * s.life) / s.max);
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    const gr = g.createLinearGradient(s.x, s.y, s.x - s.vx * 0.18, s.y - s.vy * 0.18);
    gr.addColorStop(0, `rgba(255,255,255,${a})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.strokeStyle = gr;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(s.x, s.y);
    g.lineTo(s.x - s.vx * 0.18, s.y - s.vy * 0.18);
    g.stroke();
  }
}

/* firework sparks */
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  h: number;
  l: number;
  drag: number;
  gr: number;
  sz: number;
  trail: number;
  crk?: boolean;
}
interface BurstOpts {
  n?: number;
  spd?: number;
  hue?: number;
  shape?: 'ring' | 'heart';
  flat?: number;
  life?: number;
  hv?: number;
  l?: number;
  drag?: number;
  g?: number;
  sz?: number;
  trail?: number;
  crk?: boolean;
}
function burst(arr: Spark[], x: number, y: number, o: BurstOpts) {
  const n = Math.round(o.n || 80);
  const sp = o.spd || 240;
  const hue = o.hue == null ? R(0, 360) : o.hue;
  for (let i = 0; i < n; i++) {
    let a = 0;
    let v = 0;
    let vx = 0;
    let vy = 0;
    if (o.shape === 'ring') {
      a = (i / n) * TAU;
      v = sp;
      vx = Math.cos(a) * v;
      vy = Math.sin(a) * v * (o.flat || 1);
    } else if (o.shape === 'heart') {
      a = (i / n) * TAU;
      const hx = 16 * Math.pow(Math.sin(a), 3);
      const hy = -(
        13 * Math.cos(a) -
        5 * Math.cos(2 * a) -
        2 * Math.cos(3 * a) -
        Math.cos(4 * a)
      );
      vx = (hx * sp) / 16;
      vy = (hy * sp) / 16;
    } else {
      a = R(0, TAU);
      v = Math.sqrt(Math.random()) * sp;
      vx = Math.cos(a) * v;
      vy = Math.sin(a) * v;
    }
    arr.push({
      x,
      y,
      vx,
      vy,
      age: 0,
      life: R(o.life || 1.3, (o.life || 1.3) * 1.45),
      h: hue + R(-(o.hv || 14), o.hv || 14),
      l: o.l || 60,
      drag: o.drag || 0.965,
      gr: o.g == null ? 90 : o.g,
      sz: R(1.1, 2.1) * (o.sz || 1),
      trail: o.trail || 0.05,
      crk: !!o.crk,
    });
  }
}

function drawSparks(g: CanvasRenderingContext2D, arr: Spark[], dt: number, k: number) {
  g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round';
  for (let i = arr.length - 1; i >= 0; i--) {
    const p = arr[i];
    p.age += dt;
    if (p.age > p.life) {
      arr.splice(i, 1);
      continue;
    }
    const f = Math.pow(p.drag, dt * 60);
    p.vx *= f;
    p.vy *= f;
    p.vy += p.gr * k * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const u = p.age / p.life;
    let a = Math.pow(1 - u, 0.9);
    if (u > 0.6 && Math.random() < 0.35) a *= 0.25;
    g.globalAlpha = a;
    g.strokeStyle = `hsl(${p.h},100%,${p.l + 8}%)`;
    g.lineWidth = p.sz;
    g.beginPath();
    g.moveTo(p.x - p.vx * p.trail, p.y - p.vy * p.trail);
    g.lineTo(p.x, p.y);
    g.stroke();
    const s = p.sz * 7;
    g.drawImage(glowH(p.h, p.l), p.x - s, p.y - s, s * 2, s * 2);
    if (p.crk && u > 0.7 && Math.random() < 0.05) {
      arr.push({
        x: p.x,
        y: p.y,
        vx: R(-40, 40),
        vy: R(-40, 40),
        age: 0,
        life: 0.25,
        h: 50,
        l: 85,
        drag: 0.9,
        gr: 0,
        sz: 1.4,
        trail: 0.02,
      });
    }
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

/* confetti */
const GOLDS = ['#ffd76a', '#f5c142', '#fff1b8', '#e0a526', '#ffffff', '#c98e1d'];
const PARTY = ['#ff3d71', '#ffd23f', '#3dd6ff', '#7c5cff', '#2ee59d', '#ff8a3d', '#ffffff'];

interface Confetto {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  vr: number;
  f: number;
  vf: number;
  w: number;
  h: number;
  c: string;
  sw: number;
}
interface ConfettiOpts {
  dir?: number;
  spread?: number;
  v0?: number;
  v1?: number;
  xs?: number;
  sz?: number;
  cols?: string[];
}
function confetti(arr: Confetto[], x: number, y: number, n: number, o?: ConfettiOpts) {
  const opts = o || {};
  for (let i = 0; i < n; i++) {
    const a =
      (opts.dir == null ? -Math.PI / 2 : opts.dir) +
      R(-(opts.spread || 1.2), opts.spread || 1.2);
    const v = R(opts.v0 || 200, opts.v1 || 620);
    arr.push({
      x: x + R(-(opts.xs || 4), opts.xs || 4),
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      r: R(0, TAU),
      vr: R(-7, 7),
      f: R(0, TAU),
      vf: R(4, 11),
      w: R(6, 11) * (opts.sz || 1),
      h: R(3, 6) * (opts.sz || 1),
      c: pick(opts.cols || PARTY),
      sw: R(0, TAU),
    });
  }
}

function drawConfetti(
  g: CanvasRenderingContext2D,
  arr: Confetto[],
  dt: number,
  H: number,
  k: number
) {
  for (let i = arr.length - 1; i >= 0; i--) {
    const p = arr[i];
    const f = Math.pow(0.985, dt * 60);
    p.vx *= f;
    p.vy = p.vy * f + 260 * k * dt;
    if (p.vy > 140 * k) p.vy = 140 * k;
    p.sw += dt * 3;
    p.x += (p.vx + Math.sin(p.sw) * 30 * k) * dt;
    p.y += p.vy * dt;
    p.r += p.vr * dt;
    p.f += p.vf * dt;
    if (p.y > H + 30) {
      arr.splice(i, 1);
      continue;
    }
    const c = Math.cos(p.f);
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.r);
    g.scale(1, c);
    g.fillStyle = p.c;
    g.globalAlpha = 0.75 + 0.25 * Math.abs(c);
    g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    if (c > 0) {
      g.fillStyle = 'rgba(255,255,255,.35)';
      g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * 0.35);
    }
    g.restore();
  }
  g.globalAlpha = 1;
}

/* extruded gold text drawn on canvas */
function goldText(
  g: CanvasRenderingContext2D,
  str: string,
  cx: number,
  cy: number,
  size: number,
  o?: { fam?: string; glow?: string }
) {
  const opts = o || {};
  g.save();
  g.font = `900 ${size}px ${opts.fam || 'Cinzel, Georgia, serif'}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const d = Math.max(2, size * 0.06);
  for (let i = Math.round(d); i > 0; i--) {
    g.fillStyle = `rgb(${70 + i * 4},${40 + i * 2},8)`;
    g.fillText(str, cx, cy + i);
  }
  g.shadowColor = opts.glow || 'rgba(255,190,60,.55)';
  g.shadowBlur = size * 0.25;
  const gr = g.createLinearGradient(0, cy - size * 0.5, 0, cy + size * 0.5);
  gr.addColorStop(0, '#fff8d8');
  gr.addColorStop(0.35, '#ffd76a');
  gr.addColorStop(0.55, '#e0a020');
  gr.addColorStop(0.72, '#fff0b0');
  gr.addColorStop(1, '#b87818');
  g.fillStyle = gr;
  g.fillText(str, cx, cy);
  g.restore();
}

function fitFont(
  g: CanvasRenderingContext2D,
  str: string,
  wMax: number,
  hMax: number,
  fam: string
): number {
  let s = hMax;
  g.font = `900 ${s}px ${fam}`;
  const m = g.measureText(str).width;
  if (m > wMax && m > 0) s *= wMax / m;
  return s;
}

function skyline(w: number, h: number, small: boolean): HTMLCanvasElement {
  const H = h * 0.2;
  const c = mk(w, H);
  const g = c.getContext('2d')!;
  let x = 0;
  while (x < w) {
    const bw = R(small ? 10 : 22, small ? 26 : 64);
    const bh = R(0.25, 1) * H;
    g.fillStyle = '#06030f';
    g.fillRect(x, H - bh, bw, bh);
    g.fillStyle = 'rgba(140,90,255,.25)';
    g.fillRect(x, H - bh, bw, 1.5);
    if (Math.random() < 0.2) {
      g.fillStyle = '#06030f';
      g.fillRect(x + bw / 2 - 1, H - bh - R(6, 18), 2, 20);
    }
    for (let yy = H - bh + 6; yy < H - 4; yy += small ? 5 : 9) {
      for (let xx = x + 4; xx < x + bw - 4; xx += small ? 4 : 8) {
        if (Math.random() < 0.28) {
          g.fillStyle = `rgba(255,${RI(190, 230)},120,${R(0.35, 0.9)})`;
          g.fillRect(xx, yy, small ? 1.5 : 3, small ? 2 : 4);
        }
      }
    }
    x += bw + R(0, 3);
  }
  return c;
}

export type AnimId =
  | 'sparkler'
  | 'fireworks'
  | 'galaxy'
  | 'countdown'
  | 'lanterns'
  | 'gold'
  | 'neon'
  | 'gift'
  | 'aurora';

export const ANIM_IDS: AnimId[] = [
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

export interface AnimDef {
  id: AnimId;
  name: string;
  ico: string;
  reveal: number;
  theme: 'gold' | 'neon' | 'ice';
  ownYear?: boolean;
  ownName?: boolean;
  textTop?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  init: (E: Engine) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  relayout?: (E: Engine, s: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  draw: (E: Engine, s: any) => void;
}

export const ANIM: Record<AnimId, AnimDef> = {
  /* 1. Sparkler Name */
  sparkler: {
    id: 'sparkler',
    name: 'Sparkler Name',
    ico: '🎇',
    reveal: 2.7,
    theme: 'gold',
    ownName: true,
    init(E) {
      const s = {
        stars: makeStars(E.small ? 40 : 130, E.w, E.h),
        p: [] as Spark[],
        bok: [] as Array<{ x: number; y: number; r: number; p: number; c: string }>,
        txt: null as HTMLCanvasElement | null,
        ox: 0,
        oy: 0,
        cols: [] as number[],
        x0: 0,
        x1: 1,
      };
      for (let i = 0; i < (E.small ? 10 : 26); i++) {
        s.bok.push({
          x: R(0, E.w),
          y: R(0, E.h),
          r: R(10, 44) * E.k,
          p: R(0, TAU),
          c: pick(['rgba(255,190,80,.45)', 'rgba(255,120,60,.35)', 'rgba(140,120,255,.3)']),
        });
      }
      this.relayout!(E, s);
      return s;
    },
    relayout(E, s) {
      const rc = E.nameRect();
      const str = E.nameText() || 'आपका नाम';
      const pad = 24;
      const c = mk(rc.w + pad * 2, rc.h + pad * 2);
      const x = c.getContext('2d')!;
      const fam =
        'Poppins, "Noto Sans Devanagari", "Noto Sans Bengali", "Noto Sans Gujarati", "Noto Sans Tamil", "Noto Sans Telugu", "Noto Sans Kannada", "Noto Sans Malayalam", "Noto Sans Gurmukhi", "Noto Sans Oriya", sans-serif';
      const fs = fitFont(x, str, rc.w * 0.96, rc.h * 0.82, fam);
      goldText(x, str, c.width / 2, c.height / 2, fs, {
        fam,
        glow: 'rgba(255,170,40,.9)',
      });
      const d = x.getImageData(0, 0, c.width, c.height).data;
      const cols: number[] = [];
      for (let xx = 0; xx < c.width; xx += 3) {
        const ys: number[] = [];
        for (let yy = 0; yy < c.height; yy += 3) {
          if (d[(yy * c.width + xx) * 4 + 3] > 160) ys.push(yy);
        }
        cols.push(ys.length ? ys[Math.floor(ys.length / 2)] : -1);
      }
      let mn = c.width;
      let mx = 0;
      cols.forEach((v, i) => {
        if (v >= 0) {
          mn = Math.min(mn, i * 3);
          mx = Math.max(mx, i * 3);
        }
      });
      s.txt = c;
      s.ox = rc.x - pad;
      s.oy = rc.y - pad;
      s.cols = cols;
      s.x0 = mn;
      s.x1 = Math.max(mn + 1, mx);
    },
    draw(E, s) {
      const g = E.g;
      const w = E.w;
      const h = E.h;
      const t = E.t;
      const dt = E.dt;
      const k = E.k;
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#05030f');
      gr.addColorStop(0.6, '#1a0b2e');
      gr.addColorStop(1, '#3a1208');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      drawStars(g, s.stars, t);
      g.globalCompositeOperation = 'lighter';
      s.bok.forEach((o: { x: number; y: number; r: number; p: number; c: string }) => {
        g.globalAlpha = 0.25 + 0.25 * Math.sin(t * 0.8 + o.p);
        g.drawImage(softDot(o.c), o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
      });
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      if (!s.txt) return;
      const u = eio((t - 0.35) / 2.2);
      const lx = s.x0 + (s.x1 - s.x0) * u;
      const ci = Math.min(s.cols.length - 1, Math.max(0, Math.round(lx / 3)));
      let cy = s.cols[ci];
      for (let q = 0; cy < 0 && q < 12; q++) {
        cy = s.cols[Math.max(0, ci - q)];
      }
      if (cy < 0 || cy == null) cy = s.txt.height / 2;
      const hx = s.ox + lx + Math.sin(t * 40) * 2;
      const hy = s.oy + cy + Math.sin(t * 23) * 4 * (1 - u * 0.5);
      if (t > 0.35) {
        g.save();
        g.beginPath();
        g.rect(s.ox, s.oy - 10, lx + 2, s.txt.height + 20);
        g.clip();
        g.drawImage(s.txt, s.ox, s.oy);
        g.restore();
      }
      const writing = t > 0.35 && t < 2.6;
      const live = t > 0.2;
      if (live) {
        const ex = writing ? hx : s.ox + s.x1 + 6 + Math.sin(t * 2) * 4;
        const ey = writing
          ? hy
          : s.oy + s.txt.height * 0.45 + Math.cos(t * 1.7) * 6;
        if (!writing) {
          g.strokeStyle = 'rgba(90,90,100,.9)';
          g.lineWidth = 2.5;
          g.beginPath();
          g.moveTo(ex, ey);
          g.lineTo(ex + 34 * k, ey + 90 * k);
          g.stroke();
        }
        const nS = (E.small ? 4 : 14) * (writing ? 1 : 0.6) * (E.reducedMotion ? 0.3 : 1);
        for (let i = 0; i < nS; i++) {
          const a = R(0, TAU);
          const v = R(120, 420) * k;
          s.p.push({
            x: ex,
            y: ey,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v,
            age: 0,
            life: R(0.12, 0.45),
            h: R(36, 52),
            l: 68,
            drag: 0.9,
            gr: 200,
            sz: R(0.8, 1.5),
            trail: 0.035,
            crk: Math.random() < 0.25,
          });
        }
        g.globalCompositeOperation = 'lighter';
        const gs = (26 + Math.random() * 10) * k * (E.small ? 0.7 : 1.2);
        g.drawImage(glowH(42, 70), ex - gs * 2, ey - gs * 2, gs * 4, gs * 4);
        g.drawImage(glowH(50, 85), ex - gs * 0.6, ey - gs * 0.6, gs * 1.2, gs * 1.2);
        g.globalCompositeOperation = 'source-over';
        if (writing && Math.random() < dt * 6) E.sfx('tick');
      }
      drawSparks(g, s.p, dt, k);
    },
  },

  /* 2. Royal Fireworks */
  fireworks: {
    id: 'fireworks',
    name: 'Royal Fireworks',
    ico: '🎆',
    reveal: 0.9,
    theme: 'gold',
    init(E) {
      return {
        stars: makeStars(E.small ? 40 : 150, E.w, E.h * 0.75),
        sky: skyline(E.w, E.h, E.small),
        rk: [] as Array<{
          x: number;
          y: number;
          ty: number;
          vx: number;
          vy: number;
          h: number;
        }>,
        p: [] as Spark[],
        next: 0.15,
        flash: 0,
        n0: 0,
      };
    },
    draw(E, s) {
      const g = E.g;
      const w = E.w;
      const h = E.h;
      const dt = E.dt;
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#04010d');
      gr.addColorStop(0.55, '#120a36');
      gr.addColorStop(1, '#2c1454');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      if (s.flash > 0.01 && !E.reducedMotion) {
        g.fillStyle = `rgba(255,214,170,${s.flash * 0.1})`;
        g.fillRect(0, 0, w, h);
        s.flash *= Math.pow(0.9, dt * 60);
      }
      drawStars(g, s.stars, E.t);
      s.next -= dt;
      if (s.next <= 0 && s.p.length < 1600) {
        const k = E.k;
        s.rk.push({
          x: R(0.14, 0.86) * E.w,
          y: E.h * 0.96,
          ty: R(0.1, 0.42) * E.h,
          vx: R(-25, 25) * k,
          vy: -R(620, 780) * k,
          h: R(0, 360),
        });
        s.n0++;
        s.next =
          s.n0 < 4
            ? 0.25
            : R(0.35, 0.85) * (E.small ? 1.6 : 1) * (E.reducedMotion ? 2 : 1);
      }
      g.globalCompositeOperation = 'lighter';
      for (let i = s.rk.length - 1; i >= 0; i--) {
        const r = s.rk[i];
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.vy += 160 * E.k * dt;
        g.drawImage(glowH(r.h, 70), r.x - 9, r.y - 9, 18, 18);
        if (Math.random() < 0.8) {
          s.p.push({
            x: r.x,
            y: r.y + 4,
            vx: R(-20, 20),
            vy: R(20, 70),
            age: 0,
            life: R(0.3, 0.6),
            h: 38,
            l: 60,
            drag: 0.95,
            gr: 30,
            sz: 1,
            trail: 0.03,
          });
        }
        if (r.y <= r.ty || r.vy > -60) {
          s.rk.splice(i, 1);
          const k = E.k;
          const sm = (E.small ? 0.45 : 1) * (E.reducedMotion ? 0.5 : 1);
          const rnd = Math.random();
          if (rnd < 0.3) {
            burst(s.p, r.x, r.y, { n: 110 * sm, spd: 270 * k, hue: r.h });
          } else if (rnd < 0.45) {
            burst(s.p, r.x, r.y, {
              n: 70 * sm,
              spd: 240 * k,
              hue: r.h,
              shape: 'ring',
              flat: R(0.45, 1),
            });
            burst(s.p, r.x, r.y, { n: 30 * sm, spd: 90 * k, hue: r.h + 180 });
          } else if (rnd < 0.65) {
            burst(s.p, r.x, r.y, {
              n: 90 * sm,
              spd: 230 * k,
              hue: 42,
              l: 58,
              life: 2.4,
              drag: 0.955,
              g: 55,
              trail: 0.12,
              hv: 6,
              crk: true,
            });
          } else if (rnd < 0.78 && !E.small) {
            burst(s.p, r.x, r.y, { n: 80 * sm, spd: 210 * k, hue: 335, shape: 'heart' });
          } else if (rnd < 0.9) {
            burst(s.p, r.x, r.y, { n: 90 * sm, spd: 260 * k, hue: r.h });
            burst(s.p, r.x, r.y, { n: 50 * sm, spd: 140 * k, hue: r.h + 120 });
          } else {
            burst(s.p, r.x, r.y, {
              n: 100 * sm,
              spd: 250 * k,
              hue: 200,
              l: 75,
              crk: true,
              hv: 40,
            });
          }
          s.flash = Math.min(1, s.flash + 0.7);
          E.sfx('boom');
        }
      }
      g.globalCompositeOperation = 'source-over';
      drawSparks(g, s.p, dt, E.k);
      g.drawImage(s.sky, 0, h - s.sky.height);
    },
  },

  /* 3. Galaxy Stars */
  galaxy: {
    id: 'galaxy',
    name: 'Galaxy Stars',
    ico: '🌌',
    reveal: 2.4,
    theme: 'gold',
    ownYear: true,
    init(E) {
      const w = E.w;
      const h = E.h;
      const s = {
        stars: makeStars(E.small ? 50 : 170, w, h),
        sh: [] as ShootStar[],
        neb: mk(w, h),
        pts: [] as Array<{
          arm: number;
          r: number;
          a: number;
          d: number;
          tx: number;
          ty: number;
          hue: number;
          sz: number;
          ph: number;
        }>,
        rc: { x: 0, y: 0, w: 100, h: 50 },
        fs: 60,
      };
      const ng = s.neb.getContext('2d')!;
      const blobs: Array<[number, number, string]> = [
        [0.25, 0.3, 'rgba(120,60,255,.28)'],
        [0.8, 0.25, 'rgba(0,200,255,.18)'],
        [0.6, 0.75, 'rgba(255,60,170,.18)'],
        [0.2, 0.8, 'rgba(60,120,255,.2)'],
      ];
      blobs.forEach((b) => {
        const r = Math.max(w, h) * 0.55;
        const gr = ng.createRadialGradient(b[0] * w, b[1] * h, 0, b[0] * w, b[1] * h, r);
        gr.addColorStop(0, b[2]);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        ng.fillStyle = gr;
        ng.fillRect(0, 0, w, h);
      });
      const N = E.small ? 360 : w * h > 500000 ? 1700 : 1300;
      for (let i = 0; i < N; i++) {
        const arm = i % 3;
        const rr = Math.pow(Math.random(), 0.7) * Math.max(w, h) * 0.55;
        s.pts.push({
          arm,
          r: rr,
          a: (arm * TAU) / 3 + rr * 0.011 + R(-0.35, 0.35),
          d: R(0, 1.3),
          tx: 0,
          ty: 0,
          hue: 0,
          sz: R(0.8, 1.9),
          ph: R(0, TAU),
        });
      }
      this.relayout!(E, s);
      return s;
    },
    relayout(E, s) {
      const rc = E.yearRect();
      const g = mk(rc.w, rc.h);
      const x = g.getContext('2d')!;
      const str = String(E.year);
      const fs = fitFont(x, str, rc.w * 0.96, rc.h * 0.92, 'Cinzel, Georgia, serif');
      x.font = `900 ${fs}px Cinzel, Georgia, serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillStyle = '#fff';
      x.fillText(str, rc.w / 2, rc.h / 2);
      const d = x.getImageData(0, 0, g.width, g.height).data;
      const on: number[] = [];
      const st = 2;
      for (let yy = 0; yy < g.height; yy += st) {
        for (let xx = 0; xx < g.width; xx += st) {
          if (d[(yy * g.width + xx) * 4 + 3] > 140) on.push(xx, yy);
        }
      }
      const M = on.length / 2;
      s.rc = rc;
      s.fs = fs;
      if (!M) return;
      for (let i = 0; i < s.pts.length; i++) {
        const j = Math.floor(Math.random() * M) * 2;
        const p = s.pts[i];
        p.tx = rc.x + on[j];
        p.ty = rc.y + on[j + 1];
        p.hue = lerp(36, 52, on[j] / rc.w);
      }
    },
    draw(E, s) {
      const g = E.g;
      const w = E.w;
      const h = E.h;
      const t = E.t;
      const cx = w / 2;
      const cy = h * 0.5;
      g.fillStyle = '#030210';
      g.fillRect(0, 0, w, h);
      g.drawImage(s.neb, 0, 0);
      drawStars(g, s.stars, t);
      if (t > 3.5 && Math.random() < E.dt * 0.5) shootStar(s.sh, w, h);
      drawShoot(g, s.sh, E.dt);
      if (s.rc && t > 2.3) {
        const ga = eo((t - 2.3) / 1.1);
        g.globalAlpha = ga;
        goldText(g, String(E.year), s.rc.x + s.rc.w / 2, s.rc.y + s.rc.h / 2, s.fs, {
          glow: 'rgba(255,200,90,.8)',
        });
        g.globalAlpha = 1;
        if (t < 3.4) {
          const rr2 = eo((t - 2.3) / 1.1) * Math.max(w, h) * 0.7;
          g.strokeStyle = `rgba(255,220,150,${(1 - ga) * 0.7})`;
          g.lineWidth = 3;
          g.beginPath();
          g.arc(s.rc.x + s.rc.w / 2, s.rc.y + s.rc.h / 2, rr2, 0, TAU);
          g.stroke();
        }
      }
      g.globalCompositeOperation = 'lighter';
      const core = 1 - eo((t - 0.4) / 2.2);
      if (core > 0) {
        const cs = Math.min(w, h) * 0.5 * core;
        g.globalAlpha = core * 0.9;
        g.drawImage(glowH(270, 65), cx - cs, cy - cs, cs * 2, cs * 2);
        g.globalAlpha = 1;
      }
      for (let i = 0; i < s.pts.length; i++) {
        const p = s.pts[i];
        const k = eio((t - 0.5 - p.d) / 1.7);
        const ang = p.a + t * (55 / (p.r + 60));
        const gx = cx + Math.cos(ang) * p.r;
        const gy = cy + Math.sin(ang) * p.r * 0.55;
        const wob = Math.sin(t * 2 + p.ph) * 1.2;
        let x = lerp(gx, p.tx + wob, k);
        let y = lerp(gy, p.ty + Math.cos(t * 1.7 + p.ph) * 1.2, k);
        if (E.ptr && k > 0.99) {
          const dx = x - E.ptr.x;
          const dy = y - E.ptr.y;
          const dd = dx * dx + dy * dy;
          if (dd < 3600) {
            const f = ((3600 - dd) / 3600) * 26;
            const dl = Math.sqrt(dd) || 1;
            x += (dx / dl) * f;
            y += (dy / dl) * f;
          }
        }
        const hue = lerp(250 - p.r * 0.08, p.hue, k);
        const sz =
          p.sz * (1 + 0.9 * Math.max(0, Math.sin(t * 3 + p.ph * 3)) * k) * (3.2 - 1.4 * k);
        g.globalAlpha = (0.55 + 0.45 * k) * (t > 3 ? 0.75 : 1);
        g.drawImage(glowH(hue, k > 0.5 ? 62 : 66), x - sz, y - sz, sz * 2, sz * 2);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    },
  },

  /* 4. Midnight Countdown */
  countdown: {
    id: 'countdown',
    name: 'Midnight Countdown',
    ico: '⏰',
    reveal: 3.15,
    theme: 'gold',
    ownYear: true,
    init(E) {
      const s = {
        bok: [] as Array<{
          x: number;
          y: number;
          r: number;
          vy: number;
          c: string;
          p: number;
        }>,
        p: [] as Spark[],
        cf: [] as Confetto[],
        last: -1,
        boomed: false,
        next: 0,
      };
      for (let i = 0; i < (E.small ? 12 : 34); i++) {
        s.bok.push({
          x: R(0, E.w),
          y: R(0, E.h),
          r: R(10, 46) * E.k,
          vy: R(6, 22),
          c: pick(['rgba(255,200,90,.5)', 'rgba(255,90,170,.4)', 'rgba(120,140,255,.4)']),
          p: R(0, TAU),
        });
      }
      return s;
    },
    draw(E, s) {
      const g = E.g;
      const w = E.w;
      const h = E.h;
      const t = E.t;
      const k = E.k;
      const dt = E.dt;
      const gr = g.createRadialGradient(
        w / 2,
        h * 0.45,
        0,
        w / 2,
        h * 0.45,
        Math.max(w, h) * 0.75
      );
      gr.addColorStop(0, '#22185e');
      gr.addColorStop(1, '#04020c');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';
      s.bok.forEach(
        (b: { x: number; y: number; r: number; vy: number; c: string; p: number }) => {
          b.y -= b.vy * dt;
          if (b.y < -60) b.y = h + 60;
          g.globalAlpha = 0.35 + 0.3 * Math.sin(t + b.p);
          g.drawImage(softDot(b.c), b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
        }
      );
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      const rc = E.yearRect();
      const cx = w / 2;
      const cy = rc.y + rc.h / 2;
      if (t < 3) {
        const n = 3 - Math.floor(t);
        const u = t % 1;
        const rr = Math.min(w, h) * 0.2;
        if (n !== s.last) {
          s.last = n;
          E.sfx('tick');
        }
        g.lineWidth = Math.max(3, rr * 0.06);
        g.strokeStyle = 'rgba(255,255,255,.12)';
        g.beginPath();
        g.arc(cx, cy, rr, 0, TAU);
        g.stroke();
        g.save();
        g.shadowColor = 'rgba(255,200,80,.9)';
        g.shadowBlur = 24;
        g.strokeStyle = '#ffd76a';
        g.lineCap = 'round';
        g.beginPath();
        g.arc(cx, cy, rr, -Math.PI / 2, -Math.PI / 2 + u * TAU);
        g.stroke();
        g.restore();
        const sc = 1.35 - 0.35 * eo(u * 3);
        const al = u > 0.8 ? (1 - u) / 0.2 : 1;
        g.globalAlpha = al;
        goldText(g, String(n), cx, cy + rr * 0.05, rr * 1.15 * sc);
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(255,255,255,.75)';
        const lf = fitFont(
          g,
          'COUNTDOWN TO ' + E.year,
          w * 0.86,
          Math.max(10, rr * 0.16),
          'Poppins, sans-serif'
        );
        g.font = `700 ${lf}px Poppins, sans-serif`;
        g.textAlign = 'center';
        g.fillText('COUNTDOWN TO ' + E.year, cx, cy - rr - rr * 0.25);
      } else {
        if (!s.boomed) {
          s.boomed = true;
          E.sfx('boom');
          for (let i = 0; i < 3; i++) {
            burst(s.p, R(0.2, 0.8) * w, R(0.12, 0.35) * h, {
              n: E.small ? 50 : 120,
              spd: 280 * k,
            });
          }
          confetti(s.cf, 0, h, E.small ? 40 : 110, {
            dir: -1.05,
            spread: 0.35,
            v0: 500 * k,
            v1: 1000 * k,
          });
          confetti(s.cf, w, h, E.small ? 40 : 110, {
            dir: -2.09,
            spread: 0.35,
            v0: 500 * k,
            v1: 1000 * k,
          });
        }
        s.next -= dt;
        if (s.next <= 0) {
          s.next = R(0.9, 1.6);
          burst(s.p, R(0.15, 0.85) * w, R(0.08, 0.3) * h, {
            n: E.small ? 40 : 90,
            spd: 230 * k,
          });
          E.sfx('boom');
        }
        if (Math.random() < dt * 14) {
          confetti(s.cf, R(0, w), -10, 1, {
            dir: Math.PI / 2,
            spread: 0.3,
            v0: 30,
            v1: 90,
          });
        }
        drawSparks(g, s.p, dt, k);
        drawConfetti(g, s.cf, dt, h, k);
        const ft = 1 - (t - 3) / 0.35;
        if (ft > 0 && !E.reducedMotion) {
          g.fillStyle = `rgba(255,245,220,${ft * 0.5})`;
          g.fillRect(0, 0, w, h);
        }
        const str = String(E.year);
        const head = str.slice(0, -1);
        const last = +str.slice(-1);
        const prev = (last + 9) % 10;
        const fs = fitFont(g, str, rc.w * 0.96, rc.h * 0.9, 'Cinzel, Georgia, serif');
        g.font = `900 ${fs}px Cinzel, Georgia, serif`;
        const wAll = g.measureText(str).width;
        const wHead = g.measureText(head).width;
        const wl = g.measureText(String(last)).width;
        const x0 = cx - wAll / 2;
        const rk = eio((t - 3.05) / 0.75);
        const dx = x0 + wHead + wl / 2;
        goldText(g, head, x0 + wHead / 2, cy, fs);
        g.save();
        g.beginPath();
        g.rect(dx - wl, cy - fs * 0.62, wl * 2, fs * 1.24);
        g.clip();
        goldText(g, String(prev), dx, cy - rk * fs * 1.1, fs);
        goldText(g, String(last), dx, cy + (1 - rk) * fs * 1.1, fs);
        g.restore();
      }
    },
  },

  /* 5. Sky Lanterns */
  lanterns: {
    id: 'lanterns',
    name: 'Sky Lanterns',
    ico: '🏮',
    reveal: 0.8,
    theme: 'gold',
    init(E) {
      const w = E.w;
      const h = E.h;
      const s = {
        stars: makeStars(E.small ? 30 : 110, w, h * 0.55),
        L: [] as Array<{ x: number; y: number; z: number; ph: number; fl: number }>,
        wy: h * 0.8,
        hills: mk(w, h * 0.14),
        sh: [] as ShootStar[],
      };
      const hg = s.hills.getContext('2d')!;
      const H = s.hills.height;
      hg.fillStyle = '#1a0d2c';
      hg.beginPath();
      hg.moveTo(0, H);
      for (let x = 0; x <= w; x += 12) {
        hg.lineTo(
          x,
          H * (0.35 + 0.25 * Math.sin(x * 0.006) + 0.15 * Math.sin(x * 0.021 + 2))
        );
      }
      hg.lineTo(w, H);
      hg.fill();
      for (let i = 0; i < (E.small ? 10 : 30); i++) {
        const z = Math.pow(Math.random(), 1.4) * 0.8 + 0.2;
        s.L.push({
          x: R(0, E.w),
          y: R(0.05, 0.78) * h,
          z,
          ph: R(0, TAU),
          fl: R(0, TAU),
        });
      }
      return s;
    },
    draw(E, s) {
      const g = E.g;
      const w = E.w;
      const h = E.h;
      const t = E.t;
      const dt = E.dt;
      const k = E.k;
      const wy = s.wy;
      const gr = g.createLinearGradient(0, 0, 0, wy);
      gr.addColorStop(0, '#0a0a2e');
      gr.addColorStop(0.5, '#3a1d5e');
      gr.addColorStop(0.82, '#c2456b');
      gr.addColorStop(1, '#ff9a4d');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, wy);
      drawStars(g, s.stars, t);
      const mx = w * 0.8;
      const my = h * 0.14;
      const mr = Math.min(w, h) * 0.05;
      g.globalCompositeOperation = 'lighter';
      g.drawImage(glowH(45, 75), mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#fff4d6';
      g.beginPath();
      g.arc(mx, my, mr, 0, TAU);
      g.fill();
      if (Math.random() < dt * 0.25) shootStar(s.sh, w, h * 0.6);
      drawShoot(g, s.sh, dt);
      g.drawImage(s.hills, 0, wy - s.hills.height + 2);
      const wg = g.createLinearGradient(0, wy, 0, h);
      wg.addColorStop(0, '#3b1840');
      wg.addColorStop(1, '#0b0618');
      g.fillStyle = wg;
      g.fillRect(0, wy, w, h - wy);
      s.L.sort((a: { z: number }, b: { z: number }) => a.z - b.z);
      for (let i = s.L.length - 1; i >= 0; i--) {
        const L = s.L[i];
        L.y -= (10 + 34 * L.z) * k * dt;
        L.ph += dt * 0.8;
        const x = L.x + Math.sin(L.ph) * 10 * L.z;
        const fl = 0.8 + 0.2 * Math.sin(t * 9 + L.fl) * Math.sin(t * 5.3 + L.fl);
        const sz =
          (8 + 30 * L.z) * k * (E.small ? 0.8 : 1) * (0.6 + 0.4 * clamp(L.y / wy, 0, 1));
        if (L.y < -sz * 3) {
          s.L.splice(i, 1);
          const z = Math.pow(Math.random(), 1.4) * 0.8 + 0.2;
          s.L.push({ x: R(0, E.w), y: wy + R(0, 40), z, ph: R(0, TAU), fl: R(0, TAU) });
          continue;
        }
        if (L.y < wy) {
          const ry = wy + (wy - L.y) * 0.25;
          if (ry < h) {
            g.globalCompositeOperation = 'lighter';
            g.globalAlpha = 0.22 * fl;
            const rs = sz * 2.2;
            g.drawImage(glowH(30, 55), x - rs * 1.4, ry - rs * 0.5, rs * 2.8, rs);
            g.globalAlpha = 1;
            g.globalCompositeOperation = 'source-over';
          }
          // draw lantern
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = 0.38 * fl;
          const gs = sz * 3.4;
          g.drawImage(glowH(30, 55), x - gs, L.y - gs, gs * 2, gs * 2);
          g.globalAlpha = 1;
          g.globalCompositeOperation = 'source-over';
          const tw = sz * 0.62;
          const bw = sz * 0.86;
          const hh = sz * 1.15;
          const lgr = g.createLinearGradient(0, L.y - hh / 2, 0, L.y + hh / 2);
          lgr.addColorStop(0, '#ff7a2a');
          lgr.addColorStop(0.6, '#ffb347');
          lgr.addColorStop(1, '#fff1a8');
          g.fillStyle = lgr;
          g.beginPath();
          g.moveTo(x - tw / 2, L.y - hh / 2);
          g.quadraticCurveTo(x, L.y - hh * 0.62, x + tw / 2, L.y - hh / 2);
          g.lineTo(x + bw / 2, L.y + hh / 2);
          g.lineTo(x - bw / 2, L.y + hh / 2);
          g.closePath();
          g.fill();
          g.fillStyle = 'rgba(120,40,0,.35)';
          g.fillRect(x - 0.5, L.y - hh / 2, 1, hh);
          g.fillStyle = `rgba(255,255,220,${0.7 + 0.3 * fl})`;
          g.beginPath();
          g.ellipse(x, L.y + hh * 0.42, bw * 0.22, hh * 0.08, 0, 0, TAU);
          g.fill();
        }
      }
      g.strokeStyle = 'rgba(255,190,120,.18)';
      g.lineWidth = 1;
      for (let j = 0; j < (E.small ? 6 : 18); j++) {
        const yy = wy + 6 + ((j * 37 + t * 8) % (h - wy));
        const xx = (j * 131 + Math.sin(t + j) * 30) % w;
        g.beginPath();
        g.moveTo(xx, yy);
        g.lineTo(xx + 30 * k, yy);
        g.stroke();
      }
    },
  },

  /* 6. Golden Luxe */
  gold: {
    id: 'gold',
    name: 'Golden Luxe',
    ico: '✨',
    reveal: 0.7,
    theme: 'gold',
    init(E) {
      const s = {
        cf: [] as Confetto[],
        b: [] as Array<{
          x: number;
          y: number;
          s: number;
          c: string;
          ph: number;
          v: number;
        }>,
        sp: [] as Array<{ x: number; y: number; p: number; s: number }>,
        bursted: false,
      };
      for (let i = 0; i < (E.small ? 30 : 90); i++) {
        confetti(s.cf, R(0, E.w), R(-E.h, E.h), 1, {
          dir: Math.PI / 2,
          spread: 0.4,
          v0: 20,
          v1: 80,
          cols: GOLDS,
        });
      }
      const cols = ['#e8b422', '#e8a08c', '#f3e3a6', '#d6d6d6', '#141414'];
      for (let j = 0; j < (E.small ? 4 : 9); j++) {
        s.b.push({
          x: R(0.05, 0.95) * E.w,
          y: E.h + R(0, E.h * 0.9),
          s: R(26, 46) * E.k * (E.small ? 0.7 : 1),
          c: cols[j % cols.length],
          ph: R(0, TAU),
          v: R(40, 70),
        });
      }
      for (let q = 0; q < (E.small ? 8 : 26); q++) {
        s.sp.push({ x: R(0, E.w), y: R(0, E.h), p: R(0, TAU), s: R(4, 11) * E.k });
      }
      return s;
    },
    draw(E, s) {
      const g = E.g;
      const w = E.w;
      const h = E.h;
      const t = E.t;
      const dt = E.dt;
      const k = E.k;
      const gr = g.createRadialGradient(
        w / 2,
        h * 0.25,
        0,
        w / 2,
        h * 0.25,
        Math.max(w, h) * 0.9
      );
      gr.addColorStop(0, '#3d2c0b');
      gr.addColorStop(0.5, '#140e05');
      gr.addColorStop(1, '#050403');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      g.save();
      g.translate(w / 2, -h * 0.05);
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + t * 0.08;
        const rg = g.createRadialGradient(0, 0, 0, 0, 0, h * 1.3);
        rg.addColorStop(0, 'rgba(255,210,120,.13)');
        rg.addColorStop(1, 'rgba(255,210,120,0)');
        g.fillStyle = rg;
        g.beginPath();
        g.moveTo(0, 0);
        g.arc(0, 0, h * 1.3, a, a + 0.12);
        g.closePath();
        g.fill();
      }
      g.restore();
      g.globalCompositeOperation = 'source-over';
      if (!s.bursted && t > this.reveal) {
        s.bursted = true;
        confetti(s.cf, w / 2, h * 0.32, E.small ? 50 : 160, {
          dir: -Math.PI / 2,
          spread: Math.PI,
          v0: 200 * k,
          v1: 700 * k,
          cols: GOLDS,
        });
        E.sfx('pop');
      }
      if (Math.random() < dt * (E.small ? 10 : 26)) {
        confetti(s.cf, R(0, w), -10, 1, {
          dir: Math.PI / 2,
          spread: 0.3,
          v0: 30,
          v1: 80,
          cols: GOLDS,
        });
      }
      for (let j = 0; j < s.b.length; j++) {
        const b = s.b[j];
        b.y -= b.v * k * dt;
        if (b.y < -b.s * 4) {
          b.y = h + b.s * 2;
          b.x = R(0.05, 0.95) * w;
        }
        const x = b.x + Math.sin(t * 0.9 + b.ph) * 12;
        const y = b.y;
        const sz = b.s;
        g.strokeStyle = 'rgba(255,240,200,.45)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, y + sz * 1.05);
        g.bezierCurveTo(
          x + Math.sin(t * 2 + b.ph) * 10,
          y + sz * 1.6,
          x - Math.sin(t * 2 + b.ph) * 10,
          y + sz * 2.2,
          x,
          y + sz * 2.9
        );
        g.stroke();
        const bgr = g.createRadialGradient(
          x - sz * 0.3,
          y - sz * 0.4,
          sz * 0.05,
          x,
          y,
          sz * 1.1
        );
        bgr.addColorStop(0, 'rgba(255,255,255,.95)');
        bgr.addColorStop(0.25, b.c);
        bgr.addColorStop(1, b.c === '#141414' ? '#000' : 'rgba(90,60,10,1)');
        g.fillStyle = bgr;
        g.beginPath();
        g.ellipse(x, y, sz * 0.82, sz, 0, 0, TAU);
        g.fill();
        g.fillStyle = b.c;
        g.beginPath();
        g.moveTo(x - sz * 0.1, y + sz * 1.07);
        g.lineTo(x + sz * 0.1, y + sz * 1.07);
        g.lineTo(x, y + sz * 0.95);
        g.fill();
      }
      drawConfetti(g, s.cf, dt, h, k);
      g.globalCompositeOperation = 'lighter';
      s.sp.forEach((p: { x: number; y: number; p: number; s: number }) => {
        const a = Math.max(0, Math.sin(t * 2.2 + p.p));
        const z = p.s * a;
        if (z < 0.5) return;
        g.fillStyle = `rgba(255,240,190,${a})`;
        g.beginPath();
        g.moveTo(p.x, p.y - z * 2);
        g.quadraticCurveTo(p.x, p.y, p.x + z * 2, p.y);
        g.quadraticCurveTo(p.x, p.y, p.x, p.y + z * 2);
        g.quadraticCurveTo(p.x, p.y, p.x - z * 2, p.y);
        g.quadraticCurveTo(p.x, p.y, p.x, p.y - z * 2);
        g.fill();
      });
      g.globalCompositeOperation = 'source-over';
    },
  },

  /* 7. Neon City */
  neon: {
    id: 'neon',
    name: 'Neon City',
    ico: '🌆',
    reveal: 0.6,
    theme: 'neon',
    init(E) {
      const w = E.w;
      const h = E.h;
      const hz = h * 0.62;
      const s = {
        hz,
        stars: makeStars(E.small ? 30 : 100, w, hz * 0.8),
        sun: null as HTMLCanvasElement | null,
        r: 0,
        mt: [] as Array<Array<[number, number]>>,
        dust: [] as Array<{ x: number; y: number; v: number; c: number }>,
      };
      const r = Math.min(w, h) * 0.24;
      const c = mk(r * 2 + 4, r * 2 + 4);
      const g = c.getContext('2d')!;
      const gr = g.createLinearGradient(0, 0, 0, r * 2);
      gr.addColorStop(0, '#ffe45e');
      gr.addColorStop(0.5, '#ff4f8b');
      gr.addColorStop(1, '#a21cff');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(r + 2, r + 2, r, 0, TAU);
      g.fill();
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 7; i++) {
        const yy = r + 2 + r * (0.15 + i * 0.13);
        const th = 1.5 + i * 1.6;
        g.fillRect(0, yy, r * 2 + 4, th * (r / 120));
      }
      s.sun = c;
      s.r = r;
      for (let m = 0; m < 2; m++) {
        const pts: Array<[number, number]> = [];
        let x = -20;
        while (x < w + 40) {
          pts.push([x, hz - R(0.02, m ? 0.1 : 0.18) * h]);
          x += R(30, 90) * E.k;
        }
        s.mt.push(pts);
      }
      for (let d = 0; d < (E.small ? 10 : 34); d++) {
        s.dust.push({ x: R(0, w), y: R(0, h), v: R(8, 30), c: pick([320, 190, 280]) });
      }
      return s;
    },
    draw(E, s) {
      const g = E.g;
      const w = E.w;
      const h = E.h;
      const t = E.t;
      const hz = s.hz;
      const k = E.k;
      const gr = g.createLinearGradient(0, 0, 0, hz);
      gr.addColorStop(0, '#07011a');
      gr.addColorStop(1, '#3a0f5c');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, hz);
      drawStars(g, s.stars, t);
      g.globalCompositeOperation = 'lighter';
      const gs = s.r * 2.6;
      g.globalAlpha = 0.55;
      g.drawImage(glowH(330, 55), w / 2 - gs, hz - s.r * 0.45 - gs, gs * 2, gs * 2);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      if (s.sun) {
        g.drawImage(s.sun, w / 2 - s.r - 2, hz - s.r * 1.45 - 2);
      }
      s.mt.forEach((pts: Array<[number, number]>, m: number) => {
        g.fillStyle = m ? '#12042a' : '#1d0638';
        g.beginPath();
        g.moveTo(-20, hz);
        pts.forEach((p) => g.lineTo(p[0], p[1]));
        g.lineTo(w + 40, hz);
        g.closePath();
        g.fill();
        g.save();
        g.strokeStyle = m ? '#ff2bd6' : '#2be8ff';
        g.lineWidth = 1.6;
        g.shadowColor = g.strokeStyle;
        g.shadowBlur = 10;
        g.beginPath();
        pts.forEach((p, i) => {
          if (i) g.lineTo(p[0], p[1]);
          else g.moveTo(p[0], p[1]);
        });
        g.stroke();
        g.restore();
      });
      const fg = g.createLinearGradient(0, hz, 0, h);
      fg.addColorStop(0, '#1a0430');
      fg.addColorStop(1, '#090014');
      g.fillStyle = fg;
      g.fillRect(0, hz, w, h - hz);
      g.save();
      g.beginPath();
      g.rect(0, hz, w, h - hz);
      g.clip();
      g.strokeStyle = '#ff2bd6';
      g.shadowColor = '#ff2bd6';
      g.shadowBlur = 8;
      g.lineWidth = 1.4;
      const off = (t * 0.35) % 1;
      for (let i = 0; i < 14; i++) {
        const z = (i + off) / 14;
        const y = hz + (h - hz) * z * z;
        g.globalAlpha = clamp(z * 1.6, 0, 1);
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
      }
      g.globalAlpha = 1;
      for (let j = -12; j <= 12; j++) {
        g.beginPath();
        g.moveTo(w / 2 + j * w * 0.02, hz);
        g.lineTo(w / 2 + j * w * 0.22, h);
        g.stroke();
      }
      g.restore();
      const hg = g.createLinearGradient(0, hz - 4, 0, hz + (h - hz) * 0.35);
      hg.addColorStop(0, 'rgba(255,60,200,.5)');
      hg.addColorStop(1, 'rgba(255,60,200,0)');
      g.fillStyle = hg;
      g.fillRect(0, hz - 4, w, (h - hz) * 0.35);
      g.globalCompositeOperation = 'lighter';
      s.dust.forEach((d: { x: number; y: number; v: number; c: number }) => {
        d.y -= d.v * k * E.dt;
        if (d.y < 0) d.y = h;
        g.globalAlpha = 0.6;
        g.drawImage(glowH(d.c, 60), d.x - 5, d.y - 5, 10, 10);
      });
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      if (
        !E.reducedMotion &&
        t > this.reveal &&
        t < this.reveal + 0.45 &&
        Math.random() < 0.5
      ) {
        g.fillStyle = 'rgba(255,80,220,.06)';
        g.fillRect(0, 0, w, h);
      }
    },
  },

  /* 8. Magic Gift */
  gift: {
    id: 'gift',
    name: 'Magic Gift',
    ico: '🎁',
    reveal: 2.0,
    theme: 'gold',
    textTop: true,
    init(E) {
      const b = Math.min(E.w * 0.36, E.h * 0.2);
      const s = {
        b,
        cx: E.w / 2,
        cy: E.h * (E.small ? 0.8 : 0.7),
        lid: { y: 0, vy: 0, r: 0, vr: 0 },
        open: false,
        cf: [] as Confetto[],
        p: [] as Spark[],
        bok: [] as Array<{ x: number; y: number; r: number; p: number; c: string }>,
      };
      for (let i = 0; i < (E.small ? 10 : 28); i++) {
        s.bok.push({
          x: R(0, E.w),
          y: R(0, E.h),
          r: R(8, 40) * E.k,
          p: R(0, TAU),
          c: pick(['rgba(255,210,120,.5)', 'rgba(255,120,150,.4)']),
        });
      }
      return s;
    },
    draw(E, s) {
      const g = E.g;
      const w = E.w;
      const h = E.h;
      const t = E.t;
      const dt = E.dt;
      const k = E.k;
      const b = s.b;
      const gr = g.createRadialGradient(
        w / 2,
        h * 0.6,
        0,
        w / 2,
        h * 0.6,
        Math.max(w, h) * 0.8
      );
      gr.addColorStop(0, '#8a1236');
      gr.addColorStop(0.6, '#3a0618');
      gr.addColorStop(1, '#14000a');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';
      s.bok.forEach((o: { x: number; y: number; r: number; p: number; c: string }) => {
        g.globalAlpha = 0.3 + 0.3 * Math.sin(t + o.p);
        g.drawImage(softDot(o.c), o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
      });
      g.globalAlpha = 1;
      const oy = s.cy - b * 0.4;
      if (s.open) {
        const ra = eo((t - 1.8) / 0.5);
        g.save();
        g.translate(s.cx, oy);
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * TAU + t * 0.25;
          const rg = g.createRadialGradient(0, 0, 0, 0, 0, h);
          rg.addColorStop(0, `rgba(255,230,160,${0.32 * ra})`);
          rg.addColorStop(1, 'rgba(255,230,160,0)');
          g.fillStyle = rg;
          g.beginPath();
          g.moveTo(0, 0);
          g.arc(0, 0, h, a, a + 0.09);
          g.closePath();
          g.fill();
        }
        g.restore();
      }
      g.globalCompositeOperation = 'source-over';
      let sh = 0;
      if (t < 1.8) {
        const u = t / 1.8;
        sh = Math.sin(t * 38) * 0.06 * eo(u);
      } else if (!s.open) {
        s.open = true;
        s.lid.vy = -900 * k;
        s.lid.vr = R(-5, 5);
        E.sfx('pop');
        confetti(s.cf, s.cx, oy, E.small ? 60 : 180, {
          dir: -Math.PI / 2,
          spread: 0.8,
          v0: 400 * k,
          v1: 1100 * k,
          xs: b * 0.3,
        });
        burst(s.p, s.cx, oy, {
          n: E.small ? 40 : 110,
          spd: 320 * k,
          hue: 45,
          l: 65,
          g: 60,
          hv: 20,
        });
      }
      if (s.open) {
        s.lid.vy += 1400 * k * dt;
        s.lid.y += s.lid.vy * dt;
        s.lid.r += s.lid.vr * dt;
        if (Math.random() < dt * 12) {
          burst(s.p, s.cx + R(-b * 0.3, b * 0.3), oy, {
            n: 3,
            spd: 160 * k,
            hue: 45,
            l: 65,
            g: -40,
            hv: 20,
          });
        }
      }
      // draw box
      const x = s.cx;
      const y = s.cy;
      const d = b * 0.16;
      g.save();
      g.translate(x, y + b * 0.4);
      g.rotate(sh);
      g.translate(-x, -(y + b * 0.4));
      if (s.open) {
        g.globalCompositeOperation = 'lighter';
        const gs = b * 1.6;
        g.drawImage(glowH(45, 70), x - gs, y - b * 0.4 - gs * 0.7, gs * 2, gs * 1.4);
        g.globalCompositeOperation = 'source-over';
      }
      g.fillStyle = '#7d0a1c';
      g.beginPath();
      g.moveTo(x + b / 2, y - b * 0.4);
      g.lineTo(x + b / 2 + d, y - b * 0.4 - d * 0.6);
      g.lineTo(x + b / 2 + d, y + b * 0.4 - d * 0.6);
      g.lineTo(x + b / 2, y + b * 0.4);
      g.fill();
      const bgr = g.createLinearGradient(x - b / 2, 0, x + b / 2, 0);
      bgr.addColorStop(0, '#ff3b55');
      bgr.addColorStop(1, '#b3122a');
      g.fillStyle = bgr;
      g.fillRect(x - b / 2, y - b * 0.4, b, b * 0.8);
      const rb = g.createLinearGradient(x - b * 0.08, 0, x + b * 0.08, 0);
      rb.addColorStop(0, '#e0a020');
      rb.addColorStop(0.5, '#fff0a8');
      rb.addColorStop(1, '#c98a14');
      g.fillStyle = rb;
      g.fillRect(x - b * 0.08, y - b * 0.4, b * 0.16, b * 0.8);
      if (!s.open || s.lid.y > -4000) {
        const lw = b * 1.1;
        const lh = b * 0.2;
        const ly = y - b * 0.4 + s.lid.y;
        g.save();
        g.translate(x, ly);
        g.rotate(s.lid.r);
        const lgr = g.createLinearGradient(-lw / 2, 0, lw / 2, 0);
        lgr.addColorStop(0, '#ff5068');
        lgr.addColorStop(1, '#c0182f');
        g.fillStyle = lgr;
        g.fillRect(-lw / 2, -lh, lw, lh);
        g.fillStyle = '#f2c14a';
        g.fillRect(-b * 0.08, -lh, b * 0.16, lh);
        g.fillStyle = '#ffd76a';
        g.strokeStyle = '#b8780f';
        g.lineWidth = 2;
        g.beginPath();
        g.ellipse(-b * 0.17, -lh - b * 0.1, b * 0.2, b * 0.11, -0.5, 0, TAU);
        g.fill();
        g.stroke();
        g.beginPath();
        g.ellipse(b * 0.17, -lh - b * 0.1, b * 0.2, b * 0.11, 0.5, 0, TAU);
        g.fill();
        g.stroke();
        g.fillStyle = '#f5b52e';
        g.beginPath();
        g.arc(0, -lh - b * 0.06, b * 0.07, 0, TAU);
        g.fill();
        g.restore();
      }
      g.restore();
      drawSparks(g, s.p, dt, k);
      drawConfetti(g, s.cf, dt, h, k);
    },
  },

  /* 9. Aurora Snow */
  aurora: {
    id: 'aurora',
    name: 'Aurora Snow',
    ico: '❄️',
    reveal: 0.8,
    theme: 'ice',
    init(E) {
      const w = E.w;
      const h = E.h;
      const s = {
        stars: makeStars(E.small ? 40 : 160, w, h * 0.7),
        sn: [] as Array<{ x: number; y: number; z: number; p: number }>,
        sh: [] as ShootStar[],
        mt: mk(w, h * 0.42),
        strips: [] as HTMLCanvasElement[],
      };
      const stripCols: Array<[number, string]> = [
        [145, 'rgba(60,255,170,'],
        [175, 'rgba(60,220,255,'],
        [285, 'rgba(190,90,255,'],
      ];
      stripCols.forEach((c) => {
        const st = mk(4, 256);
        const g = st.getContext('2d')!;
        const gr = g.createLinearGradient(0, 0, 0, 256);
        gr.addColorStop(0, c[1] + '0)');
        gr.addColorStop(0.55, c[1] + '.5)');
        gr.addColorStop(0.85, c[1] + '.85)');
        gr.addColorStop(1, c[1] + '0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 4, 256);
        s.strips.push(st);
      });
      const mg = s.mt.getContext('2d')!;
      const H = s.mt.height;
      const layers: Array<[string, number, number]> = [
        ['#0d2238', 0.25, 0.004],
        ['#0a1a2c', 0.5, 0.007],
        ['#e8f3ff', 0.78, 0.003],
      ];
      layers.forEach((L, li) => {
        mg.fillStyle = L[0];
        mg.beginPath();
        mg.moveTo(0, H);
        for (let x = 0; x <= w; x += 8) {
          mg.lineTo(
            x,
            H *
              (L[1] +
                0.12 * Math.sin(x * L[2] + li * 3) +
                (li < 2 ? 0.1 * Math.abs(Math.sin(x * 0.013 + li)) : 0))
          );
        }
        mg.lineTo(w, H);
        mg.fill();
        if (li === 1) {
          for (let i = 0; i < (E.small ? 12 : 40); i++) {
            const tx = R(0, w);
            const ty = H * R(0.62, 0.8);
            const th = R(14, 34) * E.k;
            mg.fillStyle = '#06121f';
            mg.beginPath();
            mg.moveTo(tx, ty - th);
            mg.lineTo(tx + th * 0.3, ty);
            mg.lineTo(tx - th * 0.3, ty);
            mg.fill();
          }
        }
      });
      const sg = mg.createLinearGradient(0, H * 0.78, 0, H);
      sg.addColorStop(0, 'rgba(200,225,255,0)');
      sg.addColorStop(1, 'rgba(120,160,220,.5)');
      mg.fillStyle = sg;
      mg.fillRect(0, H * 0.7, w, H * 0.3);
      for (let f = 0; f < (E.small ? 50 : 200); f++) {
        s.sn.push({ x: R(0, w), y: R(0, h), z: Math.random(), p: R(0, TAU) });
      }
      return s;
    },
    draw(E, s) {
      const g = E.g;
      const w = E.w;
      const h = E.h;
      const t = E.t;
      const dt = E.dt;
      const k = E.k;
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#020a1a');
      gr.addColorStop(0.6, '#06223a');
      gr.addColorStop(1, '#0b2f4a');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      drawStars(g, s.stars, t);
      if (Math.random() < dt * 0.35) shootStar(s.sh, w, h * 0.5);
      drawShoot(g, s.sh, dt);
      g.globalCompositeOperation = 'lighter';
      const step = E.small ? 5 : 4;
      for (let r = 0; r < 3; r++) {
        const st = s.strips[r];
        const base = h * (0.2 + r * 0.08);
        const amp = h * 0.07;
        const L = h * (0.26 - r * 0.04);
        for (let x = 0; x < w; x += step) {
          const y =
            base +
            Math.sin(x * 0.006 + t * (0.4 + r * 0.15) + r * 2) * amp +
            Math.sin(x * 0.017 - t * 0.7 + r) * amp * 0.35;
          const len = L * (0.55 + 0.45 * Math.sin(x * 0.011 + t * 0.9 + r * 4));
          const a = 0.35 + 0.3 * Math.sin(x * 0.02 + t * 1.3 + r);
          g.globalAlpha = clamp(a, 0, 1);
          g.drawImage(st, x, y - len * 0.6, step + 1, len);
        }
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.drawImage(s.mt, 0, h - s.mt.height);
      g.fillStyle = '#fff';
      s.sn.forEach((f: { x: number; y: number; z: number; p: number }) => {
        f.y += (20 + 60 * f.z) * k * dt;
        f.p += dt;
        f.x += Math.sin(f.p + f.z * 5) * 12 * dt;
        if (f.y > h) {
          f.y = -5;
          f.x = R(0, w);
        }
        g.globalAlpha = 0.35 + 0.6 * f.z;
        g.beginPath();
        g.arc(f.x, f.y, 0.6 + 2 * f.z * k, 0, TAU);
        g.fill();
      });
      g.globalAlpha = 1;
    },
  },
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EngineOptions {
  id?: AnimId;
  small?: boolean;
  year?: number;
  sfx?: (k: SfxType) => void;
  onReveal?: () => void;
  yearRect?: () => Rect | null;
  nameRect?: () => Rect | null;
  nameText?: () => string;
}

export class Engine {
  public c: HTMLCanvasElement;
  public g: CanvasRenderingContext2D;
  public small: boolean;
  public id: AnimId;
  public year: number;
  public sfx: (k: SfxType) => void;
  public onReveal: (() => void) | null;
  private yr: (() => Rect | null) | null;
  private nr: (() => Rect | null) | null;
  public nameText: () => string;
  public t: number = 0;
  public dt: number = 0;
  public run: boolean = false;
  public ptr: { x: number; y: number } | null = null;
  public w: number = 300;
  public h: number = 300;
  public k: number = 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public st: any = null;
  public revealed: boolean = false;
  public reducedMotion: boolean = false;
  private rafId: number = 0;

  constructor(cv: HTMLCanvasElement, o?: EngineOptions) {
    const opts = o || {};
    this.c = cv;
    this.g = cv.getContext('2d')!;
    this.small = !!opts.small;
    this.id = opts.id || 'fireworks';
    this.year = opts.year || 2027;
    this.sfx = opts.sfx || (() => {});
    this.onReveal = opts.onReveal || null;
    this.yr = opts.yearRect || null;
    this.nr = opts.nameRect || null;
    this.nameText = opts.nameText || (() => 'Your Name');
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    this.size();
  }

  public yearRect(): Rect {
    const r = this.yr && this.yr();
    if (r && r.w > 10) return r;
    return {
      x: this.w * 0.08,
      y: this.h * 0.38,
      w: this.w * 0.84,
      h: Math.min(this.h * 0.2, this.w * 0.26),
    };
  }

  public nameRect(): Rect {
    const r = this.nr && this.nr();
    if (r && r.w > 10) return r;
    return {
      x: this.w * 0.06,
      y: this.h * 0.2,
      w: this.w * 0.88,
      h: Math.min(this.h * 0.14, this.w * 0.2),
    };
  }

  public size() {
    const r = this.c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, this.small ? 1 : 2);
    this.w = Math.max(10, r.width || 300);
    this.h = Math.max(10, r.height || 300);
    this.k = clamp(Math.min(this.w, this.h * 0.75) / 600, 0.35, 1.4);
    this.c.width = Math.round(this.w * dpr);
    this.c.height = Math.round(this.h * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.st = ANIM[this.id].init(this);
    this.revealed = false;
  }

  public resize() {
    const t = this.t;
    this.size();
    this.t = t;
    this.revealed = t > ANIM[this.id].reveal;
  }

  public set(id: AnimId) {
    this.id = id;
    this.t = 0;
    this.st = ANIM[id].init(this);
    this.revealed = false;
  }

  public relayout() {
    const A = ANIM[this.id];
    if (A.relayout) A.relayout(this, this.st);
  }

  public frame(dt: number) {
    this.dt = dt;
    this.t += dt;
    const A = ANIM[this.id];
    A.draw(this, this.st);
    const revTime = this.reducedMotion ? Math.min(0.4, A.reveal) : A.reveal;
    if (!this.revealed && this.t >= revTime) {
      this.revealed = true;
      if (this.onReveal) this.onReveal();
    }
  }

  public start() {
    if (this.run) return;
    this.run = true;
    let last = performance.now();
    const gap = this.small ? 1000 / 24 : 0;
    const f = (now: number) => {
      if (!this.run) return;
      this.rafId = requestAnimationFrame(f);
      // Pause animation work when tab is inactive
      if (document.hidden) {
        last = now;
        return;
      }
      if (now - last < gap) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      this.frame(dt);
    };
    this.rafId = requestAnimationFrame(f);
  }

  public stop() {
    this.run = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }
}
