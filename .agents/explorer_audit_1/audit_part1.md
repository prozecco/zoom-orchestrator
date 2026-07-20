# System Audit & Codebase Security Report (Part 1)

**Date**: 2026-07-14  
**Target Workspace**: Zoom Meeting Management Client natively inside Telegram  
**Auditor**: Explorer 1  

---

## 1. Executive Summary
This audit provides a comprehensive review of the Architecture & Configuration, Secrets Hygiene, and Backend Security of the Telegram & Zoom Automated Approval System. The system was audited against standard secure coding practices and the project-specific `system-review` guidelines.

While database operations are properly parameterized and a unified SQLite/PostgreSQL layer is implemented, the audit identified **two Critical vulnerabilities** (unauthenticated Zoom webhooks and undefined helper functions in the bot), **two High-severity issues** (broken callback query patterns and missing dependencies), and several Medium/Low-severity items that require immediate remediation before production deployment.

---

## 2. Environment Variable Checklist
The table below maps all configuration variables used across the codebase, verifying if they are defined in `.env` and loaded by `config.py`.

| Environment Variable | Source Code References | Present in `.env` | Sensitivity | Notes / Recommendations |
| :--- | :--- | :---: | :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | `config.py`, `app.py`, `web_server.py` | **Yes** | Critical | Used for Telegram Bot API client. Used in WebApp initData validation. |
| `ADMIN_CHAT_ID` | `config.py`, `app.py`, `web_server.py` | **Yes** | Medium | Chat ID for bot administrator alerts. Cast to integer. |
| `NOTIFICATION_CHAT_ID`| `config.py`, `web_server.py` | **Yes** | Medium | Falls back to `ADMIN_CHAT_ID` if unset/empty. |
| `MINI_APP_URL` | `app.py`, `.env` | **Yes** | Low | Base URL for the Telegram WebApp / Mini App dashboard. |
| `TELEGRAM_API_ID` | `userbot_service.py`, `setup_userbot.py` | **Yes** | High | Required for MTProto Pyrogram client. |
| `TELEGRAM_API_HASH` | `userbot_service.py`, `setup_userbot.py` | **Yes** | Critical | Required for MTProto Pyrogram client. |
| `TELEGRAM_SESSION_STRING`| `userbot_service.py`, `setup_userbot.py` | **Yes** | Critical | Pre-authorized Pyrogram MTProto session string. |
| `DATABASE_URL` | `config.py`, `storage.py`, `migrate_to_postgres.py`| **Yes** | Critical | Remote PostgreSQL connection string. Contains credentials. |
| `DATABASE_PATH` | `config.py`, `storage.py`, `migrate_to_postgres.py`| *No* | Low | Falls back to `"database.db"` (SQLite) if `DATABASE_URL` is empty. |
| `ZOOM_CLIENT_ID` | `config.py`, `zoom_service.py`, `web_server.py` | **Yes** | High | Server-to-Server OAuth Client ID. |
| `ZOOM_CLIENT_SECRET` | `config.py`, `zoom_service.py`, `web_server.py` | **Yes** | Critical | Server-to-Server OAuth Client Secret. |
| `ZOOM_ACCOUNT_ID` | `config.py`, `zoom_service.py`, `web_server.py` | **Yes** | High | Server-to-Server OAuth Account ID. |
| `ZOOM_MEETING_ID` | `config.py`, `zoom_service.py` | **Yes** | Medium | Default active Zoom meeting ID. |
| `ZOOM_REGISTRATION_LINK`| `config.py`, `zoom_service.py` | **Yes** | Medium | Fallback link when registration requires external redirection. |
| `ZOOM_WEBHOOK_SECRET` | `web_server.py` | *No* | High | Optional webhook verification secret; falls back to `ZOOM_CLIENT_SECRET` if missing. |
| `PORT` | `app.py`, `web_server.py` | *No* | Low | Server port configuration. Falls back to `7860`. |
| `RENDER` | `app.py` | *No* | Low | Deployment indicator set by Render hosting environment. |
| `SPACE_ID` / `SPACE_OWNER` | `app.py` | *No* | Low | Deployment indicators set by Hugging Face Spaces. |

