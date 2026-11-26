import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// 1. Firebase Auth Users Table (Required for Cloud SQL Auth integration)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. Admin Users Table
export const adminUsers = pgTable('admin_users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  failedAttempts: integer('failed_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until'),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 3. Admin Sessions Table
export const adminSessions = pgTable(
  'admin_sessions',
  {
    id: serial('id').primaryKey(),
    sessionTokenHash: text('session_token_hash').notNull().unique(),
    adminUserId: integer('admin_user_id')
      .references(() => adminUsers.id)
      .notNull(),
    csrfToken: text('csrf_token').notNull(),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at').notNull(),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('idx_admin_sessions_expires').on(table.expiresAt)]
);

// 4. Authorized Telegram Users Table (Enrolled Admin Telegram IDs)
export const authorizedTelegramUsers = pgTable('authorized_telegram_users', {
  id: serial('id').primaryKey(),
  telegramUserId: text('telegram_user_id').notNull().unique(),
  telegramUsername: text('telegram_username'),
  firstName: text('first_name'),
  phoneVerified: boolean('phone_verified').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  enrolledAt: timestamp('enrolled_at').defaultNow(),
});

// 5. Telegram Bot Configuration Table (Encrypted Bot Token)
export const telegramBotConfig = pgTable('telegram_bot_config', {
  id: serial('id').primaryKey(),
  encryptedToken: text('encrypted_token').notNull(),
  maskedToken: text('masked_token').notNull(),
  botUsername: text('bot_username'),
  botFirstName: text('bot_first_name'),
  botTelegramId: text('bot_telegram_id'),
  webhookSecretHash: text('webhook_secret_hash'),
  webhookConnected: boolean('webhook_connected').notNull().default(false),
  webhookUrl: text('webhook_url'),
  lastConnectedAt: timestamp('last_connected_at'),
  lastError: text('last_error'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 6. Telegram Login Challenges Table (Single-use 2-minute login approval challenges)
export const telegramLoginChallenges = pgTable(
  'telegram_login_challenges',
  {
    id: serial('id').primaryKey(),
    challengeId: text('challenge_id').notNull().unique(),
    adminUserId: integer('admin_user_id')
      .references(() => adminUsers.id)
      .notNull(),
    status: text('status').notNull().default('pending'), // pending | approved | rejected | expired | consumed
    approvedByTelegramId: text('approved_by_telegram_id'),
    telegramMessageId: text('telegram_message_id'),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at').notNull(),
    resolvedAt: timestamp('resolved_at'),
    consumedAt: timestamp('consumed_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('idx_tg_challenges_status').on(table.status)]
);

// 7. Visitor Sessions Table (Privacy-conscious anonymous visitor tracking & live heartbeat)
export const visitorSessions = pgTable(
  'visitor_sessions',
  {
    id: serial('id').primaryKey(),
    visitorId: text('visitor_id').notNull().unique(),
    sessionCount: integer('session_count').notNull().default(1),
    isReturning: boolean('is_returning').notNull().default(false),
    firstSeenDate: text('first_seen_date').notNull(), // YYYY-MM-DD
    lastSeenDate: text('last_seen_date').notNull(), // YYYY-MM-DD
    lastActiveAt: timestamp('last_active_at').notNull().defaultNow(),
    trafficSource: text('traffic_source').notNull().default('direct'),
    initialLang: text('initial_lang').notNull().default('hi'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('idx_visitor_last_active').on(table.lastActiveAt),
    index('idx_visitor_last_seen_date').on(table.lastSeenDate),
  ]
);

// 8. Analytics Events Table (Deduplicated via eventId idempotency key)
export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: serial('id').primaryKey(),
    eventId: text('event_id').notNull().unique(),
    eventType: text('event_type').notNull(), // page_visit | wish_created | share_click | gift_opened
    visitorId: text('visitor_id').notNull(),
    eventDate: text('event_date').notNull(), // YYYY-MM-DD (IST)
    eventHour: integer('event_hour').notNull(), // 0..23 (IST)
    eventMonth: text('event_month').notNull(), // YYYY-MM (IST)
    lang: text('lang'),
    animId: text('anim_id'),
    msgId: integer('msg_id'),
    sharePlatform: text('share_platform'), // whatsapp | telegram | facebook | x | native | copy_link | other
    trafficSource: text('traffic_source'), // direct | google | whatsapp | telegram | facebook | other
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('idx_events_type_date').on(table.eventType, table.eventDate),
    index('idx_events_date').on(table.eventDate),
    index('idx_events_month').on(table.eventMonth),
  ]
);

// 9. Daily Analytics Rollup Table
export const dailyAnalytics = pgTable('daily_analytics', {
  id: serial('id').primaryKey(),
  date: text('date').notNull().unique(), // YYYY-MM-DD
  totalVisits: integer('total_visits').notNull().default(0),
  uniqueVisitors: integer('unique_visitors').notNull().default(0),
  newVisitors: integer('new_visitors').notNull().default(0),
  returningVisitors: integer('returning_visitors').notNull().default(0),
  wishesCreated: integer('wishes_created').notNull().default(0),
  shareClicks: integer('share_clicks').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 10. Name Analytics Table (Aggregated name counts by date — no personal directory)
export const nameAnalytics = pgTable(
  'name_analytics',
  {
    id: serial('id').primaryKey(),
    normalizedKey: text('normalized_key').notNull().unique(), // `${normalizedName}|${date}`
    normalizedName: text('normalized_name').notNull(),
    displayName: text('display_name').notNull(),
    date: text('date').notNull(), // YYYY-MM-DD
    wishesCount: integer('wishes_count').notNull().default(1),
    lastLanguage: text('last_language'),
    lastAnimation: text('last_animation'),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_name_analytics_date').on(table.date),
    index('idx_name_analytics_norm').on(table.normalizedName),
  ]
);

// 11. Notification Settings Table (15 configurable Telegram alert types)
export const notificationSettings = pgTable('notification_settings', {
  id: serial('id').primaryKey(),
  eventKey: text('event_key').notNull().unique(),
  label: text('label').notNull(),
  category: text('category').notNull(), // traffic | reports | security | system
  enabled: boolean('enabled').notNull().default(true),
  cooldownSeconds: integer('cooldown_seconds').notNull().default(60),
  lastSentAt: timestamp('last_sent_at'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 12. Notification Logs Table
export const notificationLogs = pgTable(
  'notification_logs',
  {
    id: serial('id').primaryKey(),
    eventKey: text('event_key').notNull(),
    title: text('title').notNull(),
    messagePreview: text('message_preview').notNull(),
    status: text('status').notNull(), // sent | failed | queued | throttled
    retryCount: integer('retry_count').notNull().default(0),
    errorDetails: text('error_details'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('idx_notification_logs_created').on(table.createdAt)]
);

// 13. Admin Audit Logs Table
export const adminAuditLogs = pgTable(
  'admin_audit_logs',
  {
    id: serial('id').primaryKey(),
    action: text('action').notNull(),
    actor: text('actor').notNull(),
    status: text('status').notNull(), // success | failure | warning
    ipHash: text('ip_hash'),
    details: text('details'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('idx_audit_logs_created').on(table.createdAt)]
);
