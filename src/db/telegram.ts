import crypto from 'crypto';
import { desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  authorizedTelegramUsers,
  notificationLogs,
  notificationSettings,
  telegramBotConfig,
  telegramLoginChallenges,
} from './schema.ts';
import {
  decryptSecret,
  encryptSecret,
  hashToken,
  logAuditEvent,
  maskBotToken,
  resolveTelegramChallenge,
} from './security.ts';
import {
  DateFilterPreset,
  getDashboardAnalytics,
  getISTDateParts,
} from './analytics.ts';

export interface NotificationDefinition {
  eventKey: string;
  label: string;
  category: 'traffic' | 'reports' | 'security' | 'system';
  defaultEnabled: boolean;
  cooldownSeconds: number;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationDefinition[] = [
  {
    eventKey: 'new_visitor',
    label: '1. New Website Visitor (Aggregated)',
    category: 'traffic',
    defaultEnabled: true,
    cooldownSeconds: 300, // 5-min aggregation window to prevent page-refresh spam
  },
  {
    eventKey: 'new_wish',
    label: '2. New Wish Created',
    category: 'traffic',
    defaultEnabled: true,
    cooldownSeconds: 15,
  },
  {
    eventKey: 'share_clicked',
    label: '3. Share Button Clicked (Aggregated)',
    category: 'traffic',
    defaultEnabled: true,
    cooldownSeconds: 120,
  },
  {
    eventKey: 'daily_report',
    label: '4. Daily Website Report',
    category: 'reports',
    defaultEnabled: true,
    cooldownSeconds: 60,
  },
  {
    eventKey: 'weekly_report',
    label: '5. Weekly Website Report',
    category: 'reports',
    defaultEnabled: true,
    cooldownSeconds: 60,
  },
  {
    eventKey: 'monthly_report',
    label: '6. Monthly Website Report',
    category: 'reports',
    defaultEnabled: true,
    cooldownSeconds: 60,
  },
  {
    eventKey: 'admin_login_success',
    label: '7. Admin Login Successful',
    category: 'security',
    defaultEnabled: true,
    cooldownSeconds: 0,
  },
  {
    eventKey: 'admin_login_failed',
    label: '8. Admin Login Failed',
    category: 'security',
    defaultEnabled: true,
    cooldownSeconds: 0,
  },
  {
    eventKey: 'telegram_login_requested',
    label: '9. Telegram Login Approval Requested',
    category: 'security',
    defaultEnabled: true,
    cooldownSeconds: 0,
  },
  {
    eventKey: 'telegram_login_rejected',
    label: '10. Telegram Login Rejected',
    category: 'security',
    defaultEnabled: true,
    cooldownSeconds: 0,
  },
  {
    eventKey: 'suspicious_login',
    label: '11. Suspicious Login Attempt',
    category: 'security',
    defaultEnabled: true,
    cooldownSeconds: 0,
  },
  {
    eventKey: 'bot_connected',
    label: '12. Bot Connection Successful',
    category: 'system',
    defaultEnabled: true,
    cooldownSeconds: 0,
  },
  {
    eventKey: 'bot_connection_failed',
    label: '13. Bot Connection Failed',
    category: 'system',
    defaultEnabled: true,
    cooldownSeconds: 0,
  },
  {
    eventKey: 'backend_error',
    label: '14. Backend Server Error',
    category: 'system',
    defaultEnabled: true,
    cooldownSeconds: 60,
  },
  {
    eventKey: 'database_error',
    label: '15. Database Connection Error',
    category: 'system',
    defaultEnabled: true,
    cooldownSeconds: 60,
  },
];

// In-memory aggregation counters for high-volume events during cooldown windows
const pendingAggregations: Record<string, number> = {
  new_visitor: 0,
  share_clicked: 0,
};

let activeWebhookSecretPlaintext =
  process.env.TELEGRAM_WEBHOOK_SECRET || '';
let lastUpdateOffset = 0;

export async function ensureNotificationSettingsSeeded() {
  try {
    const existing = await db.select().from(notificationSettings);
    const existingKeys = new Set(existing.map((r) => r.eventKey));

    for (const def of DEFAULT_NOTIFICATION_SETTINGS) {
      if (!existingKeys.has(def.eventKey)) {
        await db
          .insert(notificationSettings)
          .values({
            eventKey: def.eventKey,
            label: def.label,
            category: def.category,
            enabled: def.defaultEnabled,
            cooldownSeconds: def.cooldownSeconds,
          })
          .onConflictDoNothing();
      }
    }
  } catch (error) {
    console.error('Database query failed in ensureNotificationSettingsSeeded:', error);
  }
}

export async function getAllNotificationSettings() {
  try {
    await ensureNotificationSettingsSeeded();
    return await db
      .select()
      .from(notificationSettings)
      .orderBy(notificationSettings.id);
  } catch (error) {
    console.error('Database query failed in getAllNotificationSettings:', error);
    throw new Error('Failed to load notification settings.', { cause: error });
  }
}

export async function updateNotificationSetting(
  eventKey: string,
  enabled: boolean,
  cooldownSeconds?: number
) {
  try {
    const updatePayload: {
      enabled: boolean;
      updatedAt: Date;
      cooldownSeconds?: number;
    } = {
      enabled,
      updatedAt: new Date(),
    };
    if (typeof cooldownSeconds === 'number' && cooldownSeconds >= 0) {
      updatePayload.cooldownSeconds = cooldownSeconds;
    }

    const updated = await db
      .update(notificationSettings)
      .set(updatePayload)
      .where(eq(notificationSettings.eventKey, eventKey))
      .returning();

    return updated[0] || null;
  } catch (error) {
    console.error('Database query failed in updateNotificationSetting:', error);
    throw new Error('Failed to update notification setting.', { cause: error });
  }
}

export async function getNotificationHistory(limit = 50) {
  try {
    return await db
      .select()
      .from(notificationLogs)
      .orderBy(desc(notificationLogs.createdAt))
      .limit(limit);
  } catch (error) {
    console.error('Database query failed in getNotificationHistory:', error);
    throw new Error('Failed to load notification history.', { cause: error });
  }
}

async function getActiveBotToken(): Promise<string | null> {
  try {
    const rows = await db.select().from(telegramBotConfig).limit(1);
    if (rows.length > 0 && rows[0].encryptedToken) {
      try {
        return decryptSecret(rows[0].encryptedToken);
      } catch {
        // The stored token was encrypted with an older ephemeral key before restart.
        // Clear the stale ciphertext and record a clean status note so the error does not repeat.
        await db
          .update(telegramBotConfig)
          .set({
            encryptedToken: '',
            webhookConnected: false,
            lastError:
              'Encryption key changed across server restart. Please re-save your Telegram Bot Token.',
            updatedAt: new Date(),
          })
          .where(eq(telegramBotConfig.id, rows[0].id));
      }
    }
    if (process.env.TELEGRAM_BOT_TOKEN) {
      return process.env.TELEGRAM_BOT_TOKEN.trim();
    }
    return null;
  } catch (error) {
    console.warn('Unable to read Telegram bot token configuration:', error);
    return null;
  }
}

export async function getTelegramBotStatus() {
  try {
    const rows = await db.select().from(telegramBotConfig).limit(1);
    const enrolledAdmins = await db
      .select()
      .from(authorizedTelegramUsers)
      .where(eq(authorizedTelegramUsers.isActive, true));

    const envTokenPresent = Boolean(
      process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN.trim()
    );
    const encryptionKeyConfigured = Boolean(
      process.env.TELEGRAM_BOT_ENCRYPTION_KEY &&
        process.env.TELEGRAM_BOT_ENCRYPTION_KEY.trim()
    );

    if (rows.length === 0) {
      return {
        configured: envTokenPresent,
        source: envTokenPresent ? 'environment' : 'none',
        maskedToken: envTokenPresent
          ? maskBotToken(process.env.TELEGRAM_BOT_TOKEN || '')
          : null,
        botUsername: null,
        botFirstName: null,
        botTelegramId: null,
        webhookConnected: false,
        webhookUrl: null,
        lastConnectedAt: null,
        lastError: null,
        encryptionKeyConfigured,
        enrolledAdmins: enrolledAdmins.map((a) => ({
          id: a.id,
          telegramUserId: a.telegramUserId,
          telegramUsername: a.telegramUsername,
          firstName: a.firstName,
          phoneVerified: a.phoneVerified,
          enrolledAt: a.enrolledAt,
        })),
      };
    }

    const cfg = rows[0];
    const hasValidDbToken = Boolean(cfg.encryptedToken && cfg.encryptedToken.trim());
    return {
      configured: hasValidDbToken || envTokenPresent,
      source: hasValidDbToken
        ? 'database_encrypted'
        : envTokenPresent
        ? 'environment'
        : 'none',
      maskedToken: hasValidDbToken
        ? cfg.maskedToken
        : envTokenPresent
        ? maskBotToken(process.env.TELEGRAM_BOT_TOKEN || '')
        : null,
      botUsername: cfg.botUsername,
      botFirstName: cfg.botFirstName,
      botTelegramId: cfg.botTelegramId,
      webhookConnected: hasValidDbToken ? cfg.webhookConnected : false,
      webhookUrl: cfg.webhookUrl,
      lastConnectedAt: cfg.lastConnectedAt,
      lastError: cfg.lastError,
      encryptionKeyConfigured,
      enrolledAdmins: enrolledAdmins.map((a) => ({
        id: a.id,
        telegramUserId: a.telegramUserId,
        telegramUsername: a.telegramUsername,
        firstName: a.firstName,
        phoneVerified: a.phoneVerified,
        enrolledAt: a.enrolledAt,
      })),
    };
  } catch (error) {
    console.error('Database query failed in getTelegramBotStatus:', error);
    throw new Error('Failed to load Telegram bot configuration.', {
      cause: error,
    });
  }
}

async function callTelegramApi<T = unknown>(
  botToken: string,
  method: string,
  body?: Record<string, unknown>
): Promise<{ ok: boolean; result?: T; description?: string }> {
  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const data = (await response.json()) as {
      ok: boolean;
      result?: T;
      description?: string;
    };
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function saveTelegramBotToken(rawToken: string, ipHash: string) {
  const trimmed = rawToken.trim();
  if (!/^\d{6,15}:[A-Za-z0-9_-]{25,}$/.test(trimmed)) {
    throw new Error('Invalid Telegram Bot Token format.');
  }

  // 1. Validate with Telegram getMe API
  let meResult: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  };
  try {
    const res = await callTelegramApi<{
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    }>(trimmed, 'getMe');

    if (!res.ok || !res.result) {
      throw new Error(res.description || 'Telegram getMe rejected the token.');
    }
    meResult = res.result;
  } catch (error: unknown) {
    const errMsg =
      error instanceof Error ? error.message : 'Unable to reach Telegram API';
    await logAuditEvent({
      action: 'telegram_bot_token_save_failed',
      actor: 'admin',
      status: 'failure',
      ipHash,
      details: `Bot validation failed: ${errMsg}`,
    });
    throw new Error(`Telegram getMe validation failed: ${errMsg}`);
  }

  // 2. Encrypt token before storing in PostgreSQL
  const encryptedToken = encryptSecret(trimmed);
  const masked = maskBotToken(trimmed);

  try {
    const existing = await db.select().from(telegramBotConfig).limit(1);
    if (existing.length === 0) {
      await db.insert(telegramBotConfig).values({
        encryptedToken,
        maskedToken: masked,
        botUsername: meResult.username || null,
        botFirstName: meResult.first_name || 'Bot',
        botTelegramId: String(meResult.id),
        webhookConnected: false,
        lastConnectedAt: new Date(),
        lastError: null,
      });
    } else {
      await db
        .update(telegramBotConfig)
        .set({
          encryptedToken,
          maskedToken: masked,
          botUsername: meResult.username || null,
          botFirstName: meResult.first_name || 'Bot',
          botTelegramId: String(meResult.id),
          lastConnectedAt: new Date(),
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(telegramBotConfig.id, existing[0].id));
    }

    await logAuditEvent({
      action: 'telegram_bot_token_saved',
      actor: 'admin',
      status: 'success',
      ipHash,
      details: `Validated and encrypted bot @${meResult.username || meResult.id}`,
    });

    return {
      maskedToken: masked,
      botUsername: meResult.username || null,
      botFirstName: meResult.first_name,
      botTelegramId: String(meResult.id),
    };
  } catch (error) {
    console.error('Database query failed in saveTelegramBotToken:', error);
    throw new Error('Failed to store encrypted bot configuration.', {
      cause: error,
    });
  }
}

export async function connectTelegramBotWebhook(
  publicBaseUrl: string,
  ipHash: string
) {
  const token = await getActiveBotToken();
  if (!token) {
    throw new Error('No Telegram Bot Token saved. Please save your token first.');
  }

  // 1. Verify bot is reachable via getMe
  const getMeRes = await callTelegramApi<{
    id: number;
    first_name: string;
    username?: string;
  }>(token, 'getMe');

  if (!getMeRes.ok || !getMeRes.result) {
    const errText = getMeRes.description || 'Bot unreachable';
    await recordBotConnectionError(errText);
    throw new Error(`Bot connection failed: ${errText}`);
  }

  // 2. Generate or use webhook secret
  const webhookSecret =
    process.env.TELEGRAM_WEBHOOK_SECRET ||
    crypto.randomBytes(24).toString('hex');
  activeWebhookSecretPlaintext = webhookSecret;
  const webhookSecretHash = hashToken(webhookSecret);

  const cleanOrigin = publicBaseUrl.replace(/\/+$/, '');
  const webhookUrl = `${cleanOrigin}/api/telegram/webhook`;

  // 3. Configure Telegram webhook if public HTTPS origin is available
  let webhookSet = false;
  let statusNote = '';
  if (cleanOrigin.startsWith('https://')) {
    const setRes = await callTelegramApi(token, 'setWebhook', {
      url: webhookUrl,
      secret_token: webhookSecret,
      allowed_updates: ['message', 'callback_query'],
    });
    if (setRes.ok) {
      webhookSet = true;
    } else {
      statusNote = setRes.description || 'Webhook registration warning';
    }
  } else {
    statusNote = 'Connected in polling + API mode (HTTPS origin required for webhook)';
  }

  const existing = await db.select().from(telegramBotConfig).limit(1);
  if (existing.length > 0) {
    await db
      .update(telegramBotConfig)
      .set({
        botUsername: getMeRes.result.username || existing[0].botUsername,
        botFirstName: getMeRes.result.first_name || existing[0].botFirstName,
        botTelegramId: String(getMeRes.result.id),
        webhookSecretHash,
        webhookConnected: true,
        webhookUrl: webhookSet ? webhookUrl : 'Active (Direct API + Polling)',
        lastConnectedAt: new Date(),
        lastError: statusNote || null,
        updatedAt: new Date(),
      })
      .where(eq(telegramBotConfig.id, existing[0].id));
  }

  await logAuditEvent({
    action: 'telegram_bot_connected',
    actor: 'admin',
    status: 'success',
    ipHash,
    details: `Connected bot @${getMeRes.result.username || getMeRes.result.id}`,
  });

  // Trigger notification #12: Bot Connection Successful
  queueTelegramNotification({
    eventKey: 'bot_connected',
    title: 'Bot Connection Successful',
    text: `✅ *INDIAN NEW YEAR 2027 — BOT CONNECTED*\n\nBot: @${getMeRes.result.username || getMeRes.result.first_name}\nStatus: Active & Verified\nTimestamp: ${new Date().toISOString()}`,
    bypassCooldown: true,
  });

  return {
    connected: true,
    botUsername: getMeRes.result.username,
    botFirstName: getMeRes.result.first_name,
    webhookUrl: webhookSet ? webhookUrl : 'Active (Direct API + Polling)',
  };
}

async function recordBotConnectionError(errMsg: string) {
  try {
    const existing = await db.select().from(telegramBotConfig).limit(1);
    if (existing.length > 0) {
      await db
        .update(telegramBotConfig)
        .set({
          webhookConnected: false,
          lastError: errMsg,
          updatedAt: new Date(),
        })
        .where(eq(telegramBotConfig.id, existing[0].id));
    }
    await db.insert(notificationLogs).values({
      eventKey: 'bot_connection_failed',
      title: 'Bot Connection Failed',
      messagePreview: errMsg.slice(0, 180),
      status: 'failed',
      retryCount: 0,
      errorDetails: errMsg,
    });
  } catch (e) {
    console.error('Failed to record bot connection error:', e);
  }
}

export async function disconnectTelegramBot(ipHash: string) {
  try {
    const token = await getActiveBotToken();
    if (token) {
      try {
        await callTelegramApi(token, 'deleteWebhook');
      } catch {
        // ignore network failure during disconnect
      }
    }
    await db.delete(telegramBotConfig);

    await logAuditEvent({
      action: 'telegram_bot_disconnected',
      actor: 'admin',
      status: 'warning',
      ipHash,
      details: 'Telegram bot disconnected and encrypted token removed',
    });
    return { disconnected: true };
  } catch (error) {
    console.error('Database query failed in disconnectTelegramBot:', error);
    throw new Error('Failed to disconnect Telegram bot.', { cause: error });
  }
}

export async function testTelegramConnection() {
  const token = await getActiveBotToken();
  if (!token) {
    throw new Error('Telegram Bot Token is not configured.');
  }

  const getMeRes = await callTelegramApi<{
    id: number;
    first_name: string;
    username?: string;
  }>(token, 'getMe');

  if (!getMeRes.ok || !getMeRes.result) {
    const errMsg = getMeRes.description || 'Telegram API unreachable';
    await recordBotConnectionError(errMsg);
    throw new Error(errMsg);
  }

  const admins = await db
    .select()
    .from(authorizedTelegramUsers)
    .where(eq(authorizedTelegramUsers.isActive, true));

  let deliveredCount = 0;
  for (const admin of admins) {
    const sendRes = await callTelegramApi(token, 'sendMessage', {
      chat_id: admin.telegramUserId,
      text: `🎆 *INDIAN NEW YEAR 2027 — TEST CONNECTION*\n\n✅ Your Telegram Bot (@${getMeRes.result.username || getMeRes.result.first_name}) is connected and delivering real-time security & analytics alerts to authorized admin ID \`${admin.telegramUserId}\`.`,
      parse_mode: 'Markdown',
    });
    if (sendRes.ok) deliveredCount += 1;
  }

  await db.insert(notificationLogs).values({
    eventKey: 'bot_connected',
    title: 'Test Bot Connection',
    messagePreview: `Bot @${getMeRes.result.username} reachable. Delivered to ${deliveredCount}/${admins.length} enrolled admin(s).`,
    status: 'sent',
    retryCount: 0,
  });

  return {
    ok: true,
    botUsername: getMeRes.result.username,
    botFirstName: getMeRes.result.first_name,
    enrolledAdminsCount: admins.length,
    deliveredCount,
  };
}

/**
 * Send Telegram Login Approval Request with inline APPROVE LOGIN / REJECT LOGIN buttons
 */
export async function sendTelegramLoginChallengeMessage(params: {
  challengeId: string;
  username: string;
  ipHash: string;
  userAgent: string;
  expiresAt: Date;
}): Promise<{ sent: boolean; reason?: string }> {
  const token = await getActiveBotToken();
  if (!token) {
    return {
      sent: false,
      reason:
        'Telegram Bot Token is not configured yet. Configure TELEGRAM_BOT_TOKEN in Environment Variables or Telegram Settings.',
    };
  }

  const admins = await db
    .select()
    .from(authorizedTelegramUsers)
    .where(eq(authorizedTelegramUsers.isActive, true));

  if (admins.length === 0) {
    return {
      sent: false,
      reason:
        'No authorized Telegram Admin numeric user ID is enrolled yet. Complete one-time Telegram Admin Enrollment first.',
    };
  }

  const text = [
    '🔐 *INDIAN NEW YEAR 2027 — ADMIN LOGIN REQUEST*',
    '',
    `👤 *Username:* \`${params.username}\``,
    `🌐 *IP Fingerprint:* \`${params.ipHash}\``,
    `🖥 *Device:* \`${params.userAgent.slice(0, 80)}\``,
    `⏳ *Expires:* 2 minutes`,
    `🆔 *Challenge:* \`${params.challengeId.slice(0, 10)}\``,
    '',
    'Tap a button below to approve or reject this administrator login:',
  ].join('\n');

  let sentAny = false;
  for (const admin of admins) {
    try {
      const res = await callTelegramApi<{ message_id: number }>(
        token,
        'sendMessage',
        {
          chat_id: admin.telegramUserId,
          text,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '✅ APPROVE LOGIN',
                  callback_data: `approve:${params.challengeId}`,
                },
                {
                  text: '❌ REJECT LOGIN',
                  callback_data: `reject:${params.challengeId}`,
                },
              ],
            ],
          },
        }
      );