---

## 3. Detailed Audit Findings

### 🔴 Critical Severity

#### Finding 3.1: Unauthenticated Zoom Webhook Endpoint (Authentication Bypass)
*   **Location**: `web_server.py:783` (`@app.post("/api/webhooks/zoom")`)
*   **Vulnerability**: The webhook listener processes event payloads (such as `meeting.chat_message_sent` or `chat_message.sent`) without verifying Zoom's cryptographic request signature. Although it handles the `endpoint.url_validation` challenge correctly, it lacks middleware or logic to validate the `x-zm-signature` header on incoming events.
*   **Impact**: Any attacker can send forged HTTP POST requests directly to `/api/webhooks/zoom` mimicking Zoom events. They can inject fake chat messages into the local database (via `storage.save_chat_message`) and trigger spam alerts to the administrator's Telegram chat (via `bot.send_message`), leading to potential phishing, social engineering, or log injection attacks.
*   **Evidence**:
    ```python
    @app.post("/api/webhooks/zoom")
    async def zoom_webhook_listener(req: dict):
        try:
            event = req.get("event")
            payload = req.get("payload", {})
            
            # Handle Zoom Webhook Challenge Validation
            if event == "endpoint.url_validation":
                # ... CRC challenge verification ...
            
            object_data = payload.get("object", {})
            if event == "meeting.chat_message_sent":
                # [VULNERABILITY] Processes payload directly without checking x-zm-signature header!
    ```

#### Finding 3.2: Undefined Bot Handler & Helper Functions (Runtime Crashes)
*   **Location**: `app.py:372`, `app.py:1042`, `app.py:415`, `app.py:447`, `app.py:449`, `app.py:465`, `app.py:466`, `app.py:382`
*   **Vulnerability**: The Telegram bot script `app.py` makes calls to several interactive UI markup generators and handlers that are not defined in `app.py` or imported from other modules.
    - `get_admin_keyboard(sub_id)` (lines 372, 1042)
    - `view_full_history(update, context)` (line 415)
    - `admin_name_changes_command(update, context)` (line 447)
    - `show_config_menu(update, context)` (line 449)
    - `get_admin_panel_markup()` (line 465)
    - `get_admin_panel_back_text(bot_hosting, db_type)` (line 466)
    - `review_name_change_card(update, context, sub_id)` (line 382)
*   **Impact**: When an admin triggers commands (like `/review`, `/requests`, or clicking "Back to panel 🛡️"), the bot will instantly crash due to `NameError`, making the administrative panel and Telegram approval features unusable.
*   **Evidence**:
    ```python
    # Example from app.py:372
    reply_markup = get_admin_keyboard(sub_id)
    # get_admin_keyboard is never defined or imported in app.py!
    ```

---

### 🟡 High Severity

#### Finding 3.3: Mismatched Callback Query Handlers (Broken Approve/Deny Buttons)
*   **Location**: `web_server.py:295` vs `app.py:1276`
*   **Vulnerability**: The registration notification card buttons sent to the admin chat from `web_server.py` use callback data prefixes `app_` and `den_`:
    ```python
    InlineKeyboardButton("✅ Approve", callback_data=f"app_{submission_id}"),
    InlineKeyboardButton("❌ Deny", callback_data=f"den_{submission_id}")
    ```
    However, the callback query pattern registered in `app.py` expects the full verbs: `approve_` and `deny_`.
*   **Impact**: Clicking the "Approve" or "Deny" buttons on the bot decision cards sent by the web server has no effect, because the bot's CallbackQueryHandler will not catch the query payload, rendering direct card-based approvals completely broken.
*   **Evidence**:
    ```python
    # web_server.py:295
    InlineKeyboardButton("✅ Approve", callback_data=f"app_{submission_id}")
    
    # app.py:1276
    CallbackQueryHandler(admin_decision_callback, pattern="^(approve|deny|later|blacklist|editnotes|reviewreq|reviewname|apprname|denyname|viewhist)_(\\d+)$")
    # Matches 'approve_123' but NOT 'app_123'!
    ```

