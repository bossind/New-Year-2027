import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { db } from './index.ts';
import {
  adminAuditLogs,
  adminSessions,
  adminUsers,
  authorizedTelegramUsers,
  telegramLoginChallenges,
} from './schema.ts';

const DEFAULT_ADMIN_USERNAME = 'Roynorules';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const CHALLENGE_DURATION_MS = 2 * 60 * 1000; // 2 minutes
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

// Deterministic fallback secret for preview if SESSION_SECRET is not set,
// ensuring encrypted database secrets and session hashes survive server restarts.
const RUNTIME_FALLBACK_SECRET = crypto
  .createHash('sha256')
  .update(
    `indian-new-year-2027-secret:${process.env.DATABASE_URL || process.env.APP_URL || 'default-preview-key'}`
  )
  .digest('hex');

export function getExpectedAdminUsername(): string {
  return (process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME).trim();
}

export function hashToken(raw: string): string {
  const secret = process.env.SESSION_SECRET || RUNTIME_FALLBACK_SECRET;
  return crypto.createHmac('sha256', secret).update(raw).digest('hex');
}

export function hashIp(ip: string | undefined): string {
  if (!ip) return 'unknown';
  return crypto
    .createHash('sha256')
    .update(ip + (process.env.SESSION_SECRET || 'ny2027-salt'))
    .digest('hex')
    .slice(0, 16);
}

function getEncryptionKeyBuffer(): Buffer {
  const rawKey =
    process.env.TELEGRAM_BOT_ENCRYPTION_KEY ||
    process.env.SESSION_SECRET ||
    RUNTIME_FALLBACK_SECRET;
  return crypto.createHash('sha256').update(rawKey).digest();
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKeyBuffer();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted secret format.');
  }
  const [ivHex, tagHex, dataHex] = parts;
  const key = getEncryptionKeyBuffer();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function maskBotToken(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length <= 12) return '••••••••••••';
  return `${trimmed.slice(0, 6)}••••••••••••••••${trimmed.slice(-4)}`;
}

export async function logAuditEvent(params: {
  action: string;
  actor: string;
  status: 'success' | 'failure' | 'warning';
  ipHash?: string;
  details?: string;
}) {
  try {
    await db.insert(adminAuditLogs).values({
      action: params.action,
      actor: params.actor,
      status: params.status,
      ipHash: params.ipHash || 'system',
      details: params.details || '',
    });
  } catch (error) {
    console.error('Failed to write admin audit log:', error);
  }
}

export async function getAdminAuthStatus() {
  try {
    const expectedUsername = getExpectedAdminUsername();
    const envHash = (process.env.ADMIN_PASSWORD_HASH || '').trim();
    const existingUsers = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, expectedUsername));

    const dbUser = existingUsers[0] || null;
    const isPasswordConfigured = Boolean(envHash || (dbUser && dbUser.passwordHash));

    const enrolledTg = await db
      .select()
      .from(authorizedTelegramUsers)
      .where(eq(authorizedTelegramUsers.isActive, true));

    return {
      username: expectedUsername,
      isPasswordConfigured,
      usingEnvHash: Boolean(envHash),
      hasAuthorizedTelegram: enrolledTg.length > 0,
      authorizedTelegramUsers: enrolledTg.map((u) => ({
        id: u.id,
        telegramUserId: u.telegramUserId,
        telegramUsername: u.telegramUsername,
        firstName: u.firstName,
        phoneVerified: u.phoneVerified,
        enrolledAt: u.enrolledAt,
      })),
    };
  } catch (error) {
    console.error('Database query failed in getAdminAuthStatus:', error);
    throw new Error('Failed to check admin authentication status.', {
      cause: error,
    });
  }
}