      if (res.ok && res.result) {
        sentAny = true;
        await db
          .update(telegramLoginChallenges)
          .set({ telegramMessageId: String(res.result.message_id) })
          .where(eq(telegramLoginChallenges.challengeId, params.challengeId));
      }
    } catch (e) {
      console.error('Failed to send Telegram login challenge:', e);
    }
  }

  await db.insert(notificationLogs).values({
    eventKey: 'telegram_login_requested',
    title: 'Telegram Login Approval Requested',
    messagePreview: `Login challenge ${params.challengeId.slice(0, 8)} sent to enrolled admin`,
    status: sentAny ? 'sent' : 'failed',
    retryCount: 0,
    errorDetails: sentAny
      ? null
      : 'Telegram sendMessage failed. Ensure the admin has started a chat with the bot (/start).',
  });

  if (!sentAny) {
    return {
      sent: false,
      reason:
        'Could not deliver Telegram message to enrolled ID. Open your bot in Telegram and press Start (/start), then retry.',
    };
  }

  return { sent: true };
}

/**
 * Verify incoming webhook secret header
 */
export async function verifyTelegramWebhookSecretHeader(
  headerSecret: string | undefined
): Promise<boolean> {
  if (!headerSecret) return false;
  if (
    activeWebhookSecretPlaintext &&
    headerSecret === activeWebhookSecretPlaintext
  ) {
    return true;
  }
  if (
    process.env.TELEGRAM_WEBHOOK_SECRET &&
    headerSecret === process.env.TELEGRAM_WEBHOOK_SECRET
  ) {
    return true;
  }
  const rows = await db.select().from(telegramBotConfig).limit(1);
  if (rows.length > 0 && rows[0].webhookSecretHash) {
    return hashToken(headerSecret) === rows[0].webhookSecretHash;
  }
  return false;
}

