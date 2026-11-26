# Indian New Year Wishes 2027 — Full-Stack Platform, Admin Dashboard & Telegram Security System

Production-ready Indian New Year 2027 Wishes platform featuring 9 interactive 3D Canvas animations, 14 Indian languages (Hindi, English, Bengali, Marathi, Hinglish, Urdu, Gujarati, Tamil, Telugu, Kannada, Malayalam, Punjabi, Odia, Assamese), personalized gift-opening links (`?n=...&a=...&w=...&lang=...`), a hidden 5-second logo press Admin Security Gateway, real PostgreSQL analytics, and mandatory Telegram Bot login approval & notifications.

---

## 1. Architecture & Database Schema

- **Frontend**: React 19 + TypeScript + Tailwind CSS + HTML5 Canvas 3D Animation Engine + Web Audio Synthesizer.
- **Backend**: Node.js + Express (`server.ts`) serving structured REST APIs (`/api/health`, `/api/analytics/*`, `/api/telegram/webhook`, `/api/admin/*`).
- **Database**: PostgreSQL with Drizzle ORM (`/src/db/schema.ts`, `/src/db/drizzle.config.ts`, `/src/db/index.ts`).

### Normalized PostgreSQL Tables (`src/db/schema.ts`)
1. `admin_users` — Stores `Roynorules` username, bcrypt password hash, failed login attempts, and lockout timestamps.
2. `admin_sessions` — Stores SHA-256 hashed session tokens, CSRF tokens, IP hashes, and expiration/revocation timestamps.
3. `authorized_telegram_users` — Stores enrolled numeric Telegram User IDs authorized to approve logins and receive reports.
4. `telegram_bot_config` — Stores AES-256-GCM encrypted Telegram Bot Token, masked token preview, webhook status, and connection timestamps.
5. `telegram_login_challenges` — Single-use, 2-minute cryptographic login challenges requiring inline Telegram approval (`APPROVE LOGIN` / `REJECT LOGIN`).
6. `visitor_sessions` — Anonymous visitor identifiers, returning visitor detection, traffic source attribution, and 2-minute live visitor heartbeat timestamps.
7. `analytics_events` — Deduplicated event log (`event_id` idempotency key) for `page_visit`, `wish_created`, `share_click`, and `gift_opened`.
8. `daily_analytics` — Daily IST rollups for visits, unique visitors, new/returning visitors, wishes created, and share clicks.
9. `name_analytics` — Aggregated wish counts per normalized name and date while preserving original display spelling.
10. `notification_settings` — All 15 configurable Telegram alert types with anti-spam cooldown settings.
11. `notification_logs` — Delivery audit log and retry counts for Telegram notifications.
12. `admin_audit_logs` — Immutable security trail of login attempts, lockouts, Telegram approvals, and password changes.
13. `users` — Firebase Auth user synchronization table.

---

## 2. Environment Variables Configuration

Configure the following in your Render Web Service Environment Variables:

| Variable | Purpose | How to Generate |
| --- | --- | --- |
| `ADMIN_USERNAME` | Administrator username (`Roynorules`) | Set to `Roynorules` |
| `ADMIN_PASSWORD_HASH` | Bcrypt (cost 12) hash of your admin password | `npx tsx -e "import bcrypt from 'bcryptjs'; console.log(await bcrypt.hash('YOUR_STRONG_PASSWORD', 12))"` |
| `ADMIN_BOOTSTRAP_SECRET` | One-time secret to enroll your numeric Telegram User ID | `openssl rand -hex 24` |
| `TELEGRAM_BOT_ENCRYPTION_KEY` | Encryption key for AES-256-GCM bot token storage | `openssl rand -hex 32` |
| `TELEGRAM_WEBHOOK_SECRET` | Secret token verified on `/api/telegram/webhook` | `openssl rand -hex 24` |
| `SESSION_SECRET` | HMAC secret for hashing session tokens and IP fingerprints | `openssl rand -hex 32` |
| `FRONTEND_ORIGIN` | Your Render production HTTPS domain | e.g. `https://indian-newyear-wishes-2027.onrender.com` |
| `SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`, `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD` | PostgreSQL connection pool & Drizzle migration credentials | Automatically mapped from Render PostgreSQL in `render.yaml` |

> **First-Run Convenience**: If `ADMIN_PASSWORD_HASH` is not set yet when you first deploy, holding the logo for 5 seconds opens a one-time **First-Run Admin Password Initialization** screen that hashes your chosen password with `bcrypt` (cost 12) and locks it in PostgreSQL.

---

## 3. Telegram Bot Setup & Admin Enrollment Instructions

1. Open Telegram and message **[@BotFather](https://t.me/BotFather)**.
2. Send `/newbot`, choose a name and username, and copy the **Telegram Bot Token**.
3. Open a chat with your newly created bot and press **Start** (`/start`).
4. Find your numeric **Telegram User ID** by sending `/myid` to your bot (after connecting) or messaging `@userinfobot`.
5. On the website, **press and hold the top header logo (`🎆 Indian New Year 2027`) continuously for 5 seconds** to open the **Admin Security Gateway**.
6. Log in with username `Roynorules` and your password.
7. On first login, complete the **One-Time Telegram Admin Enrollment** by entering your Bot Token, your numeric Telegram User ID, and your `ADMIN_BOOTSTRAP_SECRET`.
8. On every login thereafter, your bot sends an instant Telegram message with two inline buttons:
   - **✅ APPROVE LOGIN**
   - **❌ REJECT LOGIN**
9. Only your enrolled numeric Telegram User ID can approve the login within the 2-minute single-use window.
10. Inside the Admin Dashboard → **Telegram Bot & Alerts**, click **CONNECT YOUR BOT** to register the HTTPS webhook and test all 15 notification types.

---

## 4. Render Deployment Checklist

1. Push this repository to GitHub/GitLab.
2. In Render, click **New +** → **Blueprint** and select your repository (`render.yaml`).
3. Set `ADMIN_PASSWORD_HASH` and `FRONTEND_ORIGIN` in the Render environment prompt.
4. Run `npx drizzle-kit push --config=src/db/drizzle.config.ts` to initialize all PostgreSQL tables and indexes.
5. Verify `/api/health` returns `{"status":"ok"}`.
6. Hold the header logo for 5 seconds, complete Telegram enrollment, and click **CONNECT YOUR BOT** in the Telegram Settings tab.
