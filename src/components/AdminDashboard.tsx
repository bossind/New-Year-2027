import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Filter,
  Globe,
  KeyRound,
  Layers,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { MSG, UI, LangCode } from '../data/i18n';
import { ANIM, AnimId } from '../engine/animations';
import {
  parseSafeJsonResponse,
  resolveApiUrl,
} from '../lib/api-client';

type DateFilterPreset =
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | 'month'
  | 'all'
  | 'custom';

type DashboardTab =
  | 'overview'
  | 'visitors'
  | 'wishes'
  | 'names'
  | 'languages'
  | 'sharing'
  | 'telegram'
  | 'security';

interface AnalyticsPayload {
  dateRange: {
    startDate: string;
    endDate: string;
    preset: DateFilterPreset;
    todayDate: string;
  };
  overview: {
    totalWebsiteVisits: number;
    uniqueVisitors: number;
    returningVisitors: number;
    newVisitors: number;
    totalWishesCreated: number;
    totalShareClicks: number;
    liveVisitors: number;
    todayVisitors: number;
    todayVisits: number;
    todayWishesCreated: number;
    todayShareClicks: number;
    mostPopularLanguage: string;
    mostPopularAnimation: string;
    mostPopularGreetingId: number;
  };
  dailyGraph: Array<{
    date: string;
    visits: number;
    uniqueVisitors: number;
    wishes: number;
    shares: number;
  }>;
  hourlyGraph: Array<{
    hour: string;
    visits: number;
    wishes: number;
    shares: number;
  }>;
  monthlyGraph: Array<{
    month: string;
    visits: number;
    wishes: number;
    shares: number;
  }>;
  languageAnalytics: Array<{
    code: string;
    visits: number;
    wishes: number;
    total: number;
    percentage: number;
  }>;
  animationAnalytics: Array<{
    animId: string;
    count: number;
    percentage: number;
    rank: number;
  }>;
  greetingAnalytics: Array<{
    msgId: number;
    count: number;
    percentage: number;
  }>;
  sharingAnalytics: Array<{
    platform: string;
    clicks: number;
    percentage: number;
  }>;
  trafficSources: Array<{
    source: string;
    visits: number;
    percentage: number;
  }>;
  nameAnalytics: Array<{
    normalizedName: string;
    displayName: string;
    wishesCount: number;
    lastLanguage: string;
    lastAnimation: string;
    lastDate: string;
  }>;
}

interface TelegramStatusPayload {
  bot: {
    configured: boolean;
    source: string;
    maskedToken: string | null;
    botUsername: string | null;
    botFirstName: string | null;
    botTelegramId: string | null;
    webhookConnected: boolean;
    webhookUrl: string | null;
    lastConnectedAt: string | null;
    lastError: string | null;
    encryptionKeyConfigured: boolean;
    enrolledAdmins: Array<{
      id: number;
      telegramUserId: string;
      telegramUsername: string | null;
      firstName: string | null;
      phoneVerified: boolean;
      enrolledAt: string;
    }>;
  };
  settings: Array<{
    id: number;
    eventKey: string;
    label: string;
    category: string;
    enabled: boolean;
    cooldownSeconds: number;
    lastSentAt: string | null;
  }>;
  history: Array<{
    id: number;
    eventKey: string;
    title: string;
    messagePreview: string;
    status: string;
    retryCount: number;
    errorDetails: string | null;
    createdAt: string;
  }>;
}

interface AuditLogEntry {
  id: number;
  action: string;
  actor: string;
  status: string;
  ipHash: string | null;
  details: string | null;
  createdAt: string;
}

const LANG_DISPLAY_NAMES: Record<string, string> = {
  hi: 'Hindi (हिंदी)',
  en: 'English',
  bn: 'Bengali (বাংলা)',
  mr: 'Marathi (मराठी)',
  hinglish: 'Hinglish',
  ur: 'Urdu (اردو)',
  gu: 'Gujarati (ગુજરાતી)',
  ta: 'Tamil (தமிழ்)',
  te: 'Telugu (తెలుగు)',
  kn: 'Kannada (ಕನ್ನಡ)',
  ml: 'Malayalam (മലയാളം)',
  pa: 'Punjabi (ਪੰਜਾਬੀ)',
  or: 'Odia (ଓଡ଼ିଆ)',
  as: 'Assamese (অসমীয়া)',
};

const ANIM_DISPLAY_NAMES: Record<string, string> = {
  sparkler: 'Sparkler Name ✨',
  fireworks: 'Royal Fireworks 🎆',
  galaxy: 'Galaxy 🌌',
  countdown: 'Midnight Countdown 🕛',
  lanterns: 'Sky Lanterns 🏮',
  gold: 'Golden Luxe 👑',
  neon: 'Neon City ⚡',
  gift: 'Magic Gift 🎁',
  aurora: 'Aurora Snow ❄️',
};

const SHARE_PLATFORM_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  facebook: 'Facebook',
  x: 'X (Twitter)',
  native: 'Native Share Sheet',
  copy_link: 'Copy Link Button',
  other: 'Other Share Method',
};

const TRAFFIC_SOURCE_LABELS: Record<string, string> = {
  direct: 'Direct Traffic',
  google: 'Google Search Traffic',
  whatsapp: 'WhatsApp Referral',
  telegram: 'Telegram Referral',
  facebook: 'Facebook Referral',
  other: 'Other Referral Traffic',
};