/**
 * Process incoming Telegram update (from Webhook or background getUpdates poll)
 */
export async function handleTelegramUpdate(update: Record<string, any>) {
  const token = await getActiveBotToken();
  if (!token) return;

  // 1. Handle Inline Button Callback Query (APPROVE LOGIN / REJECT LOGIN)
  if (update.callback_query) {
    const cq = update.callback_query;
    const callbackId = cq.id;
    const fromId = String(cq.from?.id || '');
    const data = String(cq.data || '');

    if (data.startsWith('approve:') || data.startsWith('reject:')) {
      const [action, challengeId] = data.split(':');
      const decision = action === 'approve' ? 'approved' : 'rejected';

      const result = await resolveTelegramChallenge({
        challengeId,
        telegramUserId: fromId,
        decision,
      });

      if (!result.ok) {
        await callTelegramApi(token, 'answerCallbackQuery', {
          callback_query_id: callbackId,
          text: `⛔ ${result.error}`,
          show_alert: true,
        });
        return;
      }

      await callTelegramApi(token, 'answerCallbackQuery', {
        callback_query_id: callbackId,
        text:
          decision === 'approved'
            ? '✅ Admin login approved!'
            : '❌ Admin login rejected!',
      });

      if (cq.message?.chat?.id && cq.message?.message_id) {
        const statusLine =
          decision === 'approved'
            ? '✅ *STATUS: APPROVED BY ADMIN*'
            : '❌ *STATUS: REJECTED BY ADMIN*';
        await callTelegramApi(token, 'editMessageText', {
          chat_id: cq.message.chat.id,
          message_id: cq.message.message_id,
          text: `${cq.message.text || ''}\n\n${statusLine} (${new Date().toLocaleTimeString()})`,
          parse_mode: 'Markdown',
        });
      }

      if (decision === 'rejected') {
        queueTelegramNotification({
          eventKey: 'telegram_login_rejected',
          title: 'Telegram Login Rejected',
          text: `⚠️ *ADMIN LOGIN REJECTED*\n\nChallenge \`${challengeId.slice(0, 8)}\` was explicitly rejected by Telegram ID \`${fromId}\`.`,
          bypassCooldown: true,
        });
      }
    }
    return;
  }

  // 2. Handle Direct Bot Commands (/start, /myid, /report, /verifycontact)
  if (update.message) {
    const msg = update.message;
    const chatId = String(msg.chat?.id || '');
    const fromId = String(msg.from?.id || '');
    const text = String(msg.text || '').trim();

    // Optional contact verification step
    if (msg.contact && msg.contact.user_id && String(msg.contact.user_id) === fromId) {
      const existing = await db
        .select()
        .from(authorizedTelegramUsers)
        .where(eq(authorizedTelegramUsers.telegramUserId, fromId));
      if (existing.length > 0) {
        await db
          .update(authorizedTelegramUsers)
          .set({ phoneVerified: true })
          .where(eq(authorizedTelegramUsers.telegramUserId, fromId));
        await callTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: '✅ Your Telegram contact ownership has been verified as an additional security factor for your enrolled Admin ID.',
          reply_markup: { remove_keyboard: true },
        });
      }
      return;
    }

    if (text === '/start' || text === '/myid') {
      await callTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: `🎆 *Indian New Year 2027 Security Bot*\n\nYour numeric Telegram User ID is:\n\`${fromId}\`\n\nUse this numeric ID in the Admin Enrollment screen along with your \`ADMIN_BOOTSTRAP_SECRET\`.`,
        parse_mode: 'Markdown',
      });
      return;
    }

    if (text === '/verifycontact') {
      await callTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: '📱 Tap the button below to verify your Telegram contact with the security bot:',
        reply_markup: {
          keyboard: [
            [{ text: '📱 Share Contact for Verification', request_contact: true }],
          ],
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      });
      return;
    }

    if (text === '/report') {
      const auth = await db
        .select()
        .from(authorizedTelegramUsers)
        .where(eq(authorizedTelegramUsers.telegramUserId, fromId));
      if (auth.length > 0 && auth[0].isActive) {
        const reportText = await generateFormattedReport('today', 'DAILY REPORT');
        await callTelegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: reportText,
        });
      }
    }
  }
}

