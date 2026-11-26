/**
 * Centralized API Client & Safe JSON Response Parser
 *
 * Ensures:
 * 1. All API requests resolve against the configured Render Backend URL
 *    (`VITE_API_BASE_URL` / `VITE_BACKEND_URL` / `VITE_RENDER_BACKEND_URL`) or
 *    same-origin `/api/*` when running on the unified full-stack server.
 * 2. Every response's HTTP status code and `Content-Type` header are inspected
 *    BEFORE attempting `JSON.parse`, completely preventing
 *    `Unexpected token '<', "<!doctype "... is not valid JSON` crashes when an
 *    HTML page (SPA fallback, Render 502/503 gateway page, or proxy HTML error)
 *    is returned instead of JSON.
 */

function getConfiguredApiBaseUrl(): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> })
      .env;
    if (!env) return '';
    const raw =
      env.VITE_API_BASE_URL ||
      env.VITE_BACKEND_URL ||
      env.VITE_RENDER_BACKEND_URL ||
      '';
    return String(raw).trim().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export const API_BASE_URL = getConfiguredApiBaseUrl();

export function resolveApiUrl(path: string): string {
  if (!path) return API_BASE_URL || '/';
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE_URL) return normalizedPath;

  // Avoid double `/api/api/...` if VITE_API_BASE_URL already ends with `/api`
  if (API_BASE_URL.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return `${API_BASE_URL}${normalizedPath.slice(4)}`;
  }
  return `${API_BASE_URL}${normalizedPath}`;
}

export interface SafeJsonResult<T = Record<string, any>> {
  ok: boolean;
  status: number;
  contentType: string;
  isJson: boolean;
  data: T;
  errorMessage?: string;
}

/**
 * Safely reads a Fetch `Response`, inspects `status` and `Content-Type`,
 * and parses JSON without throwing `SyntaxError: Unexpected token '<'`.
 */
export async function parseSafeJsonResponse<T = Record<string, any>>(
  res: Response
): Promise<SafeJsonResult<T>> {
  const status = res.status;
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  let rawText = '';

  try {
    rawText = await res.text();
  } catch {
    return {
      ok: false,
      status,
      contentType,
      isJson: false,
      data: {} as T,
      errorMessage: `Network error reading response from server (HTTP ${status}).`,
    };
  }

  const trimmed = rawText.trim();

  // Detect HTML responses (`<!doctype html>`, `<html>`, etc.)
  const looksLikeHtml =
    contentType.includes('text/html') ||
    trimmed.toLowerCase().startsWith('<!doctype') ||
    trimmed.toLowerCase().startsWith('<html');

  if (looksLikeHtml) {
    let reason = `The server returned an HTML page instead of JSON (HTTP ${status}).`;
    if (status === 200 || status === 404) {
      reason =
        'The Admin API request reached a static HTML fallback instead of the Node/Express backend. If hosting frontend and backend separately, set VITE_API_BASE_URL to your Render backend service URL; if hosting on Render as a Web Service, ensure startCommand runs "npx tsx server.ts".';
    } else if (status === 502 || status === 503 || status === 504) {
      reason = `The Render backend server is currently waking up or temporarily unavailable (HTTP ${status}). Please wait a few seconds and try again.`;
    }
    return {
      ok: false,
      status,
      contentType,
      isJson: false,
      data: {} as T,
      errorMessage: reason,
    };
  }

  if (!trimmed) {
    return {
      ok: res.ok,
      status,
      contentType,
      isJson: false,
      data: {} as T,
      errorMessage: res.ok
        ? undefined
        : `Server returned an empty error response (HTTP ${status}).`,
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as T;
    const errField =
      parsed && typeof parsed === 'object' && 'error' in parsed
        ? String((parsed as Record<string, unknown>).error || '')
        : '';
    return {
      ok: res.ok,
      status,
      contentType,
      isJson: true,
      data: parsed,
      errorMessage: !res.ok
        ? errField || `Request failed with HTTP ${status}.`
        : undefined,
    };
  } catch {
    return {
      ok: false,
      status,
      contentType,
      isJson: false,
      data: {} as T,
      errorMessage: `Server returned a non-JSON response (HTTP ${status}, Content-Type: ${
        contentType || 'unknown'
      }).`,
    };
  }
}
