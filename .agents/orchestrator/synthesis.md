# System Review Audit Synthesis

This document synthesizes the findings of the three system audit subagents (Explorer 1, 2, and 3).

---

## 1. Findings by Severity

### Critical Issues

#### 1.1 Unauthenticated Zoom Webhook Endpoint
- **Location**: `web_server.py` (lines 783–877)
- **Impact**: `@app.post("/api/webhooks/zoom")` processes webhook payloads directly without checking the signature header (`x-zm-signature`) or token. Any external client can POST forged webhook events (e.g. mock registrations, chat logs), leading to database corruption, unauthorized registrant approvals/denials, and alert spam in admin chats.
- **Fix**: Implement verification of `x-zm-signature` using the Zoom Webhook Secret Token (already configured as `ZOOM_WEBHOOK_SECRET_TOKEN` in environment variables/config).

#### 1.2 Undefined Helper/UI Functions in Telegram Bot
- **Location**: `app.py`
- **Impact**: The bot makes calls to several non-existent functions. When triggered, these raise `NameError` and crash the bot process.
- **Missing functions**:
  - `get_admin_keyboard(sub_id)` (lines 372, 1042)
  - `view_full_history(update, context)` (line 415)
  - `admin_name_changes_command(update, context)` (line 447)
  - `show_config_menu(update, context)` (line 449)
  - `get_admin_panel_markup()` (line 465)
  - `get_admin_panel_back_text(bot_hosting, db_type)` (line 466)
  - `review_name_change_card(update, context, sub_id)` (line 382)
- **Fix**: Define these keyboard markup and callback handler functions in `app.py` or restore their missing logic to avoid runtime crashes.

#### 1.3 AttributeError Crash in `get_zoom_health`
- **Location**: `app.py` (line 1208)
- **Impact**: Inside the health check endpoint, `meeting_id = zoom_service.meeting_id` is queried, but `ZoomService` has no attribute `meeting_id`. It throws `AttributeError` and crashes.
- **Fix**: Read the meeting ID from the configuration `config.ZOOM_MEETING_ID` or config settings rather than from `zoom_service`.

#### 1.4 Missing Schema Column `zoom_registrant_id`
- **Location**: `storage.py` (lines 95-106, 1105, 1110, 1143 in `app.py`, 1535, 1582, 1588, 1627 in `web_server.py`)
- **Impact**: The `users` table is created without `zoom_registrant_id`. However, queries in `app.py` and `web_server.py` insert or select `zoom_registrant_id` from the `users` table. This causes syntax/operational errors and crashes when syncing users.
- **Fix**: Add `zoom_registrant_id TEXT` to the table schema in `storage.py` and ensure `migrate_to_postgres.py` creates it properly.

---

### High Issues

#### 2.1 Mismatched Callback Query Patterns
- **Location**: `web_server.py` (line 295) vs `app.py` (lines 1276-1278)
- **Impact**: `web_server.py` creates buttons using callback data `app_{submission_id}` and `den_{submission_id}`. However, `app.py` registers a callback query handler matching only `approve_{id}` and `deny_{id}` (or `apprname`/`denyname`). Admin button clicks for Approve/Deny do not trigger any handler.
- **Fix**: Align the button callback data in `web_server.py` with `app.py` patterns, or update `app.pattern` to match `app_` and `den_`.

#### 2.2 Missing Pyrogram Requirements
- **Location**: `requirements.txt` vs `userbot_service.py`
- **Impact**: `userbot_service.py` imports `pyrogram.Client` but `pyrogram` and its dependency `tgcrypto` are missing from `requirements.txt`. Venv setups will fail to import the userbot, resulting in mock-only fallback.
- **Fix**: Add `pyrogram` and `tgcrypto` to `requirements.txt`.

#### 2.3 Migration Rollback Bug
- **Location**: `migrate_to_postgres.py` (lines 51-62)
- **Impact**: The script iterates through rows, and if a row fails, it calls `pg_conn.rollback()`. In Postgres/psycopg2, rollback aborts the entire current transaction, undoing all previous successful inserts. Since commit is only called at the end, any failure rolls back all rows up to that point.
- **Fix**: Use savepoints or execute each row insert in an independent transaction/block, or commit on success and catch exceptions.