export async function claimInitialAdminPassword(
  usernameInput: string,
  newPassword: string,
  ipHash: string
) {
  try {
    const expectedUsername = getExpectedAdminUsername();
    if (usernameInput.trim() !== expectedUsername) {
      throw new Error(`Invalid admin username. Expected ${expectedUsername}.`);
    }
    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }

    const envHash = (process.env.ADMIN_PASSWORD_HASH || '').trim();
    if (envHash) {
      throw new Error(
        'Admin password is already locked via ADMIN_PASSWORD_HASH environment variable.'
      );
    }

    const existing = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, expectedUsername));

    if (existing.length > 0 && existing[0].passwordHash) {
      throw new Error('Initial admin password has already been claimed.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    const inserted = await db
      .insert(adminUsers)
      .values({
        username: expectedUsername,
        passwordHash,
        failedAttempts: 0,
      })
      .onConflictDoUpdate({
        target: adminUsers.username,
        set: {
          passwordHash,
          updatedAt: new Date(),
        },
      })
      .returning();

    await logAuditEvent({
      action: 'admin_password_claimed',
      actor: expectedUsername,
      status: 'success',
      ipHash,
      details: 'First-run admin password hash initialized with bcrypt (cost 12).',
    });

    return inserted[0];
  } catch (error) {
    console.error('Failed to claim initial admin password:', error);
    throw error;
  }
}

export async function ensureAdminUserRecord(): Promise<{
  id: number;
  username: string;
  passwordHash: string;
  failedAttempts: number;
  lockedUntil: Date | null;
}> {
  try {
    const expectedUsername = getExpectedAdminUsername();
    const envHash = (process.env.ADMIN_PASSWORD_HASH || '').trim();

    const rows = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, expectedUsername));

    if (rows.length > 0) {
      const record = rows[0];
      if (envHash && record.passwordHash !== envHash) {
        const updated = await db
          .update(adminUsers)
          .set({ passwordHash: envHash, updatedAt: new Date() })
          .where(eq(adminUsers.id, record.id))
          .returning();
        return updated[0];
      }
      return record;
    }

    if (envHash) {
      const inserted = await db
        .insert(adminUsers)
        .values({
          username: expectedUsername,
          passwordHash: envHash,
          failedAttempts: 0,
        })
        .returning();
      return inserted[0];
    }

    throw new Error('ADMIN_PASSWORD_NOT_CLAIMED');
  } catch (error) {
    console.error('Database query failed in ensureAdminUserRecord:', error);
    throw error;
  }
}

export async function verifyAdminCredentials(
  usernameInput: string,
  passwordInput: string,
  ipHash: string
): Promise<{
  ok: boolean;
  locked?: boolean;
  suspicious?: boolean;
  error?: string;
  adminUser?: { id: number; username: string };
}> {
  try {
    const expectedUsername = getExpectedAdminUsername();
    if (usernameInput.trim() !== expectedUsername) {
      await logAuditEvent({
        action: 'admin_login_attempt',
        actor: usernameInput.trim() || 'unknown',
        status: 'failure',
        ipHash,
        details: 'Rejected: username mismatch',
      });
      return { ok: false, error: 'Invalid administrator credentials.' };
    }

    let adminRecord;
    try {
      adminRecord = await ensureAdminUserRecord();
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'ADMIN_PASSWORD_NOT_CLAIMED') {
        return {
          ok: false,
          error:
            'Admin password is not configured yet. Complete first-run setup or set ADMIN_PASSWORD_HASH.',
        };
      }
      throw e;
    }

    const now = new Date();
    if (adminRecord.lockedUntil && adminRecord.lockedUntil > now) {
      const remainingMin = Math.ceil(
        (adminRecord.lockedUntil.getTime() - now.getTime()) / 60000
      );
      await logAuditEvent({
        action: 'admin_login_locked',
        actor: expectedUsername,
        status: 'warning',
        ipHash,
        details: `Blocked attempt while account locked (${remainingMin}m remaining)`,
      });
      return {
        ok: false,
        locked: true,
        suspicious: true,
        error: `Account temporarily locked due to failed attempts. Try again in ${remainingMin} minute(s).`,
      };
    }

    const envHash = (process.env.ADMIN_PASSWORD_HASH || '').trim();
    const activeHash = envHash || adminRecord.passwordHash;

    let passwordValid = false;
    if (activeHash.startsWith('$2a$') || activeHash.startsWith('$2b$') || activeHash.startsWith('$2y$')) {
      passwordValid = await bcrypt.compare(passwordInput, activeHash);
    } else {
      // If user configured a SHA-256 hex hash in env var, compare timing-safely
      const inputSha = crypto.createHash('sha256').update(passwordInput).digest('hex');
      if (activeHash.length === inputSha.length) {
        passwordValid = crypto.timingSafeEqual(
          Buffer.from(activeHash),
          Buffer.from(inputSha)
        );
      }
    }

    if (!passwordValid) {
      const newFailures = (adminRecord.failedAttempts || 0) + 1;
      const shouldLock = newFailures >= MAX_FAILED_ATTEMPTS;
      const lockedUntil = shouldLock
        ? new Date(Date.now() + LOCKOUT_DURATION_MS)
        : null;

      await db
        .update(adminUsers)
        .set({
          failedAttempts: newFailures,
          lockedUntil,
          updatedAt: new Date(),
        })
        .where(eq(adminUsers.id, adminRecord.id));

      await logAuditEvent({
        action: shouldLock ? 'admin_account_lockout' : 'admin_login_failed',
        actor: expectedUsername,
        status: shouldLock ? 'warning' : 'failure',
        ipHash,
        details: shouldLock
          ? `Account locked for 15 minutes after ${newFailures} failed attempts`
          : `Invalid password (attempt ${newFailures}/${MAX_FAILED_ATTEMPTS})`,
      });

      return {
        ok: false,
        locked: shouldLock,
        suspicious: newFailures >= 3,
        error: shouldLock
          ? 'Too many failed attempts. Account locked for 15 minutes.'
          : 'Invalid administrator credentials.',
      };
    }

    // Reset failed attempts on valid password
    await db
      .update(adminUsers)
      .set({
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, adminRecord.id));

    return {
      ok: true,
      adminUser: {
        id: adminRecord.id,
        username: adminRecord.username,
      },
    };
  } catch (error) {
    console.error('Database query failed in verifyAdminCredentials:', error);
    throw new Error('Authentication verification failed.', { cause: error });
  }
}