/**
 * Poll Telegram getUpdates if webhook is not active (allows instant local/preview testing)
 */
export async function pollTelegramUpdatesForChallenge() {
  try {
    const token = await getActiveBotToken();
    if (!token) return;

    const cfgRows = await db.select().from(telegramBotConfig).limit(1);
    if (
      cfgRows.length > 0 &&
      cfgRows[0].webhookUrl &&
      cfgRows[0].webhookUrl.startsWith('https://')
    ) {
      // Webhook is active; no need to call getUpdates
      return;
    }

    const res = await callTelegramApi<Array<Record<string, any>>>(
      token,
      'getUpdates',
      {
        offset: lastUpdateOffset + 1,
        timeout: 1,
        allowed_updates: ['message', 'callback_query'],
      }
    );

    if (res.ok && Array.isArray(res.result)) {
      for (const upd of res.result) {
        if (typeof upd.update_id === 'number' && upd.update_id > lastUpdateOffset) {
          lastUpdateOffset = upd.update_id;
        }
        await handleTelegramUpdate(upd);
      }
    }
  } catch {
    // Ignore transient polling errors
  }
}

/**
 * Non-blocking Background Notification Queue with Retry & Cooldown Aggregation
 */
export function queueTelegramNotification(params: {
  eventKey: string;
  title: string;
  text: string;
  bypassCooldown?: boolean;
}) {
  // Fire and forget on next tick so website page loading is never blocked
  setImmediate(() => {
    processNotificationAsync(params).catch((err) => {
      console.error('Background notification error:', err);
    });
  });
}

