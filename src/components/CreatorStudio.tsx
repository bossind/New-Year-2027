import React, { useEffect, useRef, useState } from 'react';
import { UI, LangCode, formatTemplate } from '../data/i18n';
import {
  MESSAGE_CATEGORIES,
  formatPersonalizedMessage,
  getTemplatesForLanguageAndCategory,
} from '../data/messages';
import {
  BACKGROUND_CATEGORIES,
  BACKGROUND_GALLERY,
  resolveAutomaticBackground,
} from '../data/backgrounds';
import { ANIM, ANIM_IDS, AnimId } from '../engine/animations';
import {
  MUSIC,
  MUSIC_CATEGORIES,
  DriveValidationResult,
} from '../engine/music';
import { SND } from '../engine/sound';
import {
  BackgroundCategory,
  FONT_OPTIONS,
  MusicCatalogEntry,
  MusicCategory,
  PHOTO_FRAME_OPTIONS,
  TEXT_COLOR_OPTIONS,
  WishConfig,
} from '../types/wish';
import { compressAndOptimizeImage } from '../utils/imageProcessor';

const YEAR = 2027;

const STUDIO_LANG_CARDS: Array<{
  code: LangCode;
  native: string;
  english: string;
}> = [
  { code: 'hi', native: 'हिन्दी', english: 'Hindi' },
  { code: 'en', native: 'English', english: 'English' },
  { code: 'bn', native: 'বাংলা', english: 'Bengali' },
  { code: 'mr', native: 'मराठी', english: 'Marathi' },
  { code: 'hinglish', native: 'Hinglish', english: 'Hindi + English' },
  { code: 'ur', native: 'اردو', english: 'Urdu' },
];

type StudioTabId =
  | 'names'
  | 'animations'
  | 'messages'
  | 'photo'
  | 'background'
  | 'music'
  | 'security';

const STUDIO_TABS: Array<{ id: StudioTabId; label: string; icon: string }> = [
  { id: 'names', label: 'Names & Language', icon: '✍️' },
  { id: 'animations', label: '9 Animations', icon: '🎆' },
  { id: 'messages', label: 'Messages', icon: '💌' },
  { id: 'photo', label: 'Photo & Frame', icon: '🖼️' },
  { id: 'background', label: 'Background', icon: '🌌' },
  { id: 'music', label: 'Music & Style', icon: '🎵' },
  { id: 'security', label: 'Password Lock', icon: '🔒' },
];

export interface CreatorStudioProps {
  config: WishConfig;
  rawPassword: string;
  onChangeConfig: (updater: (prev: WishConfig) => WishConfig) => void;
  onChangePassword: (pw: string) => void;
  onLanguageSwitch: (lang: LangCode) => void;
  onBack: () => void;
  onPublish: () => void;
  isPublishing: boolean;
  renderLiveStage: () => React.ReactNode;
  renderMiniAnimCard: (
    animId: AnimId,
    index: number,
    selected: boolean,
    label: string,
    onSelect: (idx: number) => void
  ) => React.ReactNode;
}