export async function createTelegramLoginChallenge(params: {
  adminUserId: number;
  ipHash: string;
  userAgent: string;
}) {
  try {
    const challengeId = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + CHALLENGE_DURATION_MS);

    const inserted = await db
      .insert(telegramLoginChallenges)
      .values({
        challengeId,
        adminUserId: params.adminUserId,
        status: 'pending',
        ipHash: params.ipHash,
        userAgent: params.userAgent.slice(0, 250),
        expiresAt,
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Database query failed in createTelegramLoginChallenge:', error);
    throw new Error('Failed to create login challenge.', { cause: error });
  }
}

export async function getChallengeById(challengeId: string) {
  try {
    const rows = await db
      .select()
      .from(telegramLoginChallenges)
      .where(eq(telegramLoginChallenges.challengeId, challengeId));
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed in getChallengeById:', error);
    throw new Error('Failed to load login challenge.', { cause: error });
  }
}

export async function resolveTelegramChallenge(params: {
  challengeId: string;
  telegramUserId: string;
  decision: 'approved' | 'rejected';
}) {
  try {
    // 1. Verify that telegramUserId is enrolled and active
    const authRows = await db
      .select()
      .from(authorizedTelegramUsers)
      .where(
        and(
          eq(authorizedTelegramUsers.telegramUserId, String(params.telegramUserId)),
          eq(authorizedTelegramUsers.isActive, true)
        )
      );

    if (authRows.length === 0) {
      await logAuditEvent({
        action: 'telegram_unauthorized_approval_attempt',
        actor: `tg:${params.telegramUserId}`,
        status: 'warning',
        details: `Unauthorized Telegram ID ${params.telegramUserId} attempted to ${params.decision} challenge ${params.challengeId.slice(0, 8)}`,
      });
      return {
        ok: false,
        error: 'Unauthorized Telegram user ID. Only the enrolled administrator can approve or reject login requests.',
      };
    }

    // 2. Load challenge
    const challenge = await getChallengeById(params.challengeId);
    if (!challenge) {
      return { ok: false, error: 'Login challenge not found.' };
    }

    if (challenge.status !== 'pending') {
      return {
        ok: false,
        error: `Challenge has already been ${challenge.status}.`,
      };
    }

    if (new Date() > challenge.expiresAt) {
      await db
        .update(telegramLoginChallenges)
        .set({ status: 'expired', resolvedAt: new Date() })
        .where(eq(telegramLoginChallenges.id, challenge.id));
      return { ok: false, error: 'Login challenge expired (2-minute limit).' };
    }

    const updated = await db
      .update(telegramLoginChallenges)
      .set({
        status: params.decision,
        approvedByTelegramId: String(params.telegramUserId),
        resolvedAt: new Date(),
      })
      .where(eq(telegramLoginChallenges.id, challenge.id))
      .returning();

    await logAuditEvent({
      action:
        params.decision === 'approved'
          ? 'telegram_login_approved'
          : 'telegram_login_rejected',
      actor: `tg:${params.telegramUserId}`,
      status: params.decision === 'approved' ? 'success' : 'warning',
      details: `Challenge ${params.challengeId.slice(0, 8)} ${params.decision} via Telegram`,
    });

    return { ok: true, challenge: updated[0] };
  } catch (error) {
    console.error('Database query failed in resolveTelegramChallenge:', error);
    throw new Error('Failed to process Telegram login decision.', {
      cause: error,
    });
  }
}

export async function enrollTelegramAdmin(params: {
  bootstrapSecretInput: string;
  telegramUserId: string;
  telegramUsername?: string;
  firstName?: string;
  ipHash: string;
}) {
  try {
    const cleanId = String(params.telegramUserId || '').trim();
    if (!/^\d{5,20}$/.test(cleanId)) {
      throw new Error(
        'Telegram User ID must be a valid numeric Telegram ID (5-20 digits).'
      );
    }

    const expectedSecret = (process.env.ADMIN_BOOTSTRAP_SECRET || '').trim();
    const existingEnrolled = await db
      .select()
      .from(authorizedTelegramUsers)
      .where(eq(authorizedTelegramUsers.isActive, true));

    if (expectedSecret) {
      const provided = params.bootstrapSecretInput.trim();
      if (!provided || provided !== expectedSecret) {
        await logAuditEvent({
          action: 'telegram_admin_enrollment_failed',
          actor: `tg:${cleanId}`,
          status: 'failure',
          ipHash: params.ipHash,
          details: 'Invalid ADMIN_BOOTSTRAP_SECRET during Telegram enrollment',
        });
        throw new Error('Invalid ADMIN_BOOTSTRAP_SECRET.');
      }
    } else if (existingEnrolled.length > 0) {
      throw new Error(
        'An authorized Telegram administrator is already enrolled. Set ADMIN_BOOTSTRAP_SECRET in Render Environment Variables to enroll or replace an ID.'
      );
    }

    const inserted = await db
      .insert(authorizedTelegramUsers)
      .values({
        telegramUserId: cleanId,
        telegramUsername: params.telegramUsername || null,
        firstName: params.firstName || 'Admin',
        isActive: true,
      })
      .onConflictDoUpdate({
        target: authorizedTelegramUsers.telegramUserId,
        set: {
          telegramUsername: params.telegramUsername || null,
          firstName: params.firstName || 'Admin',
          isActive: true,
        },
      })
      .returning();

    await logAuditEvent({
      action: 'telegram_admin_enrolled',
      actor: `tg:${cleanId}`,
      status: 'success',
      ipHash: params.ipHash,
      details: `Enrolled authorized Telegram numeric user ID ${cleanId}`,
    });

    return inserted[0];
  } catch (error) {
    console.error('Failed to enroll Telegram admin:', error);
    throw error;
  }
}

export async function consumeApprovedChallengeAndCreateSession(params: {
  challengeId: string;
  ipHash: string;
  userAgent: string;
}) {
  try {
    const challenge = await getChallengeById(params.challengeId);
    if (!challenge) {
      throw new Error('Challenge not found.');
    }

    if (new Date() > challenge.expiresAt) {
      if (challenge.status === 'pending') {
        await db
          .update(telegramLoginChallenges)
          .set({ status: 'expired', resolvedAt: new Date() })
          .where(eq(telegramLoginChallenges.id, challenge.id));
      }
      throw new Error('Challenge expired.');
    }

    if (challenge.status !== 'approved') {
      throw new Error(`Challenge cannot be consumed (status: ${challenge.status}).`);
    }

    if (challenge.consumedAt) {
      throw new Error('Challenge has already been used.');
    }

    // Mark challenge as consumed (single-use enforcement)
    await db
      .update(telegramLoginChallenges)
      .set({
        status: 'consumed',
        consumedAt: new Date(),
      })
      .where(eq(telegramLoginChallenges.id, challenge.id));

    // Create admin session
    const rawSessionToken = crypto.randomBytes(32).toString('hex');
    const sessionTokenHash = hashToken(rawSessionToken);
    const csrfToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await db.insert(adminSessions).values({
      sessionTokenHash,
      adminUserId: challenge.adminUserId,
      csrfToken,
      ipHash: params.ipHash,
      userAgent: params.userAgent.slice(0, 250),
      expiresAt,
    });

    await db
      .update(adminUsers)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(adminUsers.id, challenge.adminUserId));

    await logAuditEvent({
      action: 'admin_session_created',
      actor: getExpectedAdminUsername(),
      status: 'success',
      ipHash: params.ipHash,
      details: `Session established after Telegram approval by ID ${challenge.approvedByTelegramId}`,
    });

    return {
      rawSessionToken,
      csrfToken,
      expiresAt,
    };
  } catch (error) {
    console.error('Failed in consumeApprovedChallengeAndCreateSession:', error);
    throw error;
  }
}

