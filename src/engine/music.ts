import {
  MusicCatalogEntry,
  MusicCategory,
  MusicMood,
} from '../types/wish';

export const MUSIC_CATEGORIES: Array<{
  id: MusicCategory;
  label: string;
  icon: string;
}> = [
  { id: 'Celebration', label: 'Celebration', icon: '🎆' },
  { id: 'Bollywood Festive', label: 'Bollywood Festive', icon: '💃' },
  { id: 'Romantic', label: 'Romantic', icon: '❤️' },
  { id: 'Royal Instrumental', label: 'Royal Instrumental', icon: '👑' },
  { id: 'EDM Party', label: 'EDM Party', icon: '🎧' },
  { id: 'Peaceful & Spiritual', label: 'Peaceful & Spiritual', icon: '🪔' },
];

export const DEFAULT_MUSIC_CATALOG: MusicCatalogEntry[] = [
  {
    songId: 'ny27-royal-fanfare',
    songName: 'Royal 2027 Midnight Fanfare',
    googleDriveLink:
      'https://drive.google.com/file/d/1RoyalFanfare2027CelebrationAudio/view?usp=sharing',
    category: 'Celebration',
    mood: 'royal',
    active: true,
    duration: '02:45',
    previewInfo: 'Grand orchestral brass & golden chimes for midnight countdowns',
    tempoBpm: 116,
    synthPreset: 0,
  },
  {
    songId: 'ny27-mumbai-dhol',
    songName: 'Desi Celebration Beats 2027',
    googleDriveLink:
      'https://drive.google.com/file/d/1DesiCelebrationBeats2027Festive/view?usp=sharing',
    category: 'Bollywood Festive',
    mood: 'energetic',
    active: true,
    duration: '03:10',
    previewInfo: 'Upbeat Indian festive rhythm with shimmering sitar & chimes',
    tempoBpm: 128,
    synthPreset: 1,
  },
  {
    songId: 'ny27-velvet-moonlight',
    songName: 'Starlight Romance Symphony',
    googleDriveLink:
      'https://drive.google.com/file/d/1StarlightRomanceSymphony2027/view?usp=sharing',
    category: 'Romantic',
    mood: 'romantic',
    active: true,
    duration: '02:55',
    previewInfo: 'Warm piano & dreamy strings for heartfelt New Year wishes',
    tempoBpm: 88,
    synthPreset: 2,
  },
  {
    songId: 'ny27-imperial-sitar',
    songName: 'Golden Palace Santoor & Flute',
    googleDriveLink:
      'https://drive.google.com/file/d/1GoldenPalaceSantoorFlute2027/view?usp=sharing',
    category: 'Royal Instrumental',
    mood: 'magical',
    active: true,
    duration: '03:20',
    previewInfo: 'Regal Indian classical fusion with celestial harp harmonics',
    tempoBpm: 102,
    synthPreset: 3,
  },
  {
    songId: 'ny27-cyber-countdown',
    songName: 'Neon Horizon 2027 Anthem',
    googleDriveLink:
      'https://drive.google.com/file/d/1NeonHorizon2027AnthemClubMix/view?usp=sharing',
    category: 'EDM Party',
    mood: 'upbeat',
    active: true,
    duration: '02:38',
    previewInfo: 'High-energy progressive synth wave synchronized with fireworks',
    tempoBpm: 132,
    synthPreset: 4,
  },
  {
    songId: 'ny27-dawn-blessings',
    songName: 'Sacred Morning Blessings',
    googleDriveLink:
      'https://drive.google.com/file/d/1SacredMorningBlessings2027Peace/view?usp=sharing',
    category: 'Peaceful & Spiritual',
    mood: 'serene',
    active: true,
    duration: '03:40',
    previewInfo: 'Peaceful temple bells, Bansuri flute & soothing ambient pads',
    tempoBpm: 76,
    synthPreset: 5,
  },
  {
    songId: 'ny27-sparkle-waltz',
    songName: 'Champagne & Sparklers Waltz',
    googleDriveLink:
      'https://drive.google.com/file/d/1ChampagneSparklersWaltz2027/view?usp=sharing',
    category: 'Celebration',
    mood: 'magical',
    active: true,
    duration: '02:50',
    previewInfo: 'Magical music-box celesta & festive celebration bells',
    tempoBpm: 110,
    synthPreset: 6,
  },
  {
    songId: 'ny27-bollywood-nights',
    songName: 'Jashn-e-Naya Saal 2027',
    googleDriveLink:
      'https://drive.google.com/file/d/1JashnENayaSaal2027Bollywood/view?usp=sharing',
    category: 'Bollywood Festive',
    mood: 'upbeat',
    active: true,
    duration: '03:05',
    previewInfo: 'Joyful family celebration melody with rich festive harmony',
    tempoBpm: 124,
    synthPreset: 7,
  },
];