async function processNotificationAsync(params: {
  eventKey: string;
  title: string;
  text: string;
  bypassCooldown?: boolean;
}) {
  try {
    await ensureNotificationSettingsSeeded();
    const settingRows = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.eventKey, params.eventKey));

    const setting = settingRows[0];
    if (setting && !setting.enabled) {
      return;
    }

    const now = new Date();
    if (
      !params.bypassCooldown &&
      setting &&
      setting.cooldownSeconds > 0 &&
      setting.lastSentAt
    ) {
      const elapsedSec = (now.getTime() - setting.lastSentAt.getTime()) / 1000;
      if (elapsedSec < setting.cooldownSeconds) {
        if (params.eventKey in pendingAggregations) {
          pendingAggregations[params.eventKey] += 1;
        }
        return;
      }
    }

    let finalText = params.text;
    if (
      params.eventKey in pendingAggregations &&
      pendingAggregations[params.eventKey] > 0
    ) {
      const extra = pendingAggregations[params.eventKey];
      pendingAggregations[params.eventKey] = 0;
      finalText += `\n\n📊 _(+${extra} additional ${params.eventKey === 'new_visitor' ? 'visits' : 'share clicks'} aggregated during cooldown window)_`;
    }

    if (setting) {
      await db
        .update(notificationSettings)
        .set({ lastSentAt: now, updatedAt: now })
        .where(eq(notificationSettings.id, setting.id));
    }

    const token = await getActiveBotToken();
    const admins = await db
      .select()
      .from(authorizedTelegramUsers)
      .where(eq(authorizedTelegramUsers.isActive, true));

    if (!token || admins.length === 0) {
      await db.insert(notificationLogs).values({
        eventKey: params.eventKey,
        title: params.title,
        messagePreview: finalText.replace(/[*_`]/g, '').slice(0, 180),
        status: 'queued',
        retryCount: 0,
        errorDetails: !token
          ? 'Bot token not configured'
          : 'No enrolled Telegram admin ID',
      });
      return;
    }

    // Deliver with bounded retry (max 2 retries on transient failure)
    let delivered = false;
    let attempts = 0;
    let lastErr = '';

    while (!delivered && attempts < 3) {
      attempts += 1;
      try {
        let okCount = 0;
        for (const admin of admins) {
          const res = await callTelegramApi(token, 'sendMessage', {
            chat_id: admin.telegramUserId,
            text: finalText,
          });
          if (res.ok) {
            okCount += 1;
          } else {
            lastErr = res.description || 'Telegram API error';
          }
        }
        if (okCount > 0) {
          delivered = true;
        }
      } catch (e: unknown) {
        lastErr = e instanceof Error ? e.message : 'Network error';
      }

      if (!delivered && attempts < 3) {
        await new Promise((r) => setTimeout(r, 1000 * attempts));
      }
    }

    await db.insert(notificationLogs).values({
      eventKey: params.eventKey,
      title: params.title,
      messagePreview: finalText.slice(0, 180),
      status: delivered ? 'sent' : 'failed',
      retryCount: attempts - 1,
      errorDetails: delivered ? null : lastErr,
    });
  } catch (error) {
    console.error('Failed in processNotificationAsync:', error);
  }
}

const LANGUAGE_LABELS: Record<string, string> = {
  hi: 'Hindi',
  en: 'English',
  bn: 'Bengali',
  mr: 'Marathi',
  hinglish: 'Hinglish',
  ur: 'Urdu',
  gu: 'Gujarati',
  ta: 'Tamil',
  te: 'Telugu',
  kn: 'Kannada',
  ml: 'Malayalam',
  pa: 'Punjabi',
  or: 'Odia',
  as: 'Assamese',
};

const ANIMATION_LABELS: Record<string, string> = {
  sparkler: 'Sparkler Name',
  fireworks: 'Royal Fireworks',
  galaxy: 'Galaxy',
  countdown: 'Midnight Countdown',
  lanterns: 'Sky Lanterns',
  gold: 'Golden Luxe',
  neon: 'Neon City',
  gift: 'Magic Gift',
  aurora: 'Aurora Snow',
};

export async function generateFormattedReport(
  preset: DateFilterPreset,
  reportHeading: 'DAILY REPORT' | 'WEEKLY REPORT' | 'MONTHLY REPORT'
): Promise<string> {
  const data = await getDashboardAnalytics({ preset });
  const { date } = getISTDateParts();

  const popLang =
    LANGUAGE_LABELS[data.overview.mostPopularLanguage] ||
    data.overview.mostPopularLanguage;
  const popAnim =
    ANIMATION_LABELS[data.overview.mostPopularAnimation] ||
    data.overview.mostPopularAnimation;

  const top3Names = data.nameAnalytics.slice(0, 3);
  const topNamesLines =
    top3Names.length > 0
      ? top3Names.map((n, idx) => `${idx + 1}. ${n.displayName} — ${n.wishesCount}`)
      : ['1. No wishes recorded in period — 0'];

  return [
    `INDIAN NEW YEAR 2027 — ${reportHeading}`,
    '',
    `Date: ${date}`,
    '',
    `Total Visits: ${data.overview.totalWebsiteVisits}`,
    `Unique Visitors: ${data.overview.uniqueVisitors}`,
    `Wishes Created: ${data.overview.totalWishesCreated}`,
    `Share Clicks: ${data.overview.totalShareClicks}`,
    '',
    `Most Popular Language: ${popLang}`,
    `Most Popular Animation: ${popAnim}`,
    '',
    'Top Names:',
    '',
    ...topNamesLines,
  ].join('\n');
}

export async function triggerScheduledReportNotification(
  reportType: 'daily' | 'weekly' | 'monthly'
) {
  const map: Record<
    'daily' | 'weekly' | 'monthly',
    {
      preset: DateFilterPreset;
      heading: 'DAILY REPORT' | 'WEEKLY REPORT' | 'MONTHLY REPORT';
      eventKey: string;
      title: string;
    }
  > = {
    daily: {
      preset: 'today',
      heading: 'DAILY REPORT',
      eventKey: 'daily_report',
      title: 'Daily Website Report',
    },
    weekly: {
      preset: '7d',
      heading: 'WEEKLY REPORT',
      eventKey: 'weekly_report',
      title: 'Weekly Website Report',
    },
    monthly: {
      preset: 'month',
      heading: 'MONTHLY REPORT',
      eventKey: 'monthly_report',
      title: 'Monthly Website Report',
    },
  };

  const cfg = map[reportType];
  const reportText = await generateFormattedReport(cfg.preset, cfg.heading);
  queueTelegramNotification({
    eventKey: cfg.eventKey,
    title: cfg.title,
    text: reportText,
    bypassCooldown: true,
  });
  return reportText;
}