export async function verifyAdminSessionToken(rawToken: string) {
  try {
    if (!rawToken) return null;
    const tokenHash = hashToken(rawToken);
    const now = new Date();

    const rows = await db
      .select({
        sessionId: adminSessions.id,
        adminUserId: adminSessions.adminUserId,
        csrfToken: adminSessions.csrfToken,
        expiresAt: adminSessions.expiresAt,
        revokedAt: adminSessions.revokedAt,
        username: adminUsers.username,
      })
      .from(adminSessions)
      .innerJoin(adminUsers, eq(adminSessions.adminUserId, adminUsers.id))
      .where(
        and(
          eq(adminSessions.sessionTokenHash, tokenHash),
          isNull(adminSessions.revokedAt),
          gt(adminSessions.expiresAt, now)
        )
      );

    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed in verifyAdminSessionToken:', error);
    return null;
  }
}

export async function revokeAdminSessionToken(rawToken: string, ipHash: string) {
  try {
    if (!rawToken) return;
    const tokenHash = hashToken(rawToken);
    await db
      .update(adminSessions)
      .set({ revokedAt: new Date() })
      .where(eq(adminSessions.sessionTokenHash, tokenHash));

    await logAuditEvent({
      action: 'admin_logout',
      actor: getExpectedAdminUsername(),
      status: 'success',
      ipHash,
      details: 'Administrator session revoked via logout',
    });
  } catch (error) {
    console.error('Database query failed in revokeAdminSessionToken:', error);
    throw new Error('Failed to revoke session.', { cause: error });
  }
}