#### 2.4 Zoom API Pagination 100 Limit
- **Location**: `zoom_service.py` (lines 206-232, 234-269, 338-361)
- **Impact**: `list_registrants` and lookups request `page_size: 100` and do not process `next_page_token`. For meetings with >100 registrants, only the first 100 are retrieved.
- **Fix**: Implement a loop that checks for `next_page_token` in the response, queries subsequent pages, and aggregates the results.

#### 2.5 API custom questions rate limiting on `/api/questions`
- **Location**: `web_server.py` (lines 213-231)
- **Impact**: The endpoint queries the Zoom API directly on every request. Peak user activity will flood Zoom with S2S requests, causing S2S API rate limit blockages.
- **Fix**: Store and retrieve custom questions in/from the database settings or local cache, syncing them only when the admin explicitly syncs or on a long cache TTL.

#### 2.6 Missing Automated Background Sync Loop
- **Location**: `web_server.py`
- **Impact**: A setting for background sync interval is saved, but no background worker task/thread is spawned to execute the sync. Database records remain stale until manual action is taken.
- **Fix**: Implement a simple background task runner/thread (e.g. using `FastAPI` startup event or a simple helper loop) that reads `zoom_sync_interval` and runs the sync loop asynchronously.

---

### Medium Issues

#### 3.1 Wildcard CORS Configuration
- **Location**: `web_server.py` (lines 30-36)
- **Impact**: `allow_origins=["*"]` allows cross-origin requests from any site.
- **Fix**: Restrict CORS origins to trusted domains or the Telegram WebApp domain.

#### 3.2 Frontend target="_blank" Navigation & BackButton
- **Location**: `public/app.js` (lines 320, 1173, 1180)
- **Impact**: Anchors with `target="_blank"` cause Mini App link escapes. Lack of Telegram BackButton integration makes page navigation exit the app on physical back button.
- **Fix**: Implement Telegram WebApp `BackButton` API and navigate page flows inline.

#### 3.3 Database Connection and Query N+1 Loops
- **Location**: `app.py` (lines 854-862)
- **Impact**: Opening and closing `get_db()` contexts inside page row loops introduces massive TCP/TLS roundtrip latency when querying remote database clusters.
- **Fix**: Open the database connection context once outside the loop and use a single cursor/connection for all iterations.

---

### Low Issues

#### 4.1 SQL Injection Risk via Concatenation
- **Location**: `app.py` (line 701)
- **Impact**: Using string concatenation in `"created_at >= NOW() - INTERVAL '" + str(ONHOLD_DAYS) + "' days"` violates safety rules.
- **Fix**: Parameterize `ONHOLD_DAYS` or inject it via safe string composition.

#### 4.2 Missing Generic `.env.example`
- **Location**: Project root
- **Impact**: The repository contains `.env` with production secrets but lacks `.env.example`.
- **Fix**: Create a generic `.env.example` template with instructions.

#### 4.3 JS escapeHtml crash vulnerability
- **Location**: `public/app.js` (line 1971)
- **Impact**: `escapeHtml(str)` fails if `str` is undefined, null, or non-string.
- **Fix**: Add a type guard or coerce input to string: `str = String(str || '')`.

---

## 2. Environment Variables Checklist

The following environment variables are required by the system:

| Variable | Description | Source | Status |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Token for the Telegram Bot API | `config.py` / `.env` | Required |
| `TELEGRAM_API_ID` | API ID for Pyrogram Userbot | `config.py` / `.env` | Required |
| `TELEGRAM_API_HASH` | API Hash for Pyrogram Userbot | `config.py` / `.env` | Required |
| `TELEGRAM_SESSION_STRING` | Base64 Pyrogram session string | `config.py` / `.env` | Required |
| `ZOOM_ACCOUNT_ID` | Zoom Account ID for S2S OAuth | `zoom_service.py` / `.env`| Required |
| `ZOOM_CLIENT_ID` | Zoom Client ID for S2S OAuth | `zoom_service.py` / `.env`| Required |
| `ZOOM_CLIENT_SECRET` | Zoom Client Secret for S2S OAuth | `zoom_service.py` / `.env`| Required |
| `ZOOM_WEBHOOK_SECRET_TOKEN`| Verification token for Zoom Webhook | `web_server.py` / `.env` | Required |
| `ZOOM_MEETING_ID` | Target Zoom meeting ID | `config.py` / `.env` | Required |
| `DATABASE_URL` | PostgreSQL connection string | `storage.py` / `.env` | Optional (SQLite fallback) |
