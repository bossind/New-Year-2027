import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { verifyAdminSessionToken } from '../db/security.ts';
import { getOrCreateUser } from '../db/users.ts';

export const ADMIN_COOKIE_NAME = 'ny2027_admin_sid';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  adminSession?: {
    sessionId: number;
    adminUserId: number;
    csrfToken: string;
    username: string;
    rawToken: string;
  };
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      try {
        out[k] = decodeURIComponent(v);
      } catch {
        out[k] = v;
      }
    }
  }
  return out;
}

export function extractAdminTokenFromRequest(req: Request): {
  token: string;
  source: 'bearer' | 'cookie' | 'none';
} {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return { token, source: 'bearer' };
  }
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[ADMIN_COOKIE_NAME]) {
    return { token: cookies[ADMIN_COOKIE_NAME], source: 'cookie' };
  }
  return { token: '', source: 'none' };
}

/**
 * Firebase Auth middleware for standard user routes
 */
export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    if (decodedToken.uid && decodedToken.email) {
      await getOrCreateUser(decodedToken.uid, decodedToken.email);
    }
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

/**
 * Mandatory Admin Session + CSRF Protection Middleware for all /api/admin/* endpoints
 */
export const requireAdminAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token, source } = extractAdminTokenFromRequest(req);
    if (!token) {
      return res
        .status(401)
        .json({ error: 'Unauthorized: Administrator login required.' });
    }

    const session = await verifyAdminSessionToken(token);
    if (!session) {
      return res
        .status(401)
        .json({ error: 'Unauthorized: Session expired or invalid.' });
    }

    // Enforce CSRF and Origin/Header check on state-changing requests
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
      req.method.toUpperCase()
    );
    if (isMutation) {
      const csrfHeader = req.headers['x-csrf-token'];
      const requestedWith = req.headers['x-requested-with'];

      if (!csrfHeader || csrfHeader !== session.csrfToken) {
        return res
          .status(403)
          .json({ error: 'Forbidden: Invalid or missing CSRF token.' });
      }

      if (source === 'cookie' && !requestedWith) {
        const origin = req.headers.origin;
        const host =
          (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
        if (origin) {
          try {
            const originHost = new URL(origin).host;
            if (host && originHost !== host) {
              return res
                .status(403)
                .json({ error: 'Forbidden: Cross-origin request blocked.' });
            }
          } catch {
            return res.status(403).json({ error: 'Forbidden: Invalid Origin.' });
          }
        }
      }
    }

    req.adminSession = {
      sessionId: session.sessionId,
      adminUserId: session.adminUserId,
      csrfToken: session.csrfToken,
      username: session.username,
      rawToken: token,
    };
    next();
  } catch (error) {
    console.error('Admin auth verification error:', error);
    return res.status(500).json({ error: 'Internal authentication error.' });
  }
};