export interface DriveValidationResult {
  valid: boolean;
  fileId: string | null;
  streamable: boolean;
  streamUrl: string | null;
  reason?: string;
}

/**
 * Extracts a Google Drive File ID from common sharing URL formats:
 * - https://drive.google.com/file/d/<FILE_ID>/view
 * - https://drive.google.com/open?id=<FILE_ID>
 * - https://drive.google.com/uc?id=<FILE_ID>&export=download
 */
export function extractGoogleDriveFileId(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  try {
    const u = new URL(trimmed);
    if (
      !u.hostname.endsWith('drive.google.com') &&
      !u.hostname.endsWith('docs.google.com')
    ) {
      return null;
    }
    const pathMatch = u.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
    if (pathMatch && pathMatch[1]) {
      return pathMatch[1];
    }
    const idParam = u.searchParams.get('id');
    if (idParam && /^[a-zA-Z0-9_-]{10,}$/.test(idParam)) {
      return idParam;
    }
    return null;
  } catch {
    return null;
  }
}

export interface AudioSyncSnapshot {
  energy: number; // 0..1 overall intensity
  bass: number; // 0..1 low-frequency punch
  pulse: number; // 0..1 rhythmic beat pulse
  mood: MusicMood;
}

interface SynthArrangement {
  tempoBpm: number;
  wave: OscillatorType;
  melody: Array<[string | null, number]>;
  bass: string[];
  padChords: string[][];
}

const ARRANGEMENTS: SynthArrangement[] = [
  // 0: Royal 2027 Midnight Fanfare
  {
    tempoBpm: 116,
    wave: 'triangle',
    melody: [
      ['D4', 1], ['G4', 1.5], ['G4', 0.5], ['G4', 1], ['B4', 1],
      ['A4', 1.5], ['G4', 0.5], ['A4', 1], ['B4', 0.5], ['A4', 0.5],
      ['G4', 1.5], ['B4', 0.5], ['D5', 1], ['E5', 2], ['D5', 1],
      ['B4', 1], ['A4', 1], ['G4', 2], [null, 1],
    ],
    bass: ['G2', 'D3', 'E2', 'C3', 'G2', 'D3', 'C3', 'G2'],
    padChords: [['G3', 'B3', 'D4'], ['C3', 'E3', 'G3'], ['D3', 'F3', 'A3'], ['G3', 'B3', 'D4']],
  },
  // 1: Desi Celebration Beats 2027
  {
    tempoBpm: 128,
    wave: 'sine',
    melody: [
      ['E4', 0.5], ['G4', 0.5], ['A4', 1], ['B4', 0.5], ['D5', 0.5], ['B4', 1],
      ['A4', 0.5], ['G4', 0.5], ['E4', 1], ['G4', 1], ['A4', 0.5], ['B4', 0.5],
      ['D5', 1], ['E5', 1], ['D5', 0.5], ['B4', 0.5], ['A4', 1], ['G4', 2],
    ],
    bass: ['E2', 'B2', 'D2', 'A2', 'E2', 'B2', 'A2', 'E2'],
    padChords: [['E3', 'G3', 'B3'], ['D3', 'F3', 'A3']],
  },
  // 2: Starlight Romance Symphony
  {
    tempoBpm: 88,
    wave: 'sine',
    melody: [
      ['C4', 1.5], ['E4', 0.5], ['G4', 2], ['A4', 1.5], ['G4', 0.5], ['E4', 2],
      ['F4', 1.5], ['A4', 0.5], ['C5', 2], ['B4', 1.5], ['G4', 0.5], ['E4', 2],
    ],
    bass: ['C2', 'A2', 'F2', 'G2'],
    padChords: [['C3', 'E3', 'G3'], ['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4']],
  },
  // 3: Golden Palace Santoor & Flute
  {
    tempoBpm: 102,
    wave: 'triangle',
    melody: [
      ['D4', 0.5], ['F4', 0.5], ['A4', 1], ['D5', 1], ['C5', 0.5], ['A4', 0.5], ['G4', 1],
      ['F4', 0.5], ['G4', 0.5], ['A4', 1], ['F4', 1], ['E4', 1], ['D4', 2],
    ],
    bass: ['D2', 'A2', 'G2', 'D2'],
    padChords: [['D3', 'F3', 'A3'], ['G3', 'B3', 'D4']],
  },
  // 4: Neon Horizon 2027 Anthem
  {
    tempoBpm: 132,
    wave: 'sawtooth',
    melody: [
      ['A4', 0.5], ['A4', 0.5], ['C5', 0.5], ['E5', 0.5], ['D5', 0.5], ['C5', 0.5], ['B4', 1],
      ['G4', 0.5], ['G4', 0.5], ['B4', 0.5], ['D5', 0.5], ['C5', 0.5], ['B4', 0.5], ['A4', 1],
    ],
    bass: ['A2', 'F2', 'C3', 'G2', 'A2', 'F2', 'C3', 'G2'],
    padChords: [['A3', 'C4', 'E4'], ['F3', 'A3', 'C4']],
  },
  // 5: Sacred Morning Blessings
  {
    tempoBpm: 76,
    wave: 'sine',
    melody: [
      ['G4', 2], ['A4', 1], ['B4', 1], ['D5', 2], ['B4', 2],
      ['A4', 1.5], ['G4', 0.5], ['E4', 2], ['G4', 3], [null, 1],
    ],
    bass: ['G2', 'D3', 'C3', 'G2'],
    padChords: [['G3', 'B3', 'D4'], ['C3', 'E3', 'G3']],
  },
  // 6: Champagne & Sparklers Waltz
  {
    tempoBpm: 110,
    wave: 'sine',
    melody: [
      ['G4', 1], ['B4', 1], ['D5', 1], ['G5', 2], ['D5', 1],
      ['E5', 1], ['C5', 1], ['A4', 1], ['D5', 2], ['B4', 1],
      ['G4', 1], ['A4', 1], ['B4', 1], ['C5', 1], ['A4', 1], ['G4', 3],
    ],
    bass: ['G2', 'D3', 'C3', 'D3', 'G2', 'D3'],
    padChords: [['G3', 'B3', 'D4'], ['C3', 'E3', 'G3']],
  },
  // 7: Jashn-e-Naya Saal 2027
  {
    tempoBpm: 124,
    wave: 'triangle',
    melody: [
      ['C4', 0.5], ['D4', 0.5], ['E4', 1], ['G4', 1], ['A4', 0.5], ['G4', 0.5], ['E4', 1],
      ['G4', 0.5], ['A4', 0.5], ['C5', 1], ['D5', 1], ['C5', 0.5], ['A4', 0.5], ['G4', 2],
    ],
    bass: ['C2', 'G2', 'F2', 'G2', 'C2', 'G2'],
    padChords: [['C3', 'E3', 'G3'], ['F3', 'A3', 'C4']],
  },
];