interface AdminPortalProps {
  onClose: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ onClose }) => {
  // Authentication state held in React memory (never localStorage)
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionToken, setSessionToken] = useState<string>('');
  const [csrfToken, setCsrfToken] = useState<string>('');
  const [adminUsername, setAdminUsername] = useState<string>('Roynorules');
  const [isPasswordConfigured, setIsPasswordConfigured] = useState(true);
  const [usingEnvHash, setUsingEnvHash] = useState(false);
  const [bootstrapSecretRequired, setBootstrapSecretRequired] = useState(false);

  // Login & Enrollment Form States
  const [authStep, setAuthStep] = useState<
    'claim_password' | 'login' | 'enroll_telegram' | 'telegram_challenge'
  >('login');
  const [loginUsername, setLoginUsername] = useState('Roynorules');
  const [loginPassword, setLoginPassword] = useState('');
  const [confirmClaimPassword, setConfirmClaimPassword] = useState('');
  const [enrollBotToken, setEnrollBotToken] = useState('');
  const [enrollTelegramId, setEnrollTelegramId] = useState('');
  const [enrollBootstrapSecret, setEnrollBootstrapSecret] = useState('');
  const [enrollFirstName, setEnrollFirstName] = useState('Roynorules');
  const [challengeId, setChallengeId] = useState('');
  const [challengeExpiresAt, setChallengeExpiresAt] = useState<number>(0);
  const [challengeRemainingSec, setChallengeRemainingSec] = useState<number>(120);
  const [challengeBotUsername, setChallengeBotUsername] = useState<string | null>(
    null
  );
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Dashboard UI State
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Filters State
  const [datePreset, setDatePreset] = useState<DateFilterPreset>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [searchName, setSearchName] = useState('');
  const [nameSortBy, setNameSortBy] = useState<'count' | 'alpha' | 'date'>(
    'count'
  );
  const [filterLang, setFilterLang] = useState('all');
  const [filterAnim, setFilterAnim] = useState('all');

  // Data States
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');

  const [tgStatus, setTgStatus] = useState<TelegramStatusPayload | null>(null);
  const [tgLoading, setTgLoading] = useState(false);
  const [newBotTokenInput, setNewBotTokenInput] = useState('');
  const [tgActionMsg, setTgActionMsg] = useState('');
  const [tgActionErr, setTgActionErr] = useState('');
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false);
  const [reportPreviewText, setReportPreviewText] = useState('');
  const [newEnrollIdInput, setNewEnrollIdInput] = useState('');
  const [newEnrollSecretInput, setNewEnrollSecretInput] = useState('');

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [curPwdInput, setCurPwdInput] = useState('');
  const [newPwdInput, setNewPwdInput] = useState('');
  const [pwdChangeMsg, setPwdChangeMsg] = useState('');
  const [pwdChangeErr, setPwdChangeErr] = useState('');

  // Authenticated fetch helper passing Bearer token + CSRF token + credentials
  const adminFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const headers = new Headers(options.headers || {});
      headers.set('X-Requested-With', 'XMLHttpRequest');
      if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json');
      }
      if (sessionToken) {
        headers.set('Authorization', `Bearer ${sessionToken}`);
      }
      if (csrfToken) {
        headers.set('X-CSRF-Token', csrfToken);
      }
      if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      const res = await fetch(resolveApiUrl(url), {
        ...options,
        headers,
        credentials: 'include',
      });
      if (res.status === 401) {
        setIsAuthenticated(false);
        setSessionToken('');
        setCsrfToken('');
      }
      return res;
    },
    [sessionToken, csrfToken]
  );

  // Initial Auth Status Check
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(resolveApiUrl('/api/admin/auth/status'), {
          headers: { Accept: 'application/json' },
          credentials: 'include',
        });
        const parsed = await parseSafeJsonResponse(res);
        if (!mounted) return;
        if (!parsed.isJson || !parsed.ok) {
          setAuthError(
            parsed.errorMessage || 'Unable to reach authentication server.'
          );
          return;
        }
        const data = parsed.data;
        setAdminUsername(data.username || 'Roynorules');
        setLoginUsername(data.username || 'Roynorules');
        setIsPasswordConfigured(Boolean(data.isPasswordConfigured));
        setUsingEnvHash(Boolean(data.usingEnvHash));
        setBootstrapSecretRequired(Boolean(data.bootstrapSecretRequired));

        if (!data.isPasswordConfigured) {
          setAuthStep('claim_password');
        } else {
          setAuthStep('login');
        }

        if (data.authenticated && data.session) {
          setCsrfToken(data.session.csrfToken || '');
          setIsAuthenticated(true);
        }
      } catch {
        if (mounted) {
          setAuthError('Unable to reach authentication server.');
        }
      } finally {
        if (mounted) setCheckingStatus(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Poll Telegram Login Challenge when waiting for approval
  useEffect(() => {
    if (authStep !== 'telegram_challenge' || !challengeId) return;

    const timer = window.setInterval(() => {
      const rem = Math.max(
        0,
        Math.ceil((challengeExpiresAt - Date.now()) / 1000)
      );
      setChallengeRemainingSec(rem);
    }, 1000);

    const poller = window.setInterval(async () => {
      try {
        const res = await fetch(
          resolveApiUrl('/api/admin/auth/verify-challenge'),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ challengeId }),
          }
        );
        const parsed = await parseSafeJsonResponse(res);
        if (!parsed.isJson) return;
        const data = parsed.data;

        if (data.status === 'approved' && data.authenticated) {
          window.clearInterval(poller);
          window.clearInterval(timer);
          setSessionToken(data.sessionToken || '');
          setCsrfToken(data.csrfToken || '');
          setIsAuthenticated(true);
          setAuthError('');
        } else if (data.status === 'rejected') {
          window.clearInterval(poller);
          window.clearInterval(timer);
          setAuthError(
            data.error || 'Login request was rejected on Telegram.'
          );
          setAuthStep('login');
        } else if (data.status === 'expired') {
          window.clearInterval(poller);
          window.clearInterval(timer);
          setAuthError(
            'Telegram login challenge expired (2-minute limit). Please try again.'
          );
          setAuthStep('login');
        }
      } catch {
        // ignore transient poll failure
      }
    }, 2200);

    return () => {
      window.clearInterval(timer);
      window.clearInterval(poller);
    };
  }, [authStep, challengeId, challengeExpiresAt]);

  // Fetch Dashboard Analytics
  const fetchAnalytics = useCallback(async () => {
    if (!isAuthenticated) return;
    setAnalyticsLoading(true);
    setAnalyticsError('');
    try {
      const qs = new URLSearchParams({
        preset: datePreset,
        filterLang,
        filterAnim,
      });
      if (datePreset === 'custom') {
        if (customStart) qs.set('startDate', customStart);
        if (customEnd) qs.set('endDate', customEnd);
      }
      if (searchName.trim()) {
        qs.set('searchName', searchName.trim());
      }
      const res = await adminFetch(`/api/admin/analytics?${qs.toString()}`);
      const parsed = await parseSafeJsonResponse<AnalyticsPayload>(res);
      if (!parsed.ok || !parsed.isJson) {
        throw new Error(parsed.errorMessage || 'Failed to fetch analytics');
      }
      setAnalytics(parsed.data);
    } catch (e: unknown) {
      setAnalyticsError(
        e instanceof Error ? e.message : 'Error loading analytics.'
      );
    } finally {
      setAnalyticsLoading(false);
    }
  }, [
    isAuthenticated,
    datePreset,
    customStart,
    customEnd,
    filterLang,
    filterAnim,
    searchName,
    adminFetch,
  ]);

  // Fetch Telegram Settings & Status
  const fetchTelegramStatus = useCallback(async () => {
    if (!isAuthenticated) return;
    setTgLoading(true);
    try {
      const res = await adminFetch('/api/admin/telegram/status');
      const parsed = await parseSafeJsonResponse<TelegramStatusPayload>(res);
      if (parsed.ok && parsed.isJson) {
        setTgStatus(parsed.data);
      }
    } catch {
      // ignore
    } finally {
      setTgLoading(false);
    }
  }, [isAuthenticated, adminFetch]);

  // Fetch Security & Audit Logs
  const fetchSecurityLogs = useCallback(async () => {
    if (!isAuthenticated) return;
    setSecurityLoading(true);
    try {
      const res = await adminFetch('/api/admin/security/logs');
      const parsed = await parseSafeJsonResponse(res);
      if (parsed.ok && parsed.isJson) {
        setAuditLogs(parsed.data.auditLogs || []);
      }
    } catch {
      // ignore
    } finally {
      setSecurityLoading(false);
    }
  }, [isAuthenticated, adminFetch]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAnalytics();
      fetchTelegramStatus();
      fetchSecurityLogs();
    }
  }, [
    isAuthenticated,
    fetchAnalytics,
    fetchTelegramStatus,
    fetchSecurityLogs,
  ]);

  // Auto-refresh live visitors every 30 seconds while authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    const id = window.setInterval(() => {
      fetchAnalytics();
    }, 30000);
    return () => window.clearInterval(id);
  }, [isAuthenticated, fetchAnalytics]);

  // First-Run Password Claim Handler
  const handleClaimPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    if (loginPassword.length < 8) {
      setAuthError('Password must be at least 8 characters.');
      return;
    }
    if (loginPassword !== confirmClaimPassword) {
      setAuthError('Passwords do not match.');
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch(
        resolveApiUrl('/api/admin/auth/claim-password'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            username: loginUsername,
            password: loginPassword,
          }),
        }
      );
      const parsed = await parseSafeJsonResponse(res);
      if (!parsed.ok || !parsed.isJson) {
        throw new Error(
          parsed.errorMessage || 'Failed to save admin password.'
        );
      }
      setIsPasswordConfigured(true);
      setAuthSuccess(
        'Admin password hashed with bcrypt and locked! Now continue to log in.'
      );
      setAuthStep('login');
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error ? err.message : 'Failed to configure password.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  // Standard Admin Login Submit -> Triggers Telegram Verification Challenge
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);
    try {
      const res = await fetch(resolveApiUrl('/api/admin/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
        }),
      });
      const parsed = await parseSafeJsonResponse(res);

      if (!parsed.isJson) {
        throw new Error(
          parsed.errorMessage ||
            'Unexpected non-JSON response from authentication server.'
        );
      }

      const data = parsed.data;

      if (res.status === 428 && data.requiresEnrollment) {
        setAuthStep('enroll_telegram');
        setAuthError(data.error || '');
        return;
      }

      if (!res.ok) {
        throw new Error(
          data.error || parsed.errorMessage || 'Login failed.'
        );
      }

      if (data.challengeRequired && data.challengeId) {
        setChallengeId(data.challengeId);
        const exp = new Date(data.expiresAt).getTime();
        setChallengeExpiresAt(exp);
        setChallengeRemainingSec(
          Math.max(0, Math.ceil((exp - Date.now()) / 1000))
        );
        setChallengeBotUsername(data.botUsername || null);
        setAuthStep('telegram_challenge');
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  // First-time Telegram Admin Enrollment Handler
  const handleEnrollTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);
    try {
      const res = await fetch(
        resolveApiUrl('/api/admin/auth/enroll-telegram'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            username: loginUsername,
            password: loginPassword,
            bootstrapSecret: enrollBootstrapSecret,
            telegramUserId: enrollTelegramId,
            firstName: enrollFirstName,
            botToken: enrollBotToken,
          }),
        }
      );
      const parsed = await parseSafeJsonResponse(res);
      if (!parsed.ok || !parsed.isJson) {
        throw new Error(
          parsed.errorMessage || 'Telegram enrollment failed.'
        );
      }
      const data = parsed.data;
      setAuthSuccess(
        `Authorized Telegram ID ${data.enrolled.telegramUserId} enrolled! Click "Verify & Request Telegram Approval" to log in.`
      );
      setAuthStep('login');
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error ? err.message : 'Failed to enroll Telegram ID.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  // Logout Handler
  const handleLogout = async () => {
    try {
      await adminFetch('/api/admin/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
    setSessionToken('');
    setCsrfToken('');
    setLoginPassword('');
    setAuthStep('login');
  };

  // CSV Export Handler
  const handleExportCsv = async () => {
    try {
      const qs = new URLSearchParams({ preset: datePreset });
      if (datePreset === 'custom') {
        if (customStart) qs.set('startDate', customStart);
        if (customEnd) qs.set('endDate', customEnd);
      }
      const res = await adminFetch(
        `/api/admin/analytics/export-csv?${qs.toString()}`
      );
      if (!res.ok) throw new Error('Failed to export CSV');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `indian-newyear-2027-analytics-${datePreset}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setAnalyticsError('CSV export failed.');
    }
  };

  // Telegram Bot Actions
  const handleSaveBotToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setTgActionErr('');
    setTgActionMsg('');
    if (!newBotTokenInput.trim()) {
      setTgActionErr('Please enter your Telegram Bot Token.');
      return;
    }
    setTgLoading(true);
    try {
      const res = await adminFetch('/api/admin/telegram/save-token', {
        method: 'POST',
        body: JSON.stringify({ botToken: newBotTokenInput.trim() }),
      });
      const parsed = await parseSafeJsonResponse(res);
      if (!parsed.ok || !parsed.isJson) {
        throw new Error(parsed.errorMessage || 'Failed to save token');
      }
      setNewBotTokenInput('');
      setTgActionMsg(
        parsed.data.message ||
          'Save Successful! Token validated with getMe and encrypted.'
      );
      await fetchTelegramStatus();
    } catch (err: unknown) {
      setTgActionErr(
        err instanceof Error ? err.message : 'Failed to save bot token.'
      );
    } finally {
      setTgLoading(false);
    }
  };

  const handleConnectBot = async () => {
    setTgActionErr('');
    setTgActionMsg('');
    setTgLoading(true);
    try {
      const res = await adminFetch('/api/admin/telegram/connect', {
        method: 'POST',
      });
      const parsed = await parseSafeJsonResponse(res);
      if (!parsed.ok || !parsed.isJson) {
        throw new Error(parsed.errorMessage || 'Failed to connect bot');
      }
      const data = parsed.data;
      setTgActionMsg(
        `CONNECTED! Bot @${data.botUsername || data.botFirstName} is active (${data.webhookUrl}).`
      );
      await fetchTelegramStatus();
    } catch (err: unknown) {
      setTgActionErr(
        err instanceof Error ? err.message : 'Bot connection failed.'
      );
    } finally {
      setTgLoading(false);
    }
  };

  const handleTestBot = async () => {
    setTgActionErr('');
    setTgActionMsg('');
    setTgLoading(true);
    try {
      const res = await adminFetch('/api/admin/telegram/test', {
        method: 'POST',
      });
      const parsed = await parseSafeJsonResponse(res);
      if (!parsed.ok || !parsed.isJson) {
        throw new Error(parsed.errorMessage || 'Test failed');
      }
      const data = parsed.data;
      setTgActionMsg(
        `Test message delivered to ${data.deliveredCount}/${data.enrolledAdminsCount} enrolled Telegram admin(s) via @${data.botUsername || data.botFirstName}!`
      );
      await fetchTelegramStatus();
    } catch (err: unknown) {
      setTgActionErr(
        err instanceof Error ? err.message : 'Test connection failed.'
      );
    } finally {
      setTgLoading(false);
    }
  };

  const handleDisconnectBot = async () => {
    setTgActionErr('');
    setTgActionMsg('');
    setTgLoading(true);
    try {
      const res = await adminFetch('/api/admin/telegram/disconnect', {
        method: 'POST',
      });
      const parsed = await parseSafeJsonResponse(res);
      if (!parsed.ok || !parsed.isJson) {
        throw new Error(parsed.errorMessage || 'Disconnect failed');
      }
      setDisconnectConfirmOpen(false);
      setTgActionMsg('Telegram Bot disconnected and encrypted token deleted.');
      await fetchTelegramStatus();
    } catch (err: unknown) {
      setTgActionErr(
        err instanceof Error ? err.message : 'Failed to disconnect bot.'
      );
    } finally {
      setTgLoading(false);
    }
  };

  const handleToggleNotification = async (
    eventKey: string,
    currentEnabled: boolean
  ) => {
    try {
      const res = await adminFetch('/api/admin/telegram/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ eventKey, enabled: !currentEnabled }),
      });
      if (res.ok) {
        await fetchTelegramStatus();
      }
    } catch {
      // ignore
    }
  };

  const handleSendReportNow = async (
    reportType: 'daily' | 'weekly' | 'monthly'
  ) => {
    setTgActionErr('');
    setTgActionMsg('');
    setTgLoading(true);
    try {
      const res = await adminFetch('/api/admin/telegram/send-report', {
        method: 'POST',
        body: JSON.stringify({ reportType }),
      });
      const parsed = await parseSafeJsonResponse(res);
      if (!parsed.ok || !parsed.isJson) {
        throw new Error(parsed.errorMessage || 'Failed to send report');
      }
      setReportPreviewText(parsed.data.reportText || '');
      setTgActionMsg(
        `${reportType.toUpperCase()} Report generated from database and queued for Telegram delivery!`
      );
      await fetchTelegramStatus();
    } catch (err: unknown) {
      setTgActionErr(
        err instanceof Error ? err.message : 'Failed to send report.'
      );
    } finally {
      setTgLoading(false);
    }
  };

  const handleEnrollAdditionalTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    setTgActionErr('');
    setTgActionMsg('');
    if (!newEnrollIdInput.trim()) return;
    setTgLoading(true);
    try {
      const res = await adminFetch('/api/admin/telegram/enroll', {
        method: 'POST',
        body: JSON.stringify({
          telegramUserId: newEnrollIdInput.trim(),
          bootstrapSecret: newEnrollSecretInput.trim(),
          firstName: 'Roynorules',
        }),
      });
      const parsed = await parseSafeJsonResponse(res);
      if (!parsed.ok || !parsed.isJson) {
        throw new Error(parsed.errorMessage || 'Failed to enroll ID');
      }
      setNewEnrollIdInput('');
      setNewEnrollSecretInput('');
      setTgActionMsg(
        `Authorized Telegram numeric user ID ${parsed.data.enrolled.telegramUserId} saved!`
      );
      await fetchTelegramStatus();
    } catch (err: unknown) {
      setTgActionErr(
        err instanceof Error ? err.message : 'Failed to enroll ID.'
      );
    } finally {
      setTgLoading(false);
    }
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdChangeErr('');
    setPwdChangeMsg('');
    try {
      const res = await adminFetch('/api/admin/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: curPwdInput,
          newPassword: newPwdInput,
        }),
      });
      const parsed = await parseSafeJsonResponse(res);
      if (!parsed.ok || !parsed.isJson) {
        throw new Error(
          parsed.errorMessage || 'Failed to update password'
        );
      }
      setCurPwdInput('');
      setNewPwdInput('');
      setPwdChangeMsg(
        parsed.data.message || 'Password updated successfully.'
      );
      await fetchSecurityLogs();
    } catch (err: unknown) {
      setPwdChangeErr(
        err instanceof Error ? err.message : 'Failed to change password.'
      );
    }
  };

  // Sorted Name Analytics
  const sortedNames = React.useMemo(() => {
    if (!analytics?.nameAnalytics) return [];
    const copy = [...analytics.nameAnalytics];
    if (nameSortBy === 'alpha') {
      copy.sort((a, b) => a.displayName.localeCompare(b.displayName));
    } else if (nameSortBy === 'date') {
      copy.sort((a, b) => b.lastDate.localeCompare(a.lastDate));
    } else {
      copy.sort((a, b) => b.wishesCount - a.wishesCount);
    }
    return copy;
  }, [analytics?.nameAnalytics, nameSortBy]);

  // ==================================================
  // RENDER: LOADING OR ADMIN LOGIN & TELEGRAM CHALLENGE
  // ==================================================
  if (checkingStatus) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#050611]/95 backdrop-blur-md text-white">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#f5b83d] animate-spin" />
          <p className="text-sm text-slate-300">
            Initializing Security Gateway...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#050611]/95 backdrop-blur-xl p-4 overflow-y-auto">
        <div className="relative w-full max-w-md rounded-2xl border border-[#f5b83d]/30 bg-gradient-to-b from-[#0e1026] to-[#080917] p-6 sm:p-8 shadow-[0_25px_70px_rgba(0,0,0,0.85)] text-slate-100">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Admin Login"
            className="absolute top-4 right-4 rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#f5b83d] to-[#8b5cf6] text-[#070814] shadow-lg">
              <Shield className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#f5b83d]">
                Indian New Year 2027
              </span>
              <h2 className="text-xl font-extrabold text-white">
                Admin Security Gateway
              </h2>
            </div>
          </div>

          {authError && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {authSuccess && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{authSuccess}</span>
            </div>
          )}

          {/* STEP A: First-Run Admin Password Setup (Only if ADMIN_PASSWORD_HASH is unset and DB is uninitialized) */}
          {authStep === 'claim_password' && (
            <form onSubmit={handleClaimPassword} className="space-y-4">
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3.5 text-xs text-amber-200">
                <p className="font-bold text-amber-300 mb-1">
                  First-Run Admin Password Initialization
                </p>
                <p>
                  No password hash was found in{' '}
                  <code className="text-amber-300">ADMIN_PASSWORD_HASH</code> or
                  PostgreSQL yet. Set the password for{' '}
                  <b className="text-white">{adminUsername}</b> now; it will be
                  hashed with <b>bcrypt (cost 12)</b> and locked in PostgreSQL.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Admin Username
                </label>
                <input
                  type="text"
                  value={loginUsername}
                  readOnly
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Create Strong Admin Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full rounded-xl border border-white/15 bg-[#070814] px-3.5 py-2.5 text-sm text-white focus:border-[#f5b83d] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Confirm Admin Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmClaimPassword}
                  onChange={(e) => setConfirmClaimPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full rounded-xl border border-white/15 bg-[#070814] px-3.5 py-2.5 text-sm text-white focus:border-[#f5b83d] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f5b83d] to-[#d97706] py-3 text-sm font-bold text-[#070814] shadow-lg hover:brightness-110 transition disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                <span>
                  {authLoading
                    ? 'Hashing & Locking...'
                    : 'Hash & Lock Admin Password'}
                </span>
              </button>
            </form>
          )}

          {/* STEP B: Normal Username + Password Login */}
          {authStep === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <p className="text-xs text-slate-400">
                Enter your administrator credentials. After verification, a
                2-minute single-use login approval request will be sent to your
                authorized Telegram account.
              </p>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Admin Username
                </label>
                <input
                  type="text"
                  required
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Roynorules"
                  autoComplete="username"
                  className="w-full rounded-xl border border-white/15 bg-[#070814] px-3.5 py-2.5 text-sm text-white focus:border-[#f5b83d] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Admin Password
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-white/15 bg-[#070814] px-3.5 py-2.5 text-sm text-white focus:border-[#f5b83d] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f5b83d] via-[#fbbf24] to-[#8b5cf6] py-3 text-sm font-extrabold text-[#070814] shadow-lg hover:brightness-110 transition disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>
                  {authLoading
                    ? 'Verifying Credentials...'
                    : 'Verify & Request Telegram Approval'}
                </span>
              </button>
            </form>
          )}

          {/* STEP C: One-Time Telegram Bot & Authorized Numeric User ID Enrollment */}
          {authStep === 'enroll_telegram' && (
            <form onSubmit={handleEnrollTelegram} className="space-y-3.5">
              <div className="rounded-xl border border-purple-500/40 bg-purple-500/10 p-3 text-xs text-purple-200">
                <p className="font-bold text-purple-300 mb-1">
                  One-Time Telegram Admin Enrollment
                </p>
                <p>
                  Telegram login verification is mandatory. Enroll your Telegram
                  Bot Token and your numeric Telegram User ID (send{' '}
                  <code className="text-amber-300">/myid</code> to your bot or{' '}
                  <code className="text-amber-300">@userinfobot</code> to view
                  your numeric ID). Make sure you press <b>Start</b> in your bot
                  chat first.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Telegram Bot Token (Encrypted at rest with AES-256-GCM)
                </label>
                <input
                  type="password"
                  value={enrollBotToken}
                  onChange={(e) => setEnrollBotToken(e.target.value)}
                  placeholder="123456789:AAH..."
                  className="w-full rounded-xl border border-white/15 bg-[#070814] px-3 py-2 text-xs text-white focus:border-[#f5b83d] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Authorized Telegram Numeric User ID (Required)
                </label>
                <input
                  type="text"
                  required
                  pattern="\d{5,20}"
                  value={enrollTelegramId}
                  onChange={(e) => setEnrollTelegramId(e.target.value)}
                  placeholder="e.g. 543219876"
                  className="w-full rounded-xl border border-white/15 bg-[#070814] px-3 py-2 text-xs text-white focus:border-[#f5b83d] focus:outline-none"
                />
              </div>

              {bootstrapSecretRequired && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    ADMIN_BOOTSTRAP_SECRET (From Render Env Vars)
                  </label>
                  <input
                    type="password"
                    required
                    value={enrollBootstrapSecret}
                    onChange={(e) => setEnrollBootstrapSecret(e.target.value)}
                    placeholder="Enter bootstrap secret"
                    className="w-full rounded-xl border border-white/15 bg-[#070814] px-3 py-2 text-xs text-white focus:border-[#f5b83d] focus:outline-none"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAuthStep('login')}
                  className="flex-1 rounded-xl border border-white/15 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/5"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="flex-[2] rounded-xl bg-gradient-to-r from-[#f5b83d] to-[#8b5cf6] py-2.5 text-xs font-extrabold text-[#070814] hover:brightness-110 disabled:opacity-50"
                >
                  {authLoading
                    ? 'Validating & Enrolling...'
                    : 'Enroll Authorized Telegram ID'}
                </button>
              </div>
            </form>
          )}

          {/* STEP D: Waiting for Telegram Bot Inline Button Approval */}
          {authStep === 'telegram_challenge' && (
            <div className="space-y-4 text-center py-2">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#f5b83d]/40 bg-[#f5b83d]/10 text-[#f5b83d] animate-pulse">
                <Send className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-base font-bold text-white">
                  Approve Login on Telegram
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  We sent a login request to your enrolled Telegram account
                  {challengeBotUsername ? ` via @${challengeBotUsername}` : ''}.
                  Tap <b>✅ APPROVE LOGIN</b> in Telegram to open the Admin
                  Dashboard.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/40 p-3 text-xs">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span>Challenge ID:</span>
                  <code className="text-[#f5b83d]">
                    {challengeId.slice(0, 10)}
                  </code>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Single-Use Expiration:</span>
                  <span className="font-bold text-amber-300">
                    {Math.floor(challengeRemainingSec / 60)}:
                    {String(challengeRemainingSec % 60).padStart(2, '0')}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setChallengeId('');
                  setAuthStep('login');
                }}
                className="w-full rounded-xl border border-white/15 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/5"
              >
                Cancel Challenge
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==================================================
  // RENDER: AUTHENTICATED PREMIUM DARK ADMIN DASHBOARD
  // ==================================================
  const navItems: Array<{
    id: DashboardTab;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'overview',
      label: 'Overview & KPIs',
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      id: 'visitors',
      label: 'Visitor & Traffic',
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: 'wishes',
      label: 'Wish & Animations',
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      id: 'names',
      label: 'Name Analytics',
      icon: <Search className="w-4 h-4" />,
    },
    {
      id: 'languages',
      label: 'Language Analytics',
      icon: <Globe className="w-4 h-4" />,
    },
    {
      id: 'sharing',
      label: 'Sharing Analytics',
      icon: <Share2 className="w-4 h-4" />,
    },
    {
      id: 'telegram',
      label: 'Telegram Bot & Alerts',
      icon: <Send className="w-4 h-4" />,
    },
    {
      id: 'security',
      label: 'Security & Audit Logs',
      icon: <ShieldCheck className="w-4 h-4" />,
    },
  ];

  const ov = analytics?.overview || {
    totalWebsiteVisits: 0,
    uniqueVisitors: 0,
    returningVisitors: 0,
    newVisitors: 0,
    totalWishesCreated: 0,
    totalShareClicks: 0,
    liveVisitors: 0,
    todayVisitors: 0,
    todayVisits: 0,
    todayWishesCreated: 0,
    todayShareClicks: 0,
    mostPopularLanguage: 'hi',
    mostPopularAnimation: 'sparkler',
    mostPopularGreetingId: 1,
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col lg:flex-row bg-[#050611] text-slate-100 overflow-hidden font-sans">
      {/* Desktop & Mobile Sidebar Drawer */}
      <aside
        className={`${
          mobileMenuOpen ? 'fixed inset-0 z-50 flex' : 'hidden'
        } lg:static lg:flex lg:w-64 flex-col border-r border-white/10 bg-[#080a1a] shrink-0`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#f5b83d] to-[#8b5cf6] text-[#050611] font-black">
              🎆
            </div>
            <div>
              <div className="text-xs font-extrabold tracking-wider text-[#f5b83d] uppercase">
                NY 2027 Admin
              </div>
              <div className="text-xs text-slate-400">@{adminUsername}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden rounded-lg p-1.5 text-slate-400 hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-gradient-to-r from-[#f5b83d]/20 to-[#8b5cf6]/20 text-[#f5b83d] border border-[#f5b83d]/40 shadow-sm'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 transition"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Return to Website</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar with Date Filters & Global Controls */}
        <header className="border-b border-white/10 bg-[#080a1a]/90 backdrop-blur px-4 lg:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden rounded-xl border border-white/15 p-2 text-slate-200"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                <span>
                  {navItems.find((n) => n.id === activeTab)?.label ||
                    'Admin Dashboard'}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  {ov.liveVisitors} Live
                </span>
              </h1>
              {analytics?.dateRange && (
                <p className="text-[11px] text-slate-400">
                  Database Range (IST): {analytics.dateRange.startDate} →{' '}
                  {analytics.dateRange.endDate}
                </p>
              )}
            </div>
          </div>

          {/* Date Filter Bar & Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-white/15 bg-[#050611] p-1 text-xs">
              {(
                [
                  ['today', 'Today'],
                  ['yesterday', 'Yesterday'],
                  ['7d', '7D'],
                  ['30d', '30D'],
                  ['month', 'This Month'],
                  ['all', 'All Time'],
                  ['custom', 'Custom'],
                ] as Array<[DateFilterPreset, string]>
              ).map(([preset, label]) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDatePreset(preset)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                    datePreset === preset
                      ? 'bg-[#f5b83d] text-[#050611]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {datePreset === 'custom' && (
              <div className="flex items-center gap-1.5 text-xs">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="rounded-lg border border-white/15 bg-[#050611] px-2 py-1 text-xs text-white"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="rounded-lg border border-white/15 bg-[#050611] px-2 py-1 text-xs text-white"
                />
              </div>
            )}

            <button
              type="button"
              onClick={fetchAnalytics}
              disabled={analyticsLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10 transition"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  analyticsLoading ? 'animate-spin text-[#f5b83d]' : ''
                }`}
              />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#f5b83d] to-[#d97706] px-3 py-1.5 text-xs font-bold text-[#050611] hover:brightness-110 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </header>

        {/* Global Filter Bar (Language & Animation Filter) */}
        {['overview', 'visitors', 'wishes', 'names', 'languages', 'sharing'].includes(
          activeTab
        ) && (
          <div className="border-b border-white/10 bg-[#070917] px-4 lg:px-6 py-2 flex flex-wrap items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-slate-400 font-semibold">
              <Filter className="w-3.5 h-3.5 text-[#f5b83d]" />
              Filters:
            </span>

            <select
              value={filterLang}
              onChange={(e) => setFilterLang(e.target.value)}
              className="rounded-lg border border-white/15 bg-[#0c0e22] px-2.5 py-1 text-xs text-slate-200"
            >
              <option value="all">All Languages</option>
              {Object.entries(LANG_DISPLAY_NAMES).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={filterAnim}
              onChange={(e) => setFilterAnim(e.target.value)}
              className="rounded-lg border border-white/15 bg-[#0c0e22] px-2.5 py-1 text-xs text-slate-200"
            >
              <option value="all">All 9 Animations</option>
              {Object.entries(ANIM_DISPLAY_NAMES).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>

            {(filterLang !== 'all' || filterAnim !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setFilterLang('all');
                  setFilterAnim('all');
                }}
                className="text-[#f5b83d] hover:underline"
              >
                Reset Filters
              </button>
            )}
          </div>
        )}

        {/* Scrollable Dashboard Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
          {analyticsError && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-200 flex items-center justify-between">
              <span>{analyticsError}</span>
              <button
                type="button"
                onClick={fetchAnalytics}
                className="rounded-lg bg-rose-500/20 px-3 py-1 font-semibold"
              >
                Retry
              </button>
            </div>
          )}

          {/* TAB 1: OVERVIEW & 8 KPI CARDS */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* 8 Real Database KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  title="1. Total Website Visits"
                  value={ov.totalWebsiteVisits}
                  subtitle="In selected date period"
                  icon={<Eye className="w-5 h-5 text-[#f5b83d]" />}
                  accent="gold"
                />
                <KpiCard
                  title="2. Unique Visitors"
                  value={ov.uniqueVisitors}
                  subtitle={`${ov.newVisitors} New · ${ov.returningVisitors} Returning`}
                  icon={<Users className="w-5 h-5 text-purple-400" />}
                  accent="purple"
                />
                <KpiCard
                  title="3. Total Wishes Created"
                  value={ov.totalWishesCreated}
                  subtitle={`Top Anim: ${
                    ANIM_DISPLAY_NAMES[ov.mostPopularAnimation] ||
                    ov.mostPopularAnimation
                  }`}
                  icon={<Sparkles className="w-5 h-5 text-amber-400" />}
                  accent="gold"
                />
                <KpiCard
                  title="4. Total Share Button Clicks"
                  value={ov.totalShareClicks}
                  subtitle="Tracked button taps across platforms"
                  icon={<Share2 className="w-5 h-5 text-emerald-400" />}
                  accent="emerald"
                />
                <KpiCard
                  title="5. Live Visitors"
                  value={ov.liveVisitors}
                  subtitle="Active heartbeat within last 2 mins"
                  icon={<Activity className="w-5 h-5 text-emerald-400" />}
                  accent="emerald"
                  pulse
                />
                <KpiCard
                  title="6. Today's Visitors"
                  value={ov.todayVisitors}
                  subtitle={`${ov.todayVisits} total page visits today (IST)`}
                  icon={<Calendar className="w-5 h-5 text-sky-400" />}
                  accent="purple"
                />
                <KpiCard
                  title="7. Today's Wishes Created"
                  value={ov.todayWishesCreated}
                  subtitle="Generated since 00:00 IST"
                  icon={<Zap className="w-5 h-5 text-[#f5b83d]" />}
                  accent="gold"
                />
                <KpiCard
                  title="8. Today's Share Clicks"
                  value={ov.todayShareClicks}
                  subtitle="Share button clicks today (IST)"
                  icon={<MessageSquare className="w-5 h-5 text-purple-400" />}
                  accent="purple"
                />
              </div>

              {/* Daily Traffic & Wishes Trend Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-[#0a0c1e] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Daily Traffic & Wish Creation Trend
                      </h3>
                      <p className="text-xs text-slate-400">
                        Visits, Unique Visitors, Wishes Created, and Share Clicks
                      </p>
                    </div>
                  </div>
                  <DailyBarChart data={analytics?.dailyGraph || []} />
                </div>

                {/* Top Names Snapshot */}
                <div className="rounded-2xl border border-white/10 bg-[#0a0c1e] p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-white">
                        Top Popular Names
                      </h3>
                      <button
                        type="button"
                        onClick={() => setActiveTab('names')}
                        className="text-xs font-semibold text-[#f5b83d] hover:underline"
                      >
                        View All →
                      </button>
                    </div>

                    {sortedNames.length === 0 ? (
                      <p className="text-xs text-slate-400 py-8 text-center">
                        No wishes created in this date range yet.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {sortedNames.slice(0, 6).map((item, idx) => (
                          <div
                            key={item.normalizedName}
                            className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#f5b83d]/15 text-[#f5b83d] font-bold">
                                #{idx + 1}
                              </span>
                              <span className="font-bold text-white">
                                {item.displayName}
                              </span>
                            </div>
                            <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 font-bold text-purple-300">
                              {item.wishesCount} wishes
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                    <span>Most Popular Language:</span>
                    <b className="text-[#f5b83d]">
                      {LANG_DISPLAY_NAMES[ov.mostPopularLanguage] ||
                        ov.mostPopularLanguage}
                    </b>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VISITOR & TRAFFIC SOURCES ANALYTICS */}
          {activeTab === 'visitors' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <KpiCard
                  title="Total Visits"
                  value={ov.totalWebsiteVisits}
                  subtitle="Filtered page views"
                  icon={<Eye className="w-4 h-4 text-[#f5b83d]" />}
                  accent="gold"
                />
                <KpiCard
                  title="Unique Visitors"
                  value={ov.uniqueVisitors}
                  subtitle="Anonymous session IDs"
                  icon={<Users className="w-4 h-4 text-purple-400" />}
                  accent="purple"
                />
                <KpiCard
                  title="New Visitors"
                  value={ov.newVisitors}
                  subtitle="First-time visitors"
                  icon={<Sparkles className="w-4 h-4 text-amber-400" />}
                  accent="gold"
                />
                <KpiCard
                  title="Returning Visitors"
                  value={ov.returningVisitors}
                  subtitle="Multi-session visitors"
                  icon={<RefreshCw className="w-4 h-4 text-sky-400" />}
                  accent="purple"
                />
                <KpiCard
                  title="Live Active Visitors"
                  value={ov.liveVisitors}
                  subtitle="2-min heartbeat window"
                  icon={<Activity className="w-4 h-4 text-emerald-400" />}
                  accent="emerald"
                  pulse
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-white/10 bg-[#0a0c1e] p-5">
                  <h3 className="text-sm font-bold text-white mb-1">
                    Daily Visitor Graph
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Daily total visits vs. unique visitors (IST)
                  </p>
                  <DailyBarChart data={analytics?.dailyGraph || []} />
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#0a0c1e] p-5">
                  <h3 className="text-sm font-bold text-white mb-1">
                    Hourly Traffic Graph (00:00 – 23:00 IST)
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Peak traffic hours across India Standard Time
                  </p>
                  <HourlyBarChart data={analytics?.hourlyGraph || []} />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-white/10 bg-[#0a0c1e] p-5">
                  <h3 className="text-sm font-bold text-white mb-1">
                    Monthly Traffic Graph
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Aggregated monthly visits and wish creation volume
                  </p>
                  <div className="space-y-3">
                    {(analytics?.monthlyGraph || []).map((m) => (
                      <div
                        key={m.month}
                        className="rounded-xl border border-white/10 bg-black/30 p-3 flex items-center justify-between text-xs"
                      >
                        <span className="font-bold text-[#f5b83d]">
                          {m.month}
                        </span>
                        <div className="flex items-center gap-4">
                          <span>
                            Visits: <b className="text-white">{m.visits}</b>
                          </span>
                          <span>
                            Wishes: <b className="text-purple-300">{m.wishes}</b>
                          </span>
                          <span>
                            Share Clicks:{' '}
                            <b className="text-emerald-300">{m.shares}</b>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#0a0c1e] p-5">
                  <h3 className="text-sm font-bold text-white mb-1">
                    Traffic Sources Attribution
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Attributed from HTTP Referer & UTM parameters. Visits where
                    browsers strip referrer headers are categorized as Direct
                    Traffic.
                  </p>
                  <div className="space-y-3">
                    {(analytics?.trafficSources || []).map((src) => (
                      <div key={src.source} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-slate-200">
                            {TRAFFIC_SOURCE_LABELS[src.source] || src.source}
                          </span>
                          <span className="text-slate-400">
                            <b className="text-white">{src.visits}</b> visits (
                            {src.percentage}%)
                          </span>
                        </div>
                        <svg className="h-2 w-full rounded-full bg-white/5 overflow-hidden" viewBox="0 0 100 8" preserveAspectRatio="none">
                          <rect
                            x="0"
                            y="0"
                            width={Math.min(100, src.percentage)}
                            height="8"
                            rx="4"
                            fill="#f5b83d"
                          />
                        </svg>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WISH CREATION & 9 ANIMATION ANALYTICS */}
          {activeTab === 'wishes' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  title="Total Wishes Created"
                  value={ov.totalWishesCreated}
                  subtitle="In selected date range"
                  icon={<Sparkles className="w-5 h-5 text-[#f5b83d]" />}
                  accent="gold"
                />
                <KpiCard
                  title="Today's Wishes Created"
                  value={ov.todayWishesCreated}
                  subtitle="Since 00:00 IST today"
                  icon={<Zap className="w-5 h-5 text-amber-400" />}
                  accent="gold"
                />
                <div className="rounded-2xl border border-white/10 bg-[#0a0c1e] p-4">
                  <span className="text-xs text-slate-400">
                    Most Popular Language
                  </span>
                  <div className="text-lg font-extrabold text-[#f5b83d] mt-1">
                    {LANG_DISPLAY_NAMES[ov.mostPopularLanguage] ||
                      ov.mostPopularLanguage}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Highest wish creation share
                  </span>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#0a0c1e] p-4">
                  <span className="text-xs text-slate-400">
                    Most Popular Animation
                  </span>
                  <div className="text-lg font-extrabold text-purple-300 mt-1">
                    {ANIM_DISPLAY_NAMES[ov.mostPopularAnimation] ||
                      ov.mostPopularAnimation}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    #1 ranked 3D canvas theme
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* All 9 Animations Popularity Ranking */}
                <div className="rounded-2xl border border-white/10 bg-[#0a0c1e] p-5">
                  <h3 className="text-sm font-bold text-white mb-1">
                    9 Animations Popularity & Ranking
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Real selection counts and percentages across all 9 3D Canvas
                    animations
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/10 text-slate-400">
                          <th className="py-2 pr-2">Rank</th>
                          <th className="py-2 px-2">Animation Name</th>
                          <th className="py-2 px-2 text-right">Selections</th>
                          <th className="py-2 pl-2 text-right">Share %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {(analytics?.animationAnalytics || []).map((anim) => (
                          <tr key={anim.animId} className="hover:bg-white/[0.02]">
                            <td className="py-2.5 pr-2 font-bold text-[#f5b83d]">
                              #{anim.rank}
                            </td>
                            <td className="py-2.5 px-2 font-semibold text-white">
                              {ANIM_DISPLAY_NAMES[anim.animId] || anim.animId}
                            </td>
                            <td className="py-2.5 px-2 text-right font-bold text-slate-200">
                              {anim.count}
                            </td>
                            <td className="py-2.5 pl-2 text-right">
                              <span className="rounded-full bg-purple-500/20 px-2 py-0.5 font-semibold text-purple-300">
                                {anim.percentage}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Popular Greeting Messages */}
                <div className="rounded-2xl border border-white/10 bg-[#0a0c1e] p-5">
                  <h3 className="text-sm font-bold text-white mb-1">
                    Greeting Message Category Breakdown
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Most selected New Year greeting templates
                  </p>
                  {(!analytics?.greetingAnalytics ||
                    analytics.greetingAnalytics.length === 0) ? (
                    <p className="text-xs text-slate-400 py-8 text-center">
                      No greeting message selections recorded in this period yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {analytics.greetingAnalytics.slice(0, 8).map((g) => {
                        const msgObj =
                          MSG.find((m) => m.id === g.msgId) || MSG[0];
                        return (
                          <div
                            key={g.msgId}
                            className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-[#f5b83d]">
                                {msgObj.label} (w={g.msgId})
                              </span>
                              <span className="font-bold text-white">
                                {g.count} wishes ({g.percentage}%)
                              </span>
                            </div>
                            <p className="text-slate-400 line-clamp-1">
                              {msgObj.text}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: NAME ANALYTICS */}
          {activeTab === 'names' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-[#0a0c1e] p-5">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Aggregated Name Statistics
                    </h3>
                    <p className="text-xs text-slate-400">
                      Names are normalized to prevent duplicates while preserving
                      display spelling. Only aggregated counts are stored.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchName}
                        onChange={(e) => setSearchName(e.target.value)}
                        placeholder="Search name (e.g. Ritik)..."
                        className="rounded-xl border border-white/15 bg-[#050611] pl-9 pr-3 py-1.5 text-xs text-white focus:border-[#f5b83d] focus:outline-none"
                      />
                    </div>

                    <select
                      value={nameSortBy}
                      onChange={(e) =>
                        setNameSortBy(
                          e.target.value as 'count' | 'alpha' | 'date'
                        )
                      }
                      className="rounded-xl border border-white/15 bg-[#050611] px-3 py-1.5 text-xs text-slate-200"
                    >
                      <option value="count">Sort: Most Wishes First</option>
                      <option value="alpha">Sort: Alphabetical (A–Z)</option>
                      <option value="date">Sort: Most Recent Date</option>
                    </select>
                  </div>
                </div>

                {sortedNames.length === 0 ? (
                  <div className="rounded-xl border border-white/5 bg-black/20 py-12 text-center text-xs text-slate-400">
                    No aggregated name records match your current search or date
                    filter.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/10 text-slate-400">
                          <th className="py-2.5 pr-3">Rank</th>
                          <th className="py-2.5 px-3">Name</th>
                          <th className="py-2.5 px-3 text-right">
                            Wishes Created
                          </th>
                          <th className="py-2.5 px-3">Last Language</th>
                          <th className="py-2.5 px-3">Last Animation</th>
                          <th className="py-2.5 pl-3 text-right">
                            Last Active Date
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {sortedNames.map((n, index) => (
                          <tr
                            key={n.normalizedName}
                            className="hover:bg-white/[0.02]"
                          >
                            <td className="py-3 pr-3 font-bold text-[#f5b83d]">
                              #{index + 1}
                            </td>
                            <td className="py-3 px-3 font-extrabold text-white text-sm">
                              {n.displayName}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <span className="inline-flex items-center rounded-full bg-[#f5b83d]/15 px-3 py-0.5 font-extrabold text-[#f5b83d]">
                                {n.wishesCount}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-300">
                              {LANG_DISPLAY_NAMES[n.lastLanguage] ||
                                n.lastLanguage}
                            </td>
                            <td className="py-3 px-3 text-slate-300">
                              {ANIM_DISPLAY_NAMES[n.lastAnimation] ||
                                n.lastAnimation}
                            </td>
                            <td className="py-3 pl-3 text-right text-slate-400">
                              {n.lastDate}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: LANGUAGE ANALYTICS */}
          {activeTab === 'languages' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-[#0a0c1e] p-5">
                <h3 className="text-base font-bold text-white mb-1">
                  Language Usage Analytics
                </h3>
                <p className="text-xs text-slate-400 mb-5">
                  Breakdown across Hindi, English, Bengali, Marathi, Hinglish,
                  Urdu, and regional Indian languages
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(analytics?.languageAnalytics || []).map((lang) => (
                    <div
                      key={lang.code}
                      className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">
                          {LANG_DISPLAY_NAMES[lang.code] || lang.code}
                        </span>
                        <span className="rounded-full bg-[#f5b83d]/20 px-2.5 py-0.5 text-xs font-extrabold text-[#f5b83d]">
                          {lang.percentage}%
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-300">
                        <span>
                          Wishes Created:{' '}
                          <b className="text-white">{lang.wishes}</b>
                        </span>
                        <span>
                          Page Visits:{' '}
                          <b className="text-purple-300">{lang.visits}</b>
                        </span>
                      </div>

                      <svg className="h-2.5 w-full rounded-full bg-white/5 overflow-hidden" viewBox="0 0 100 10" preserveAspectRatio="none">
                        <rect
                          x="0"
                          y="0"
                          width={Math.min(100, lang.percentage)}
                          height="10"
                          rx="5"
                          fill="#f5b83d"
                        />
                      </svg>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: SHARING ANALYTICS */}
          {activeTab === 'sharing' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-xs text-amber-200 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <b className="text-amber-300">
                    Share Clicks (Not Confirmed Deliveries):
                  </b>{' '}
                  External messaging apps (WhatsApp, Telegram, Facebook, X) do
                  not notify websites after a user finishes sending a message.
                  These metrics strictly represent actual{' '}
                  <b>Share Button Clicks</b> on the website.
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0a0c1e] p-5">
                <h3 className="text-base font-bold text-white mb-4">
                  Share Clicks by Platform
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(analytics?.sharingAnalytics || []).map((sh) => (
                    <div
                      key={sh.platform}
                      className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">
                          {SHARE_PLATFORM_LABELS[sh.platform] || sh.platform}
                        </span>
                        <span className="text-xs font-bold text-emerald-400">
                          {sh.percentage}%
                        </span>
                      </div>
                      <div className="text-2xl font-black text-[#f5b83d]">
                        {sh.clicks}{' '}
                        <span className="text-xs font-normal text-slate-400">
                          Share Clicks
                        </span>
                      </div>
                      <svg className="h-2 w-full rounded-full bg-white/5 overflow-hidden" viewBox="0 0 100 8" preserveAspectRatio="none">
                        <rect
                          x="0"
                          y="0"
                          width={Math.min(100, sh.percentage)}
                          height="8"
                          rx="4"
                          fill="#34d399"
                        />
                      </svg>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: TELEGRAM BOT & 15 NOTIFICATION SETTINGS */}
          {activeTab === 'telegram' && (
            <div className="space-y-6">
              {tgActionMsg && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{tgActionMsg}</span>
                </div>
              )}
              {tgActionErr && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{tgActionErr}</span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bot Status & Configuration Card */}
                <div className="rounded-2xl border border-white/10 bg-[#0a0c1e] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white">
                        Telegram Bot Status & Token Configuration
                      </h3>
                      <p className="text-xs text-slate-400">
                        Validated with Telegram getMe API & encrypted with
                        AES-256-GCM
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        tgStatus?.bot.webhookConnected
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : tgStatus?.bot.configured
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {tgStatus?.bot.webhookConnected
                        ? '● Connected'
                        : tgStatus?.bot.configured
                        ? '● Token Saved'
                        : '● Disconnected'}
                    </span>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/40 p-3.5 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Masked Bot Token:</span>
                      <code className="text-[#f5b83d]">
                        {tgStatus?.bot.maskedToken || 'Not Configured'}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Bot Identity:</span>
                      <span className="font-bold text-white">
                        {tgStatus?.bot.botUsername
                          ? `@${tgStatus.bot.botUsername} (${tgStatus.bot.botFirstName})`
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">
                        Last Successful Connection:
                      </span>
                      <span className="text-slate-200">
                        {tgStatus?.bot.lastConnectedAt
                          ? new Date(
                              tgStatus.bot.lastConnectedAt
                            ).toLocaleString()
                          : 'Never'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Last Error:</span>
                      <span className="text-rose-300">
                        {tgStatus?.bot.lastError || 'None'}
                      </span>
                    </div>
                  </div>

                  {/* Step 1: Enter and Save Bot Token */}
                  <form onSubmit={handleSaveBotToken} className="space-y-2.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Bot Token Configuration
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={newBotTokenInput}
                        onChange={(e) => setNewBotTokenInput(e.target.value)}
                        placeholder="Enter Telegram Bot Token (123456:ABC...)"
                        className="flex-1 rounded-xl border border-white/15 bg-[#050611] px-3.5 py-2 text-xs text-white focus:border-[#f5b83d] focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={tgLoading}
                        className="rounded-xl bg-[#f5b83d] px-4 py-2 text-xs font-extrabold text-[#050611] hover:brightness-110 transition disabled:opacity-50"
                      >
                        Save Bot Configuration
                      </button>
                    </div>
                  </form>

                  {/* Step 2: Prominent CONNECT YOUR BOT button */}
                  {tgStatus?.bot.configured && (
                    <div className="pt-2 space-y-2.5">
                      <button
                        type="button"
                        onClick={handleConnectBot}
                        disabled={tgLoading}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f5b83d] via-[#fbbf24] to-[#8b5cf6] py-3.5 text-sm font-black text-[#050611] shadow-[0_0_25px_rgba(245,184,61,0.4)] hover:brightness-110 transition"
                      >
                        <Zap className="w-4 h-4" />
                        <span>CONNECT YOUR BOT</span>
                      </button>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleTestBot}
                          disabled={tgLoading}
                          className="flex-1 rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20"
                        >
                          Test Bot Connection
                        </button>

                        {!disconnectConfirmOpen ? (
                          <button
                            type="button"
                            onClick={() => setDisconnectConfirmOpen(true)}
                            className="flex-1 rounded-xl border border-rose-500/40 bg-rose-500/10 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/20"
                          >
                            Disconnect Bot
                          </button>
                        ) : (
                          <div className="flex-1 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={handleDisconnectBot}
                              className="flex-1 rounded-xl bg-rose-600 py-2 text-xs font-bold text-white"
                            >
                              Confirm Disconnect
                            </button>
                            <button
                              type="button"
                              onClick={() => setDisconnectConfirmOpen(false)}
                              className="rounded-xl border border-white/15 px-2 py-2 text-xs text-slate-300"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Enrolled Authorized Telegram Admin IDs & Instant Reports */}
                <div className="rounded-2xl border border-white/10 bg-[#0a0c1e] p-5 space-y-4">
                  <h3 className="text-base font-bold text-white">
                    Authorized Telegram Admin Enrollment & Reports
                  </h3>
                  <p className="text-xs text-slate-400">
                    Only enrolled numeric Telegram User IDs can approve admin
                    logins or receive sensitive reports.
                  </p>

                  <div className="space-y-2">
                    {(tgStatus?.bot.enrolledAdmins || []).map((adm) => (
                      <div
                        key={adm.id}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-xs"
                      >
                        <div>
                          <span className="font-bold text-white">
                            Numeric ID: <code>{adm.telegramUserId}</code>
                          </span>
                          <span className="ml-2 text-slate-400">
                            ({adm.firstName || 'Admin'})
                          </span>
                        </div>
                        <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                          Authorized
                        </span>
                      </div>
                    ))}
                  </div>

                  <form
                    onSubmit={handleEnrollAdditionalTelegram}
                    className="space-y-2 pt-2 border-t border-white/10"
                  >
                    <label className="block text-xs font-semibold text-slate-300">
                      Enroll / Update Authorized Telegram Numeric ID
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        pattern="\d{5,20}"
                        value={newEnrollIdInput}
                        onChange={(e) => setNewEnrollIdInput(e.target.value)}
                        placeholder="Numeric Telegram ID"
                        className="flex-1 rounded-xl border border-white/15 bg-[#050611] px-3 py-2 text-xs text-white"
                      />
                      <input
                        type="password"
                        value={newEnrollSecretInput}
                        onChange={(e) => setNewEnrollSecretInput(e.target.value)}
                        placeholder="ADMIN_BOOTSTRAP_SECRET (if set)"
                        className="flex-1 rounded-xl border border-white/15 bg-[#050611] px-3 py-2 text-xs text-white"
                      />
                      <button
                        type="submit"
                        className="rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-purple-500"
                      >
                        Enroll ID
                      </button>
                    </div>
                  </form>

                  {/* Instant Database Report Dispatch */}
                  <div className="pt-3 border-t border-white/10 space-y-2.5">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-[#f5b83d]">
                      Send Real Database Report to Telegram Now
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleSendReportNow('daily')}
                        className="rounded-xl border border-white/15 bg-white/5 py-2 text-xs font-bold text-white hover:bg-white/10"
                      >
                        Daily Report
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendReportNow('weekly')}
                        className="rounded-xl border border-white/15 bg-white/5 py-2 text-xs font-bold text-white hover:bg-white/10"
                      >
                        Weekly Report
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendReportNow('monthly')}
                        className="rounded-xl border border-white/15 bg-white/5 py-2 text-xs font-bold text-white hover:bg-white/10"
                      >
                        Monthly Report
                      </button>
                    </div>
                    {reportPreviewText && (
                      <pre className="rounded-xl border border-white/10 bg-black/50 p-3 text-[11px] text-amber-200 whitespace-pre-wrap font-mono">
                        {reportPreviewText}
                      </pre>
                    )}
                  </div>
                </div>
              </div>

              {/* 15 Configurable Notification Switches */}
              <div className="rounded-2xl border border-white/10 bg-[#0a0c1e] p-5">
                <h3 className="text-base font-bold text-white mb-1">
                  15 Configurable Telegram Notification Preferences
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  High-volume visitor and share events are automatically
                  aggregated across cooldown windows to prevent notification
                  spam.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(tgStatus?.settings || []).map((s) => (
                    <div
                      key={s.eventKey}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-3.5 text-xs"
                    >
                      <div className="pr-2">
                        <div className="font-bold text-white">{s.label}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Category: {s.category} ·{' '}
                          {s.cooldownSeconds > 0
                            ? `${s.cooldownSeconds}s anti-spam cooldown`
                            : 'Instant alert'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleNotification(s.eventKey, s.enabled)
                        }
                        className={`rounded-full px-3 py-1 text-xs font-extrabold transition ${
                          s.enabled
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 border border-white/10'
                        }`}
                      >
                        {s.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notification Delivery History */}
              <div className="rounded-2xl border border-white/10 bg-[#0a0c1e] p-5">
                <h3 className="text-base font-bold text-white mb-4">
                  Telegram Notification History
                </h3>
                {(!tgStatus?.history || tgStatus.history.length === 0) ? (
                  <p className="text-xs text-slate-400 py-6 text-center">
                    No notification logs recorded yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/10 text-slate-400">
                          <th className="py-2 pr-3">Time</th>
                          <th className="py-2 px-3">Notification Type</th>
                          <th className="py-2 px-3">Preview</th>
                          <th className="py-2 pl-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {tgStatus.history.map((h) => (
                          <tr key={h.id}>
                            <td className="py-2.5 pr-3 text-slate-400 whitespace-nowrap">
                              {new Date(h.createdAt).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-white">
                              {h.title}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300 max-w-md truncate">
                              {h.messagePreview}
                              {h.errorDetails ? (
                                <span className="block text-rose-400 text-[11px]">
                                  Note: {h.errorDetails}
                                </span>
                              ) : null}
                            </td>
                            <td className="py-2.5 pl-3 text-right">
                              <span
                                className={`rounded-full px-2.5 py-0.5 font-bold ${
                                  h.status === 'sent'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : h.status === 'queued'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-rose-500/20 text-rose-300'
                                }`}
                              >
                                {h.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 8: SECURITY EVENTS, LOGIN HISTORY & CHANGE PASSWORD */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Change Admin Password Card */}
                <div className="rounded-2xl border border-white/10 bg-[#0a0c1e] p-5 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <KeyRound className="w-5 h-5 text-[#f5b83d]" />
                    <h3 className="text-base font-bold text-white">
                      Change Admin Password
                    </h3>
                  </div>

                  {usingEnvHash ? (
                    <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3.5 text-xs text-amber-200">
                      Your password hash is locked via the{' '}
                      <code>ADMIN_PASSWORD_HASH</code> Render environment
                      variable. Update <code>ADMIN_PASSWORD_HASH</code> in your
                      Render dashboard to rotate it.
                    </div>
                  ) : (
                    <form
                      onSubmit={handlePasswordChangeSubmit}
                      className="space-y-3"
                    >
                      {pwdChangeMsg && (
                        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-xs text-emerald-200">
                          {pwdChangeMsg}
                        </div>
                      )}
                      {pwdChangeErr && (
                        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-200">
                          {pwdChangeErr}
                        </div>
                      )}

                      <div>
                        <label className="block text-xs text-slate-300 mb-1">
                          Current Password
                        </label>
                        <input
                          type="password"
                          required
                          value={curPwdInput}
                          onChange={(e) => setCurPwdInput(e.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-[#050611] px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-300 mb-1">
                          New Password (min 8 chars, hashed with bcrypt)
                        </label>
                        <input
                          type="password"
                          required
                          minLength={8}
                          value={newPwdInput}
                          onChange={(e) => setNewPwdInput(e.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-[#050611] px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full rounded-xl bg-[#f5b83d] py-2.5 text-xs font-extrabold text-[#050611] hover:brightness-110"
                      >
                        Update Password Hash
                      </button>
                    </form>
                  )}
                </div>

                {/* Admin Login History & Security Audit Logs */}
                <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-[#0a0c1e] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-bold text-white">
                        Admin Login History & Security Audit Trail
                      </h3>
                      <p className="text-xs text-slate-400">
                        Immutable record of login attempts, Telegram approvals,
                        and configuration changes
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={fetchSecurityLogs}
                      className="rounded-xl border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5"
                    >
                      Refresh Logs
                    </button>
                  </div>

                  {securityLoading ? (
                    <p className="text-xs text-slate-400 py-6 text-center">
                      Loading audit logs...
                    </p>
                  ) : auditLogs.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">
                      No security events logged yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-white/10 text-slate-400">
                            <th className="py-2 pr-3">Timestamp</th>
                            <th className="py-2 px-3">Event</th>
                            <th className="py-2 px-3">Actor</th>
                            <th className="py-2 px-3">Details</th>
                            <th className="py-2 pl-3 text-right">Result</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {auditLogs.map((log) => (
                            <tr key={log.id}>
                              <td className="py-2.5 pr-3 text-slate-400 whitespace-nowrap">
                                {new Date(log.createdAt).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-white">
                                {log.action}
                              </td>
                              <td className="py-2.5 px-3 text-[#f5b83d]">
                                {log.actor}
                              </td>
                              <td className="py-2.5 px-3 text-slate-300">
                                {log.details}
                              </td>
                              <td className="py-2.5 pl-3 text-right">
                                <span
                                  className={`rounded-full px-2.5 py-0.5 font-bold ${
                                    log.status === 'success'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : log.status === 'warning'
                                      ? 'bg-amber-500/20 text-amber-300'
                                      : 'bg-rose-500/20 text-rose-300'
                                  }`}
                                >
                                  {log.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

/* ---------- Subcomponents for KPI Cards & Charts ---------- */
const KpiCard: React.FC<{
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  accent: 'gold' | 'purple' | 'emerald';
  pulse?: boolean;
}> = ({ title, value, subtitle, icon, accent, pulse }) => {
  const borderCls =
    accent === 'gold'
      ? 'border-[#f5b83d]/25'
      : accent === 'emerald'
      ? 'border-emerald-500/25'
      : 'border-purple-500/25';

  return (
    <div
      className={`rounded-2xl border ${borderCls} bg-gradient-to-b from-[#0d1025] to-[#080a18] p-4 shadow-lg`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-300">{title}</span>
        <div className="rounded-xl bg-white/5 p-2">{icon}</div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          {value.toLocaleString()}
        </span>
        {pulse && (
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
        )}
      </div>
      <p className="text-[11px] text-slate-400 mt-1 truncate">{subtitle}</p>
    </div>
  );
};

const DailyBarChart: React.FC<{
  data: Array<{
    date: string;
    visits: number;
    uniqueVisitors: number;
    wishes: number;
    shares: number;
  }>;
}> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="py-12 text-center text-xs text-slate-500">
        No daily traffic data recorded yet.
      </div>
    );
  }
  const recent = data.slice(-14);
  const maxVal = Math.max(
    1,
    ...recent.map((d) => Math.max(d.visits, d.wishes, d.shares))
  );

  return (
    <div className="space-y-3">
      <div className="h-48 flex items-end gap-2 pt-4 pb-2 px-1 border-b border-white/10">
        {recent.map((d) => {
          const visitH = Math.max(6, Math.round((d.visits / maxVal) * 140));
          const wishH = Math.max(4, Math.round((d.wishes / maxVal) * 140));
          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col items-center gap-1 group relative"
            >
              <svg
                className="w-full h-36"
                viewBox="0 0 24 140"
                preserveAspectRatio="none"
              >
                <title>{`${d.date}: ${d.visits} visits, ${d.wishes} wishes`}</title>
                <rect
                  x="3"
                  y={140 - visitH}
                  width="8"
                  height={visitH}
                  rx="2"
                  fill="#f5b83d"
                />
                <rect
                  x="13"
                  y={140 - wishH}
                  width="8"
                  height={wishH}
                  rx="2"
                  fill="#a855f7"
                />
              </svg>
              <span className="text-[10px] text-slate-400 truncate max-w-[44px]">
                {d.date.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#f5b83d]" /> Total Visits
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-purple-500" /> Wishes
          Created
        </span>
      </div>
    </div>
  );
};

const HourlyBarChart: React.FC<{
  data: Array<{
    hour: string;
    visits: number;
    wishes: number;
    shares: number;
  }>;
}> = ({ data }) => {
  const maxVal = Math.max(1, ...data.map((h) => h.visits + h.wishes));
  return (
    <div className="space-y-3">
      <div className="h-48 flex items-end gap-1 pt-4 pb-2 border-b border-white/10">
        {data.map((h) => {
          const barH = Math.max(
            4,
            Math.round(((h.visits + h.wishes) / maxVal) * 140)
          );
          return (
            <div
              key={h.hour}
              className="flex-1 flex flex-col items-center gap-1"
            >
              <svg
                className="w-full max-w-[10px] h-36"
                viewBox="0 0 10 140"
                preserveAspectRatio="none"
              >
                <title>{`${h.hour} IST — Visits: ${h.visits}, Wishes: ${h.wishes}`}</title>
                <rect
                  x="0"
                  y={140 - barH}
                  width="10"
                  height={barH}
                  rx="2"
                  fill="#f5b83d"
                />
              </svg>
              <span className="text-[9px] text-slate-500">
                {h.hour.slice(0, 2)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="text-[11px] text-slate-400">
        24-hour distribution in India Standard Time (IST)
      </div>
    </div>
  );
};