export const CreatorStudio: React.FC<CreatorStudioProps> = ({
  config,
  rawPassword,
  onChangeConfig,
  onChangePassword,
  onLanguageSwitch,
  onBack,
  onPublish,
  isPublishing,
  renderLiveStage,
  renderMiniAnimCard,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTabId>('names');
  const [nameError, setNameError] = useState<string>('');
  const [photoUploading, setPhotoUploading] = useState<boolean>(false);
  const [photoProgress, setPhotoProgress] = useState<number>(0);
  const [photoError, setPhotoError] = useState<string>('');

  const [bgCategory, setBgCategory] = useState<BackgroundCategory>('Celebration');
  const [bgUploading, setBgUploading] = useState<boolean>(false);
  const [bgProgress, setBgProgress] = useState<number>(0);
  const [bgError, setBgError] = useState<string>('');

  const [musicCategory, setMusicCategory] = useState<MusicCategory>('Celebration');
  const [catalog, setCatalog] = useState<MusicCatalogEntry[]>(() =>
    MUSIC.getActiveSongs()
  );
  const [soundEnabled, setSoundEnabled] = useState<boolean>(SND.isOn);
  const [volumePct, setVolumePct] = useState<number>(() =>
    Math.round(MUSIC.getVolume() * 100)
  );
  const [driveUrlInput, setDriveUrlInput] = useState<string>('');
  const [driveValidating, setDriveValidating] = useState<boolean>(false);
  const [driveResult, setDriveResult] = useState<DriveValidationResult | null>(
    null
  );

  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const bgUploadInputRef = useRef<HTMLInputElement | null>(null);
  const senderInputRef = useRef<HTMLInputElement | null>(null);

  const T = UI[config.language];

  useEffect(() => {
    const unsubMusic = MUSIC.subscribe(() => {
      setCatalog(MUSIC.getActiveSongs());
      setVolumePct(Math.round(MUSIC.getVolume() * 100));
    });
    const unsubSnd = SND.subscribe((on) => {
      setSoundEnabled(on);
    });
    return () => {
      unsubMusic();
      unsubSnd();
    };
  }, []);

  const currentSong = MUSIC.getSongById(config.musicId);
  const resolvedAutoBg = resolveAutomaticBackground(
    config.animationId,
    currentSong.mood
  );

  const handlePublishClick = () => {
    const cleanedSender = (config.senderName || '').trim();
    if (!cleanedSender) {
      setActiveTab('names');
      setNameError(
        T.err || 'Please enter your name (WISH FROM) to generate your wish!'
      );
      window.setTimeout(() => senderInputRef.current?.focus(), 120);
      return;
    }
    if (config.passwordProtected && rawPassword.trim().length < 3) {
      setActiveTab('security');
      return;
    }
    setNameError('');
    onPublish();
  };

  // Photo Upload Handler (Mobile Gallery or Mobile Camera)
  const handlePhotoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setPhotoError('');
    setPhotoUploading(true);
    setPhotoProgress(10);
    try {
      const res = await compressAndOptimizeImage(file, {
        maxDimension: 960,
        quality: 0.85,
        onProgress: (pct) => setPhotoProgress(pct),
      });
      onChangeConfig((prev) => ({
        ...prev,
        photoDataUrl: res.dataUrl,
        photoCrop: { zoom: 1, offsetX: 0, offsetY: 0 },
      }));
    } catch (err) {
      setPhotoError(
        err instanceof Error
          ? err.message
          : 'Could not process the selected photo.'
      );
    } finally {
      setPhotoUploading(false);
    }
  };

  // Custom Background Upload Handler
  const handleBgFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBgError('');
    setBgUploading(true);
    setBgProgress(10);
    try {
      const res = await compressAndOptimizeImage(file, {
        maxDimension: 1280,
        quality: 0.84,
        onProgress: (pct) => setBgProgress(pct),
      });
      onChangeConfig((prev) => ({
        ...prev,
        backgroundMode: 'custom',
        customBgDataUrl: res.dataUrl,
      }));
    } catch (err) {
      setBgError(
        err instanceof Error
          ? err.message
          : 'Could not upload custom background image.'
      );
    } finally {
      setBgUploading(false);
    }
  };

  const categoryTemplates = getTemplatesForLanguageAndCategory(
    config.language,
    config.messageCategory
  );

  const filteredBackgrounds = BACKGROUND_GALLERY.filter(
    (b) => b.category === bgCategory
  );

  const filteredSongs = catalog.filter((s) => s.category === musicCategory);

  return (
    <div
      className="wx-studio-overlay"
      role="dialog"
      aria-label="New Year 2027 Wish Creator Studio"
    >
      {/* Top Studio Header Bar */}
      <header className="wx-studio-top">
        <button
          type="button"
          className="wx-studio-back"
          onClick={onBack}
          aria-label="Exit Creator Studio"
        >
          <span>← Back</span>
        </button>

        <div className="wx-studio-brand">
          <span className="wx-studio-brand-title">
            ✨ {YEAR} CREATOR STUDIO
          </span>
          <span className="wx-studio-brand-sub">
            Live Personalization & Music Engine
          </span>
        </div>

        <button
          type="button"
          className="wx-studio-top-publish"
          onClick={handlePublishClick}
          disabled={isPublishing}
        >
          <span>{isPublishing ? '⏳ Saving...' : '🚀 Publish Wish'}</span>
        </button>
      </header>

      {/* Main Split / Scrollable Studio Body */}
      <div className="wx-studio-body">
        {/* Left / Top Live Wish Preview Dock */}
        <div className="wx-studio-preview-col">
          <div className="wx-studio-preview-stage">{renderLiveStage()}</div>
          <div className="wx-studio-status-strip">
            <span>
              🎆 Theme:{' '}
              <b>
                {T.animNames[config.animationId] ||
                  ANIM[config.animationId].name}
              </b>
            </span>
            <span>
              🎵 Song: <b>{currentSong.songName}</b>
            </span>
            <span>
              🌐 <b>{UI[config.language].nativeLabel}</b>
            </span>
          </div>
        </div>

        {/* Right / Bottom Controls Column */}
        <div className="wx-studio-controls-col">
          {/* Step Navigation Tabs */}
          <nav
            className="wx-studio-tabs"
            aria-label="Creator Studio Customization Steps"
          >
            {STUDIO_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`wx-studio-tab ${
                  activeTab === tab.id ? 'active' : ''
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Active Customization Panel */}
          <div className="wx-studio-panel">
            {/* TAB 1: NAMES & 6 LANGUAGES */}
            {activeTab === 'names' && (
              <>
                <div className="wx-studio-card">
                  <div className="wx-studio-sec-title">
                    <span>✍️ 1. Name Personalization</span>
                    <span className="wx-field-badge">Unicode & Hindi Ready</span>
                  </div>
                  <p className="wx-studio-sec-desc">
                    Personalize both who the wish is for (WISH TO) and your own
                    name (WISH FROM). The live preview updates immediately.
                  </p>

                  <div className="wx-name-grid">
                    {/* WISH TO (Recipient) */}
                    <div className="wx-field-box">
                      <label
                        className="wx-field-label"
                        htmlFor="wx-studio-recipient"
                      >
                        <span>🎯 WISH TO (Recipient Name)</span>
                        <span className="wx-field-badge">Optional</span>
                      </label>
                      <div className="wx-inp">
                        <input
                          id="wx-studio-recipient"
                          type="text"
                          dir="auto"
                          maxLength={24}
                          placeholder="e.g. Priya, Mom, Rahul, प्रिया..."
                          value={config.recipientName}
                          onChange={(e) => {
                            const val = e.target.value;
                            onChangeConfig((prev) => ({
                              ...prev,
                              recipientName: val,
                            }));
                          }}
                        />
                        <span>🎁</span>
                      </div>
                    </div>

                    {/* WISH FROM (Sender) */}
                    <div className="wx-field-box">
                      <label
                        className="wx-field-label"
                        htmlFor="wx-studio-sender"
                      >
                        <span>👑 WISH FROM (Your Name)</span>
                        <span className="wx-field-badge">Required</span>
                      </label>
                      <div className="wx-inp">
                        <input
                          ref={senderInputRef}
                          id="wx-studio-sender"
                          type="text"
                          dir="auto"
                          maxLength={24}
                          placeholder={T.ph}
                          value={config.senderName}
                          onChange={(e) => {
                            setNameError('');
                            const val = e.target.value;
                            onChangeConfig((prev) => ({
                              ...prev,
                              senderName: val,
                            }));
                          }}
                        />
                        <span>✍️</span>
                      </div>
                    </div>
                  </div>
                  {nameError && <p className="wx-err mt-2">{nameError}</p>}
                </div>

                {/* 6 Visual Language Cards */}
                <div className="wx-studio-card">
                  <div className="wx-studio-sec-title">
                    <span>🌐 2. Choose Wish Language</span>
                    <span className="wx-field-badge">6 Indian Languages</span>
                  </div>
                  <p className="wx-studio-sec-desc">
                    Switching language updates the greeting templates and keeps
                    any custom text you wrote safe.
                  </p>

                  <div className="wx-lang-cards-grid">
                    {STUDIO_LANG_CARDS.map((lc) => {
                      const isSel = config.language === lc.code;
                      return (
                        <button
                          key={lc.code}
                          type="button"
                          className={`wx-lang-card ${isSel ? 'sel' : ''}`}
                          onClick={() => onLanguageSwitch(lc.code)}
                        >
                          <span className="wx-lang-native">{lc.native}</span>
                          <span className="wx-lang-sub">{lc.english}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* TAB 2: 9 LIVE ANIMATIONS */}
            {activeTab === 'animations' && (
              <div className="wx-studio-card">
                <div className="wx-studio-sec-title">
                  <span>🎆 Choose 3D Celebration Animation (9)</span>
                  <span className="wx-field-badge">Live Canvas</span>
                </div>
                <p className="wx-studio-sec-desc">
                  All 9 original 3D animations run live and synchronize with
                  your chosen background and music mood.
                </p>

                <div className="wx-grid">
                  {ANIM_IDS.map((id, idx) =>
                    renderMiniAnimCard(
                      id,
                      idx,
                      config.animationId === id,
                      T.animNames[id] || ANIM[id].name,
                      (selectedIdx) => {
                        const chosenId =
                          ANIM_IDS[selectedIdx] || 'fireworks';
                        onChangeConfig((prev) => ({
                          ...prev,
                          animationId: chosenId,
                        }));
                      }
                    )
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: MESSAGE SYSTEM (6 CATEGORIES + CUSTOM MESSAGE) */}
            {activeTab === 'messages' && (
              <div className="wx-studio-card">
                <div className="wx-studio-sec-title">
                  <span>💌 Greeting Message System</span>
                  <span className="wx-field-badge">
                    {config.isCustomMessage ? 'Custom Mode' : config.messageCategory}
                  </span>
                </div>
                <p className="wx-studio-sec-desc">
                  Browse ready-made wishes across 6 categories or write your own
                  personal message.
                </p>

                {/* Mode Switch: Ready-Made vs Write Your Own */}
                <div className="wx-bg-mode-switch">
                  <button
                    type="button"
                    className={`wx-mode-btn ${
                      !config.isCustomMessage ? 'sel' : ''
                    }`}
                    onClick={() =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        isCustomMessage: false,
                      }))
                    }
                  >
                    ✨ Ready-Made Wishes
                  </button>
                  <button
                    type="button"
                    className={`wx-mode-btn ${
                      config.isCustomMessage ? 'sel' : ''
                    }`}
                    onClick={() =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        isCustomMessage: true,
                      }))
                    }
                  >
                    ✍️ Write Your Own Message
                  </button>
                </div>

                {!config.isCustomMessage ? (
                  <>
                    {/* 6 Category Pills */}
                    <div className="wx-cat-pills">
                      {MESSAGE_CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          className={`wx-cat-pill ${
                            config.messageCategory === cat.id ? 'sel' : ''
                          }`}
                          onClick={() => {
                            const list = getTemplatesForLanguageAndCategory(
                              config.language,
                              cat.id
                            );
                            const firstTpl = list[0];
                            onChangeConfig((prev) => ({
                              ...prev,
                              messageCategory: cat.id,
                              isCustomMessage: false,
                              customMessage: firstTpl
                                ? firstTpl.text
                                : prev.customMessage,
                            }));
                          }}
                        >
                          <span>{cat.icon}</span>
                          <span>{cat.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Categorized Templates List */}
                    <div className="wx-chips">
                      {categoryTemplates.map((tpl) => {
                        const formatted = formatPersonalizedMessage(tpl.text, {
                          year: YEAR,
                          recipientName: config.recipientName,
                          senderName: config.senderName,
                          defaultSender: T.defaultName,
                        });
                        const isSel =
                          !config.isCustomMessage &&
                          config.customMessage === tpl.text;
                        return (
                          <button
                            key={tpl.id}
                            type="button"
                            dir={T.dir || 'ltr'}
                            className={`wx-chip ${isSel ? 'sel' : ''}`}
                            onClick={() =>
                              onChangeConfig((prev) => ({
                                ...prev,
                                isCustomMessage: false,
                                customMessage: tpl.text,
                              }))
                            }
                          >
                            <span>{formatted}</span>
                            <span className="wx-chip-badge">
                              {tpl.category}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div>
                    <textarea
                      className="wx-custom-msg-area"
                      dir="auto"
                      maxLength={320}
                      placeholder={`Write your heartfelt New Year ${YEAR} message here... (Tip: You can use {to} for recipient and {from} for your name)`}
                      value={config.customMessage}
                      onChange={(e) => {
                        const val = e.target.value;
                        onChangeConfig((prev) => ({
                          ...prev,
                          isCustomMessage: true,
                          customMessage: val,
                        }));
                      }}
                    />
                    <div className="flex justify-between items-center text-xs text-amber-200/75 mt-2">
                      <span>
                        Supports Hindi, English, Bengali, Marathi, Hinglish &
                        Urdu
                      </span>
                      <span>{config.customMessage.length}/320</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: PHOTO PERSONALIZATION & 4 LUXURY FRAMES */}
            {activeTab === 'photo' && (
              <div className="wx-studio-card">
                <div className="wx-studio-sec-title">
                  <span>🖼️ Photo Personalization & 4 Frames</span>
                  <span className="wx-field-badge">1 Photo / Wish</span>
                </div>
                <p className="wx-studio-sec-desc">
                  Add a photo from your Mobile Gallery or Camera, adjust zoom
                  and position, and frame it in 24K luxury.
                </p>

                {/* Hidden File Inputs for Gallery and Camera */}
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={handlePhotoFileChange}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="sr-only"
                  onChange={handlePhotoFileChange}
                />

                <div className="wx-photo-upload-row">
                  <button
                    type="button"
                    className="wx-upload-btn"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={photoUploading}
                  >
                    <span>🖼️</span>
                    <span>
                      {config.photoDataUrl
                        ? 'Replace from Gallery'
                        : 'Mobile Gallery'}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="wx-upload-btn"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={photoUploading}
                  >
                    <span>📸</span>
                    <span>Mobile Camera</span>
                  </button>
                </div>

                {photoUploading && (
                  <p className="text-xs text-amber-300 font-bold mb-2">
                    ⏳ Optimizing photo for smooth mobile playback (
                    {photoProgress}%)...
                  </p>
                )}
                {photoError && <p className="wx-err mb-2">{photoError}</p>}

                {config.photoDataUrl && (
                  <>
                    {/* Photo Display Mode: Inside Wish Card vs Main Background */}
                    <div className="wx-bg-mode-switch mt-2">
                      <button
                        type="button"
                        className={`wx-mode-btn ${
                          config.photoDisplayMode === 'card' ? 'sel' : ''
                        }`}
                        onClick={() =>
                          onChangeConfig((prev) => ({
                            ...prev,
                            photoDisplayMode: 'card',
                          }))
                        }
                      >
                        👑 Photo Inside Wish Card
                      </button>
                      <button
                        type="button"
                        className={`wx-mode-btn ${
                          config.photoDisplayMode === 'background' ? 'sel' : ''
                        }`}
                        onClick={() =>
                          onChangeConfig((prev) => ({
                            ...prev,
                            photoDisplayMode: 'background',
                          }))
                        }
                      >
                        🌌 Photo as Main Background
                      </button>
                    </div>

                    {/* 4 Luxury Frame Styles */}
                    {config.photoDisplayMode === 'card' && (
                      <>
                        <div className="wx-field-label mt-3">
                          <span>Choose Luxury Frame Style (4)</span>
                        </div>
                        <div className="wx-frame-grid">
                          {PHOTO_FRAME_OPTIONS.map((fr) => (
                            <button
                              key={fr.id}
                              type="button"
                              className={`wx-frame-card ${
                                config.photoFrameId === fr.id ? 'sel' : ''
                              }`}
                              onClick={() =>
                                onChangeConfig((prev) => ({
                                  ...prev,
                                  photoFrameId: fr.id,
                                }))
                              }
                            >
                              <span className="text-lg">
                                {fr.cornerOrnament}
                              </span>
                              <b className="text-xs text-amber-200">
                                {fr.label}
                              </b>
                              <span className="text-[10px] text-amber-100/70">
                                {fr.tagline}
                              </span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Crop, Zoom & Pan Controls */}
                    <div className="wx-photo-sliders">
                      <div className="wx-slider-row">
                        <span>🔍 Zoom ({config.photoCrop.zoom.toFixed(2)}x)</span>
                        <input
                          type="range"
                          min="1"
                          max="3"
                          step="0.05"
                          value={config.photoCrop.zoom}
                          onChange={(e) => {
                            const zoom = parseFloat(e.target.value);
                            onChangeConfig((prev) => ({
                              ...prev,
                              photoCrop: { ...prev.photoCrop, zoom },
                            }));
                          }}
                        />
                      </div>

                      <div className="wx-slider-row">
                        <span>↔️ Horizontal Position</span>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          step="2"
                          value={config.photoCrop.offsetX}
                          onChange={(e) => {
                            const offsetX = parseInt(e.target.value, 10);
                            onChangeConfig((prev) => ({
                              ...prev,
                              photoCrop: { ...prev.photoCrop, offsetX },
                            }));
                          }}
                        />
                      </div>

                      <div className="wx-slider-row">
                        <span>↕️ Vertical Position</span>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          step="2"
                          value={config.photoCrop.offsetY}
                          onChange={(e) => {
                            const offsetY = parseInt(e.target.value, 10);
                            onChangeConfig((prev) => ({
                              ...prev,
                              photoCrop: { ...prev.photoCrop, offsetY },
                            }));
                          }}
                        />
                      </div>

                      <div className="flex justify-between gap-2 mt-1">
                        <button
                          type="button"
                          className="wx-song-btn"
                          onClick={() =>
                            onChangeConfig((prev) => ({
                              ...prev,
                              photoCrop: { zoom: 1, offsetX: 0, offsetY: 0 },
                            }))
                          }
                        >
                          Reset Position
                        </button>
                        <button
                          type="button"
                          className="wx-song-btn"
                          onClick={() =>
                            onChangeConfig((prev) => ({
                              ...prev,
                              photoDataUrl: null,
                              photoAssetId: null,
                            }))
                          }
                        >
                          🗑️ Remove Photo
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB 5: BACKGROUND SYSTEM (AUTOMATIC & CUSTOM GALLERY + UPLOAD) */}
            {activeTab === 'background' && (
              <div className="wx-studio-card">
                <div className="wx-studio-sec-title">
                  <span>🌌 Background System</span>
                  <span className="wx-field-badge">
                    {config.backgroundMode === 'auto'
                      ? `Auto: ${resolvedAutoBg.name}`
                      : 'Custom Mode'}
                  </span>
                </div>
                <p className="wx-studio-sec-desc">
                  Choose Mode A (Automatic matching with your animation & music
                  mood) or Mode B (16 Ready-Made Luxury Backgrounds across 8
                  categories + Upload Your Own).
                </p>

                <div className="wx-bg-mode-switch">
                  <button
                    type="button"
                    className={`wx-mode-btn ${
                      config.backgroundMode === 'auto' ? 'sel' : ''
                    }`}
                    onClick={() =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        backgroundMode: 'auto',
                        customBgDataUrl: null,
                      }))
                    }
                  >
                    ✨ Mode A: Automatic Background
                  </button>
                  <button
                    type="button"
                    className={`wx-mode-btn ${
                      config.backgroundMode === 'custom' ? 'sel' : ''
                    }`}
                    onClick={() =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        backgroundMode: 'custom',
                      }))
                    }
                  >
                    🎨 Mode B: Custom Background
                  </button>
                </div>

                {config.backgroundMode === 'auto' ? (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/30 text-xs text-amber-100">
                    <b>Automatic Harmonious Match Active:</b> Currently paired
                    with <b>{resolvedAutoBg.name}</b> ({resolvedAutoBg.category}
                    ) to match your <b>{ANIM[config.animationId].name}</b>{' '}
                    animation and <b>{currentSong.mood}</b> music mood.
                  </div>
                ) : (
                  <>
                    {/* 8 Background Category Pills */}
                    <div className="wx-cat-pills">
                      {BACKGROUND_CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          className={`wx-cat-pill ${
                            bgCategory === cat.id ? 'sel' : ''
                          }`}
                          onClick={() => setBgCategory(cat.id)}
                        >
                          <span>{cat.icon}</span>
                          <span>{cat.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Ready-Made Background Gallery Tiles */}
                    <div className="wx-bg-gallery-grid">
                      {filteredBackgrounds.map((bg) => {
                        const isSel =
                          !config.customBgDataUrl &&
                          config.backgroundId === bg.id;
                        return (
                          <button
                            key={bg.id}
                            type="button"
                            className={`wx-bg-tile wx-bg-${bg.id} ${
                              isSel ? 'sel' : ''
                            }`}
                            onClick={() =>
                              onChangeConfig((prev) => ({
                                ...prev,
                                backgroundMode: 'custom',
                                backgroundId: bg.id,
                                customBgDataUrl: null,
                              }))
                            }
                          >
                            <span className="wx-bg-tile-cat">
                              {bg.category}
                            </span>
                            <span className="wx-bg-tile-title">{bg.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Option 2: Upload Your Own Background */}
                    <div className="mt-4 pt-3 border-t border-amber-400/20">
                      <input
                        ref={bgUploadInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={handleBgFileChange}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          className="wx-upload-btn flex-1"
                          onClick={() => bgUploadInputRef.current?.click()}
                          disabled={bgUploading}
                        >
                          <span>📤</span>
                          <span>
                            {config.customBgDataUrl
                              ? 'Replace Custom Uploaded Background'
                              : 'Upload Your Own Background Image'}
                          </span>
                        </button>
                        {config.customBgDataUrl && (
                          <button
                            type="button"
                            className="wx-song-btn"
                            onClick={() =>
                              onChangeConfig((prev) => ({
                                ...prev,
                                customBgDataUrl: null,
                              }))
                            }
                          >
                            🗑️ Remove Upload
                          </button>
                        )}
                      </div>
                      {bgUploading && (
                        <p className="text-xs text-amber-300 font-bold mt-2">
                          ⏳ Compressing background ({bgProgress}%)...
                        </p>
                      )}
                      {bgError && <p className="wx-err mt-2">{bgError}</p>}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB 6: MUSIC ENGINE & TYPOGRAPHY STYLING */}
            {activeTab === 'music' && (
              <>
                <div className="wx-studio-card">
                  <div className="wx-studio-sec-title">
                    <span>🎵 Music Engine & Audio Sync</span>
                    <span className="wx-field-badge">
                      Default Vol: {volumePct}%
                    </span>
                  </div>
                  <p className="wx-studio-sec-desc">
                    Select a festive track by category or let Automatic Random
                    Mode assign a unique active song that stays fixed for your
                    generated wish link.
                  </p>

                  {/* Sound Enable / Mute & Volume Slider */}
                  <div className="wx-photo-sliders mb-3">
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        className={`wx-song-btn ${
                          soundEnabled ? 'active' : ''
                        }`}
                        onClick={() => SND.toggle()}
                      >
                        {soundEnabled
                          ? '🔊 Studio Music & SFX: ON'
                          : '🔇 Tap to Enable Music Preview'}
                      </button>

                      <button
                        type="button"
                        className="wx-song-btn"
                        onClick={() => {
                          const randomId = MUSIC.pickRandomActiveSongId(
                            config.musicId
                          );
                          MUSIC.selectSong(randomId, true);
                          if (!SND.isOn) SND.set(true);
                          onChangeConfig((prev) => ({
                            ...prev,
                            musicMode: 'auto',
                            musicId: randomId,
                          }));
                        }}
                      >
                        🎲 Auto-Pick Random Song
                      </button>
                    </div>

                    <div className="wx-slider-row mt-2">
                      <span>🎚️ Music Volume ({volumePct}%)</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={volumePct}
                        onChange={(e) => {
                          const pct = parseInt(e.target.value, 10);
                          MUSIC.setVolume(pct / 100);
                        }}
                      />
                    </div>
                  </div>

                  {/* Music Categories */}
                  <div className="wx-cat-pills">
                    {MUSIC_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        className={`wx-cat-pill ${
                          musicCategory === cat.id ? 'sel' : ''
                        }`}
                        onClick={() => setMusicCategory(cat.id)}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Active Songs in Selected Category */}
                  <div className="wx-song-list">
                    {filteredSongs.map((song) => {
                      const isSel = config.musicId === song.songId;
                      return (
                        <div
                          key={song.songId}
                          className={`wx-song-card ${isSel ? 'sel' : ''}`}
                        >
                          <div className="wx-song-meta">
                            <span className="wx-song-title">
                              {isSel ? '🎶 ' : '🎵 '}
                              {song.songName}
                            </span>
                            <span className="wx-song-sub">
                              {song.category} · Mood: {song.mood} ·{' '}
                              {song.duration || '02:50'}
                            </span>
                            {song.previewInfo && (
                              <span className="text-[11px] text-amber-200/70">
                                {song.previewInfo}
                              </span>
                            )}
                          </div>
                          <div className="wx-song-actions">
                            <button
                              type="button"
                              className={`wx-song-btn ${isSel ? 'active' : ''}`}
                              onClick={() => {
                                MUSIC.selectSong(song.songId, true);
                                if (!SND.isOn) SND.set(true);
                                onChangeConfig((prev) => ({
                                  ...prev,
                                  musicMode: 'manual',
                                  musicId: song.songId,
                                }));
                              }}
                            >
                              {isSel ? '✓ Selected' : 'Preview & Select'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Google Drive Audio Link Compatibility Validator */}
                  <div className="mt-4 pt-3 border-t border-amber-400/20">
                    <div className="wx-field-label mb-1">
                      <span>🔗 Google Drive Music Link Validator</span>
                      <span className="wx-field-badge">Auto-Fallback Safe</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        className="flex-1 rounded-xl bg-black/40 border border-amber-400/30 px-3 py-2 text-xs text-white outline-none"
                        placeholder="Paste Google Drive audio link (https://drive.google.com/file/d/.../view)"
                        value={driveUrlInput}
                        onChange={(e) => setDriveUrlInput(e.target.value)}
                      />
                      <button
                        type="button"
                        className="wx-song-btn"
                        disabled={driveValidating || !driveUrlInput.trim()}
                        onClick={async () => {
                          setDriveValidating(true);
                          const res = await MUSIC.validateGoogleDriveLink(
                            driveUrlInput
                          );
                          setDriveResult(res);
                          setDriveValidating(false);
                        }}
                      >
                        {driveValidating ? 'Checking...' : 'Test Link'}
                      </button>
                    </div>
                    {driveResult && (
                      <p className="text-xs text-amber-200/90 mt-2">
                        {driveResult.valid ? '✅' : '⚠️'} {driveResult.reason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Custom Font & Metallic Text Color Styling */}
                <div className="wx-studio-card">
                  <div className="wx-studio-sec-title">
                    <span>👑 Typography & Metallic Color</span>
                    <span className="wx-field-badge">5 Fonts · 6 Colors</span>
                  </div>

                  <div className="wx-font-grid">
                    {FONT_OPTIONS.map((fn) => (
                      <button
                        key={fn.id}
                        type="button"
                        className={`wx-font-card ${
                          config.fontId === fn.id ? 'sel' : ''
                        }`}
                        onClick={() =>
                          onChangeConfig((prev) => ({
                            ...prev,
                            fontId: fn.id,
                          }))
                        }
                      >
                        <div
                          className={`text-sm font-bold text-amber-200 wx-font-${fn.id} wx-font-sample`}
                        >
                          {fn.sample}
                        </div>
                        <div className="text-[11px] text-amber-100/75 mt-1">
                          {fn.label}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="wx-tc-grid">
                    {TEXT_COLOR_OPTIONS.map((tc) => (
                      <button
                        key={tc.id}
                        type="button"
                        className={`wx-tc-card ${
                          config.textColor === tc.id ? 'sel' : ''
                        }`}
                        onClick={() =>
                          onChangeConfig((prev) => ({
                            ...prev,
                            textColor: tc.id,
                          }))
                        }
                      >
                        <span className={`wx-tc-dot wx-tc-${tc.id}`} />
                        <span className="truncate">{tc.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* TAB 7: OPTIONAL PASSWORD PROTECTED WISH */}
            {activeTab === 'security' && (
              <div className="wx-studio-card">
                <div className="wx-studio-sec-title">
                  <span>🔒 Optional Password Protected Wish</span>
                  <span className="wx-field-badge">
                    {config.passwordProtected ? 'Locked' : 'Public Link'}
                  </span>
                </div>
                <p className="wx-studio-sec-desc">
                  Protect private New Year wishes with a secret password. When
                  enabled, recipients must enter the password before your wish
                  and photo are revealed.
                </p>

                <div className="wx-bg-mode-switch">
                  <button
                    type="button"
                    className={`wx-mode-btn ${
                      !config.passwordProtected ? 'sel' : ''
                    }`}
                    onClick={() => {
                      onChangePassword('');
                      onChangeConfig((prev) => ({
                        ...prev,
                        passwordProtected: false,
                      }));
                    }}
                  >
                    🌐 Open Without Password
                  </button>
                  <button
                    type="button"
                    className={`wx-mode-btn ${
                      config.passwordProtected ? 'sel' : ''
                    }`}
                    onClick={() =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        passwordProtected: true,
                      }))
                    }
                  >
                    🔒 Require Secret Password
                  </button>
                </div>

                {config.passwordProtected && (
                  <div className="mt-3">
                    <label
                      className="wx-field-label mb-1"
                      htmlFor="wx-wish-secret-pw"
                    >
                      <span>Enter Wish Unlock Password (min 3 characters)</span>
                      <span className="wx-field-badge">Encrypted Hash</span>
                    </label>
                    <div className="wx-inp">
                      <input
                        id="wx-wish-secret-pw"
                        type="text"
                        maxLength={32}
                        placeholder="e.g. 2027LOVE or secret code..."
                        value={rawPassword}
                        onChange={(e) => onChangePassword(e.target.value)}
                      />
                      <span>🔑</span>
                    </div>
                    <p className="text-xs text-amber-200/80 mt-2">
                      After publishing, you will get separate buttons to{' '}
                      <b>Copy Link</b>, <b>Copy Password</b>, or{' '}
                      <b>Share Link + Password</b> together on WhatsApp and
                      Telegram.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Sticky Action Footer */}
      <footer className="wx-studio-footer">
        <button type="button" className="wx-studio-back" onClick={onBack}>
          <span>Cancel</span>
        </button>

        <button
          type="button"
          className="wx-studio-top-publish"
          onClick={handlePublishClick}
          disabled={isPublishing}
        >
          <span>
            {isPublishing
              ? '⏳ Generating Your 2027 Wish...'
              : `🎉 ${formatTemplate(T.go, YEAR)}`}
          </span>
        </button>
      </footer>
    </div>
  );
};