#### Finding 3.4: Missing Dependencies in requirements.txt (Deployment Failure)
*   **Location**: `requirements.txt` vs `userbot_service.py` & `setup_userbot.py`
*   **Vulnerability**: `requirements.txt` lacks `pyrogram` and its speedup package `tgcrypto`.
*   **Impact**: In standard containerized environments (like Docker deployments running `pip install -r requirements.txt`), `pyrogram` will not be installed. When `userbot_service.py` initializes, it will fail to import `pyrogram`, defaulting to a mock class that disablesusername-to-ID lookup.
*   **Evidence**:
    `requirements.txt` only contains `python-telegram-bot`, `requests`, `python-dotenv`, `psycopg2-binary`, `fastapi`, `uvicorn`, and `pydantic[email]`.

---

### 🟢 Medium Severity

#### Finding 3.5: Zoom API Pagination Ignored (Data Truncation)
*   **Location**: `zoom_service.py:206` (`list_registrants`) and `zoom_service.py:338` (`get_live_participants`)
*   **Vulnerability**: Zoom API endpoints are queried with a hardcoded `page_size` parameter set to `100` but do not parse or follow `next_page_token` fields returned in the JSON response.
*   **Impact**: If a Zoom meeting has more than 100 registrants or live participants, any records beyond the first 100 will be completely ignored during synchronizations or status lookups.
*   **Evidence**:
    ```python
    # zoom_service.py:223
    params = {
        "status": status,
        "page_size": 100
    }
    response = requests.get(url, headers=headers, params=params, timeout=10)
    # ... returns response.json().get("registrants", []) directly without pagination logic.
    ```

#### Finding 3.6: Permissive CORS Configuration
*   **Location**: `web_server.py:30`
*   **Vulnerability**: The FastAPI application is configured with `allow_origins=["*"]`.
*   **Impact**: While `allow_credentials=False` prevents session cookie leaks, a wildcard origin configuration is lax. It should restrict origins to authorized domains (e.g. the specific Telegram Mini App URL domain) to mitigate cross-origin security risks.

---

### 🔵 Low Severity

#### Finding 3.7: Query Concatenation Anti-Pattern
*   **Location**: `app.py:701`, `app.py:711`, `app.py:725`, `app.py:735`
*   **Vulnerability**: SQL query strings concatenate the `ONHOLD_DAYS` variable directly:
    `"... INTERVAL '" + str(ONHOLD_DAYS) + " days'"`
*   **Impact**: Safe in the current context because `ONHOLD_DAYS` is hardcoded as an integer, but remains a dangerous coding pattern that should be avoided.

#### Finding 3.8: Secrets Stored in Local .env Without Templates
*   **Location**: `.env` vs Lack of `.env.example`
*   **Vulnerability**: Real secrets (bot tokens, database credentials, API keys) are defined in `.env`. While ignored by `.gitignore` and untracked, there is no template file (e.g., `.env.example`) present in the project to assist developers in safe credential management.

---

## 4. Recommendations & Next Steps

1.  **Remediation of 3.1 (Zoom Webhook Authentication)**:
    Implement a verification function in `web_server.py` that computes the SHA256 HMAC signature using `ZOOM_WEBHOOK_SECRET` and validates it against the `x-zm-signature` and `x-zm-request-timestamp` request headers. Reject webhook events failing this check.
2.  **Remediation of 3.2 (Missing Helper Functions)**:
    Define or import the missing functions (`get_admin_keyboard`, `view_full_history`, `admin_name_changes_command`, `show_config_menu`, `get_admin_panel_markup`, `get_admin_panel_back_text`, `review_name_change_card`) in `app.py` to restore full administrative bot functionality.
3.  **Remediation of 3.3 (Callback Mapping Fix)**:
    Update `web_server.py:295` to use `callback_data=f"approve_{submission_id}"` and `callback_data=f"deny_{submission_id}"` to align with the bot's handler pattern.
4.  **Remediation of 3.4 (requirements.txt update)**:
    Append `pyrogram>=2.0` and `tgcrypto` to `requirements.txt`.
5.  **Remediation of 3.5 (Pagination support)**:
    Refactor `zoom_service.py` loops to check for `next_page_token` in Zoom API responses and fetch additional pages when present.