export async function changeAdminPassword(params: {
  adminUserId: number;
  currentPassword: string;
  newPassword: string;
  ipHash: string;
}) {
  try {
    if (params.newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long.');
    }
    if (process.env.ADMIN_PASSWORD_HASH) {
      throw new Error(
        'ADMIN_PASSWORD_HASH is set in Render Environment Variables. To change it, update ADMIN_PASSWORD_HASH in your Render dashboard.'
      );
    }

    const userRows = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, params.adminUserId));
    const user = userRows[0];
    if (!user) {
      throw new Error('Admin user not found.');
    }

    const valid = await bcrypt.compare(params.currentPassword, user.passwordHash);
    if (!valid) {
      await logAuditEvent({
        action: 'admin_password_change_failed',
        actor: user.username,
        status: 'failure',
        ipHash: params.ipHash,
        details: 'Current password verification failed',
      });
      throw new Error('Current password is incorrect.');
    }

    const newHash = await bcrypt.hash(params.newPassword, 12);
    await db
      .update(adminUsers)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(adminUsers.id, user.id));

    await logAuditEvent({
      action: 'admin_password_changed',
      actor: user.username,
      status: 'success',
      ipHash: params.ipHash,
      details: 'Administrator password hash updated with bcrypt (cost 12)',
    });
  } catch (error) {
    console.error('Failed in changeAdminPassword:', error);
    throw error;
  }
}

export async function getSecurityAuditLogs(limit = 60) {
  try {
    return await db
      .select()
      .from(adminAuditLogs)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(limit);
  } catch (error) {
    console.error('Database query failed in getSecurityAuditLogs:', error);
    throw new Error('Failed to load security audit logs.', { cause: error });
  }
}