class MusicEngineController {
  private catalog: MusicCatalogEntry[] = [...DEFAULT_MUSIC_CATALOG];
  private currentSongId: string = DEFAULT_MUSIC_CATALOG[0].songId;
  private isPlaying: boolean = false;
  private volume: number = 0.5; // Default volume 50% as required
  private ac: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private freqData: Uint8Array<ArrayBuffer> | null = null;
  private musicGain: GainNode | null = null;
  private loopTimer: number = 0;
  private htmlAudio: HTMLAudioElement | null = null;
  private lastRandomSongId: string = '';
  private listeners: Set<() => void> = new Set();

  constructor() {
    // Asynchronously fetch catalog from configurable backend API if available
    if (typeof window !== 'undefined') {
      this.fetchCatalogFromApi().catch(() => {});
    }
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  public async fetchCatalogFromApi(): Promise<MusicCatalogEntry[]> {
    try {
      const res = await fetch('/api/music/catalog');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.songs) && data.songs.length > 0) {
          this.catalog = data.songs;
          this.notify();
        }
      }
    } catch {
      // Fallback to built-in catalog if offline
    }
    return this.catalog;
  }

  public getCatalog(): MusicCatalogEntry[] {
    return this.catalog;
  }

  public getActiveSongs(): MusicCatalogEntry[] {
    const active = this.catalog.filter((s) => s.active);
    return active.length > 0 ? active : this.catalog;
  }

  public getSongById(songId: string): MusicCatalogEntry {
    const found = this.catalog.find((s) => s.songId === songId && s.active);
    if (found) return found;
    const activeList = this.getActiveSongs();
    return activeList[0] || DEFAULT_MUSIC_CATALOG[0];
  }

  /**
   * Automatic Music Selection:
   * Picks a random active song (preferring a different song than the last newly generated wish).
   */
  public pickRandomActiveSongId(excludeSongId?: string): string {
    const active = this.getActiveSongs();
    if (active.length === 0) return DEFAULT_MUSIC_CATALOG[0].songId;
    if (active.length === 1) return active[0].songId;

    const avoid = excludeSongId || this.lastRandomSongId;
    const pool = active.filter((s) => s.songId !== avoid);
    const chosen =
      pool.length > 0
        ? pool[Math.floor(Math.random() * pool.length)]
        : active[Math.floor(Math.random() * active.length)];
    this.lastRandomSongId = chosen.songId;
    return chosen.songId;
  }

  public getCurrentSong(): MusicCatalogEntry {
    return this.getSongById(this.currentSongId);
  }

  public getCurrentSongId(): string {
    return this.currentSongId;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ac) {
      this.masterGain.gain.setTargetAtTime(
        this.volume,
        this.ac.currentTime,
        0.05
      );
    }
    if (this.htmlAudio) {
      this.htmlAudio.volume = this.volume;
    }
    this.notify();
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ac) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ac = new AudioCtx();
      this.masterGain = this.ac.createGain();
      this.masterGain.gain.value = this.volume; // Default 50%

      this.analyser = this.ac.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.78;
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ac.destination);
    }
    if (this.ac.state === 'suspended') {
      this.ac.resume().catch(() => {});
    }
    return this.ac;
  }

  /**
   * Selects a song by ID. If fallback is needed because a song is inactive/missing,
   * automatically resolves to a valid active song.
   */
  public selectSong(songId: string, autoPlayIfAlreadyPlaying = true) {
    const resolved = this.getSongById(songId);
    const changed = this.currentSongId !== resolved.songId;
    this.currentSongId = resolved.songId;
    if (this.isPlaying && (changed || autoPlayIfAlreadyPlaying)) {
      this.startPlayback();
    }
    this.notify();
  }

  public playSong(songId?: string) {
    if (songId) {
      const resolved = this.getSongById(songId);
      this.currentSongId = resolved.songId;
    }
    this.isPlaying = true;
    this.startPlayback();
    this.notify();
  }

  public stop() {
    this.isPlaying = false;
    this.stopInternalPlayback();
    this.notify();
  }

  public toggle(): boolean {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.playSong();
    }
    return this.isPlaying;
  }

  private stopInternalPlayback() {
    window.clearTimeout(this.loopTimer);
    if (this.htmlAudio) {
      try {
        this.htmlAudio.pause();
        this.htmlAudio.src = '';
      } catch {
        // ignore
      }
      this.htmlAudio = null;
    }
    if (this.musicGain && this.ac) {
      const old = this.musicGain;
      try {
        old.gain.setTargetAtTime(0, this.ac.currentTime, 0.1);
        window.setTimeout(() => {
          try {
            old.disconnect();
          } catch {
            // ignore
          }
        }, 350);
      } catch {
        // ignore
      }
      this.musicGain = null;
    }
  }

  private startPlayback() {
    this.stopInternalPlayback();
    const ac = this.ensureAudioContext();
    if (!ac || !this.masterGain) return;

    const song = this.getCurrentSong();
    const presetIdx =
      typeof song.synthPreset === 'number'
        ? song.synthPreset % ARRANGEMENTS.length
        : 0;
    const arr = ARRANGEMENTS[presetIdx] || ARRANGEMENTS[0];

    const mg = ac.createGain();
    mg.gain.value = 0.75;
    mg.connect(this.masterGain);
    this.musicGain = mg;

    const NOTE_MAP: Record<string, number> = {
      C: 0,
      D: 2,
      E: 4,
      F: 5,
      G: 7,
      A: 9,
      B: 11,
    };
    const midi = (s: string) => NOTE_MAP[s[0]] + (Number(s[1]) + 1) * 12;
    const freq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    const beatSec = 60 / (song.tempoBpm || arr.tempoBpm || 112);

    const playNote = (
      f: number,
      t: number,
      dur: number,
      vol: number,
      wave: OscillatorType
    ) => {
      const harmonics: Array<[number, number]> =
        wave === 'sawtooth'
          ? [
              [1, 0.8],
              [2, 0.35],
            ]
          : [
              [1, 1],
              [2, 0.28],
              [3.01, 0.09],
            ];
      harmonics.forEach((h) => {
        const osc = ac.createOscillator();
        osc.type = wave === 'sawtooth' ? 'triangle' : wave;
        osc.frequency.value = f * h[0];
        const g = ac.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol * h[1], t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0007, t + dur + 0.75);
        osc.connect(g);
        g.connect(mg);
        osc.start(t);
        osc.stop(t + dur + 0.85);
      });
    };

    const scheduleLoop = (t0: number) => {
      if (this.musicGain !== mg || !this.isPlaying) return;
      let t = t0;
      arr.melody.forEach((n) => {
        if (n[0]) {
          playNote(freq(midi(n[0])), t, n[1] * beatSec, 0.18, arr.wave);
        }
        t += n[1] * beatSec;
      });
      arr.bass.forEach((b, i) => {
        const bt = t0 + i * 2 * beatSec;
        if (bt < t) {
          playNote(freq(midi(b)), bt, 2 * beatSec, 0.11, 'sine');
        }
      });
      arr.padChords.forEach((chord, ci) => {
        const ct = t0 + ci * 4 * beatSec;
        if (ct < t) {
          chord.forEach((cn) => {
            playNote(freq(midi(cn)), ct, 3.8 * beatSec, 0.045, 'sine');
          });
        }
      });

      this.loopTimer = window.setTimeout(() => {
        scheduleLoop(t);
      }, Math.max(120, (t - ac.currentTime - 0.8) * 1000));
    };

    scheduleLoop(ac.currentTime + 0.08);
  }

  /**
   * Validates a Google Drive audio URL via the backend compatibility endpoint.
   */
  public async validateGoogleDriveLink(
    rawUrl: string
  ): Promise<DriveValidationResult> {
    const fileId = extractGoogleDriveFileId(rawUrl);
    if (!fileId) {
      return {
        valid: false,
        fileId: null,
        streamable: false,
        streamUrl: null,
        reason:
          'Invalid Google Drive URL format. Expected https://drive.google.com/file/d/<FILE_ID>/view',
      };
    }

    try {
      const res = await fetch('/api/music/validate-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: rawUrl, fileId }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // ignore network error and return client validation
    }

    return {
      valid: true,
      fileId,
      streamable: false,
      streamUrl: `/api/music/stream/${encodeURIComponent(fileId)}`,
      reason:
        'Google Drive link syntax is valid. Direct streaming depends on file public permissions.',
    };
  }

  /**
   * Real-time Audio & Mood Synchronization Snapshot for Canvas Animations (Section 11).
   * Returns smooth energy, bass, and rhythmic pulse values (0..1).
   */
  public getSyncSnapshot(timeSec: number): AudioSyncSnapshot {
    const song = this.getCurrentSong();
    const mood = song.mood || 'royal';
    const bpm = song.tempoBpm || 116;
    const beatPhase = ((timeSec * bpm) / 60) * Math.PI * 2;
    const rhythmPulse = 0.5 + 0.5 * Math.sin(beatPhase);

    if (this.isPlaying && this.analyser && this.freqData) {
      try {
        this.analyser.getByteFrequencyData(this.freqData);
        let sum = 0;
        let bassSum = 0;
        const len = this.freqData.length;
        const bassBins = Math.min(8, len);
        for (let i = 0; i < len; i++) {
          sum += this.freqData[i];
          if (i < bassBins) bassSum += this.freqData[i];
        }
        const rawEnergy = sum / (len * 255);
        const rawBass = bassSum / (bassBins * 255);
        if (rawEnergy > 0.01) {
          return {
            energy: Math.min(1, rawEnergy * 2.4 + 0.2),
            bass: Math.min(1, rawBass * 2.2 + 0.15),
            pulse: Math.min(1, rawBass * 1.6 + rhythmPulse * 0.35),
            mood,
          };
        }
      } catch {
        // Fallback to mood preset below
      }
    }

    // Mood-based animation synchronization preset when audio analysis is idle/unavailable
    const moodBase: Record<MusicMood, number> = {
      energetic: 0.85,
      upbeat: 0.8,
      royal: 0.7,
      magical: 0.65,
      romantic: 0.55,
      serene: 0.45,
    };
    const base = moodBase[mood] || 0.65;
    return {
      energy: base + 0.15 * rhythmPulse,
      bass: base * 0.8 + 0.2 * rhythmPulse,
      pulse: rhythmPulse,
      mood,
    };
  }

  /**
   * Creates a MediaStream audio track from the active Web Audio context so
   * Animated Video Export can include the selected music when supported.
   */
  public createExportAudioStream(): MediaStream | null {
    try {
      const ac = this.ensureAudioContext();
      if (!ac || !this.masterGain) return null;
      if (typeof ac.createMediaStreamDestination !== 'function') return null;
      const dest = ac.createMediaStreamDestination();
      this.masterGain.connect(dest);
      return dest.stream;
    } catch {
      return null;
    }
  }
}

export const MUSIC = new MusicEngineController();
