# System Audit Report — API Integrations, Frontend, and Performance

This report outlines the findings from the comprehensive system audit of the Zoom Meeting Management client natively running inside Telegram. The audit covers backend API integrations (Telegram Bot API, Zoom API, and Pyrogram Userbot), frontend static files (`public/`), and overall system performance.

---

## Executive Summary

The system is functional and security boundaries are enforced correctly (CORS and Authorization validation). However, several key architectural, integration, and performance flaws exist:
1. **Critical AttributeError**: An uncalled health check function (`get_zoom_health`) contains a syntax error that will immediately crash if invoked.
2. **High Severity Zoom API Pagination Limits**: Registrant list endpoints only retrieve the first page (up to 100). Any registrant beyond 100 is ignored, breaking critical registration syncing and status updates for large meetings.
3. **High Severity Performance Bottleneck**: The custom registration questions endpoint makes live blocking calls to Zoom API on every request instead of utilizing the database settings cache.
4. **Missing automated background synchronization**: The `zoom_sync_interval` configuration setting is present in the UI but is never actually scheduled in python, leaving local database records stale.
5. **Frontend WebApp Navigation Issues**: Standard `target="_blank"` links and missing BackButton integration break native Telegram Mini App navigation.

---

## 🔒 Configuration Checklist & Secrets Hygiene
* **Secrets Hygiene**: `.env` is correctly included in `.gitignore` and is not tracked by Git. Masking of sensitive credentials (`TELEGRAM_BOT_TOKEN`, `ZOOM_CLIENT_SECRET`, `ZOOM_WEBHOOK_SECRET`) works correctly.
* **Environment variables checks**:
  * `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, and `TELEGRAM_SESSION_STRING` are used for username lookup. If they are missing, the system falls back gracefully (returns `None` and displays warning logs) without crashing.

---

## Detailed Findings By Severity

### 🔴 Critical Severity

#### 1. Uncalled Health Check Function AttributeError Crash
* **File**: `app.py`, Line 1208
* **Observation**:
  ```python
  meeting_id = zoom_service.meeting_id
  ```
  The `ZoomService` class defined in `zoom_service.py` does not contain a `meeting_id` attribute or property. Calling `get_zoom_health()` raises:
  `AttributeError: 'ZoomService' object has no attribute 'meeting_id'`
* **Impact**: If diagnostics or health monitoring scripts attempt to call `get_zoom_health()`, the process will raise a traceback and fail to retrieve the status.
* **Proposed Fix**: Change `zoom_service.meeting_id` to `config.active_meeting_id`.
  ```python
  # Before
  meeting_id = zoom_service.meeting_id
  
  # After
  meeting_id = config.active_meeting_id
  ```

---

### 🟠 High Severity

#### 1. Zoom API Pagination Ignored (100 Registrants Cap)
* **File**: `zoom_service.py`, Lines 206-232, 234-269, and 338-361
* **Observation**:
  Zoom API endpoints for listing registrants (`list_registrants` and `get_registrant_id_by_email`) and retrieving live participants (`get_live_participants`) specify `"page_size": 100` but completely ignore the `next_page_token` parameter in the response.
* **Impact**:
  * For meetings with more than 100 registrants, the system only synchronizes and operates on the first 100.
  * In `get_registrant_id_by_email()`, if a user is registrant number 101+, their registrant ID cannot be resolved, meaning the admin will not be able to Approve/Deny them.
* **Proposed Fix**: Implement pagination loops using `next_page_token`.
  * *Example for `list_registrants`*:
    ```python
    def list_registrants(self, meeting_id: str = None, status: str = "pending") -> list[dict]:
        if not meeting_id:
            meeting_id = config.active_meeting_id
        token = get_access_token()
        url = f"https://api.zoom.us/v2/meetings/{meeting_id}/registrants"
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        registrants = []
        next_page_token = ""
        while True:
            params = {"status": status, "page_size": 100}
            if next_page_token:
                params["next_page_token"] = next_page_token
            response = requests.get(url, headers=headers, params=params, timeout=10)
            if response.status_code != 200:
                raise Exception(f"Failed to list registrants (Status {response.status_code}): {response.text}")
            data = response.json()
            registrants.extend(data.get("registrants", []))
            next_page_token = data.get("next_page_token")
            if not next_page_token:
                break
        return registrants
    ```

#### 2. Performance: `/api/questions` Live Zoom API Request Bottleneck
* **File**: `web_server.py`, Lines 213-231
* **Observation**:
  The endpoint `/api/questions` handles registration form custom fields. It calls `zoom_service.get_custom_questions(meeting_id)` on every single page load.
* **Impact**:
  * Custom registration questions are not cached. Under high concurrency (e.g. hundreds of users opening the Telegram Mini App around the same time), the system will trigger identical blocking API requests to Zoom, causing heavy latency and triggering Zoom S2S API rate limit blocks.
* **Proposed Fix**: Read from the local settings database cache (`zoom_custom_questions`), which is refreshed during background sync, and fall back to the live API only if the cache is empty.
  ```python
  @app.get("/api/questions")
  def get_registration_questions(user: dict = Depends(get_telegram_user)):
      # Try fetching from DB settings cache first
      try:
          cached_qs = storage.get_setting("zoom_custom_questions")
          if cached_qs:
              return json.loads(cached_qs)
      except Exception as e:
          logger.warning(f"Failed to load questions from database cache: {e}")

      # Fallback to live Zoom API
      meeting_id = config.active_meeting_id
      if not meeting_id:
          return {"questions": [], "custom_questions": []}
      try:
          zoom_service = ZoomService()
          questions = zoom_service.get_custom_questions(meeting_id)
          storage.set_setting("zoom_custom_questions", json.dumps(questions))
          return questions
      except Exception as e:
          logger.warning(f"Failed to fetch Zoom custom questions: {e}")
          return {"questions": [], "custom_questions": []}
  ```

#### 3. UI Setting "zoom_sync_interval" is Inactive (No Background Loop)
* **File**: `web_server.py`, Line 1401 & 1434; `app.py`
* **Observation**:
  `zoom_sync_interval` (defaulting to "10 minutes") can be set via the Admin Settings Panel. However, the python code never initializes or runs any background scheduling thread or loop (`asyncio.create_task` or `apscheduler`) utilizing this value to trigger `sync_zoom_data()`.
* **Impact**: The database is never synced automatically in the background. If registrants approve or deny themselves directly inside Zoom, the system remains completely unaware and local database records remain stale until an administrator manually triggers a sync.
* **Proposed Fix**: Implement an asyncio background loop in `app.py` or `web_server.py` that schedules `sync_zoom_data` at the configured interval.

---

### 🟡 Medium Severity

#### 1. Insecure target="_blank" inside Telegram WebApp
* **File**: `public/app.js`, Lines 320, 1173, and 1180; `public/index.html`, Line 184
* **Observation**:
  Links for user profiles (e.g. `https://t.me/...`, `tg://user?id=...`) and Zoom registration/joining links use `target="_blank"`.
* **Impact**: Under Telegram WebApp environments, this causes the Telegram client to kick the user out of Telegram to open the link in the device's system browser, breaking the unified Mini App experience.
* **Proposed Fix**: Detect Telegram WebApp context and call `window.Telegram.WebApp.openLink(url)` or `window.Telegram.WebApp.openTelegramLink(url)` instead of raw HTML anchors.
  * *Example in `app.js` for Telegram links*:
    ```javascript
    if (tgUsername) {
        const a = document.createElement('a');
        a.href = '#';
        a.innerText = `@${tgUsername}`;
        a.onclick = (e) => {
            e.preventDefault();
            tg.openTelegramLink(`https://t.me/${tgUsername}`);
        };
        tgDiv.appendChild(a);
    }
    ```

#### 2. Missing Telegram BackButton Integration
* **File**: `public/app.js` and `public/index.html`
* **Observation**:
  The Mini App uses multi-level panel transitions (`switchPanelView('details')`, `switchPanelView('registrants')`) but does not bind or trigger `window.Telegram.WebApp.BackButton`.
* **Impact**: If a user clicks the physical back button on Android or the Telegram header back button, it closes the entire Mini App rather than going back one panel level.
* **Proposed Fix**:
  * Show `tg.BackButton` when `switchPanelView` changes to `details`, `registrants`, or `live`.
  * Hide `tg.BackButton` when navigating back to `home`.
  * Bind `tg.BackButton.onClick` to go back to the previous view.

#### 3. Misleading 404 Error on Unconfigured Userbot
* **File**: `web_server.py`, Lines 1264-1279
* **Observation**:
  If `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, or `TELEGRAM_SESSION_STRING` are not set, `userbot_service.client` is `None` (userbot disabled).
  The endpoint `/api/admin/lookup-username` directly calls `userbot_service.resolve_username`. Since the client is `None`, it returns `None`, which then raises:
  `HTTPException(status_code=404, detail="Username could not be resolved.")`
* **Impact**: Administrators receive a misleading 404 claiming the user does not exist, whereas the lookup system is actually offline due to missing configuration.
* **Proposed Fix**: Guard the endpoint and return `503 Service Unavailable` if the userbot service is unconfigured.
  ```python
  @app.get("/api/admin/lookup-username")
  async def lookup_telegram_username(username: str, admin_user = Depends(enforce_admin)):
      if not userbot_service.client:
          raise HTTPException(
              status_code=503,
              detail="Userbot lookup is not configured. Set environment variables on Render to enable this feature."
          )
      ...
  ```

#### 4. Thread Safety Risks on Concurrently Accessed SQLite Database
* **File**: `app.py` & `web_server.py`
* **Observation**:
  The application runs two separate threads with independent asyncio event loops:
  * Main thread: Telegram Bot polling (`Application.run_polling()`).
  * Background thread: FastAPI web server (`web_server.start_server`).
  Both threads read and write to the SQLite database `database.db` via `sqlite3.connect(DATABASE_PATH)`.
* **Impact**: Under concurrent write operations (e.g. webhook events + bot command updates), SQLite can throw `sqlite3.OperationalError: database is locked`. The system does not enable WAL (Write-Ahead Logging) mode, nor does it implement transaction retry loops.
* **Proposed Fix**:
  * Enable WAL mode on SQLite startup in `storage.py`:
    ```python
    conn.execute("PRAGMA journal_mode=WAL;")
    ```
  * Or implement retry handlers on connection locks.

---

### 🟡 Low Severity

#### 1. `escapeHtml` UI Crash Vulnerability
* **File**: `public/app.js`, Line 1971
* **Observation**:
  `escapeHtml` directly runs `.replace()` on the input parameter without checking if it is a valid string.
* **Impact**: If any field (like a custom question answer or meeting topic) is returned as `null`, `undefined`, or a numeric/boolean type, the function throws a TypeError, crashing the JavaScript execution and leaving the Mini App stuck on loading overlays.
* **Proposed Fix**: Coerce inputs to strings and handle null/undefined values.
  ```javascript
  function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
  }
  ```

#### 2. Redundant Service Instantiations
* **File**: `web_server.py` and `app.py`
* **Observation**:
  `ZoomService()` is instantiated 15+ times across the backend codebase rather than reusing a singleton instance.
* **Impact**: Although module-level caches in `zoom_service.py` prevent redundant S2S token acquisitions, this is poor practice and increases garbage collection overhead.
* **Proposed Fix**: Create a singleton instance at the module level of `zoom_service.py` and import it directly (similar to how `userbot_service` is exported in `userbot_service.py`).
  * In `zoom_service.py`:
    ```python
    zoom_service = ZoomService()
    ```
  * In `web_server.py` and `app.py`:
    ```python
    from zoom_service import zoom_service
    ```

#### 3. Wildcard CORS Configuration
* **File**: `web_server.py`, Lines 30-36
* **Observation**:
  The web server configures FastAPI's `CORSMiddleware` with `allow_origins=["*"]`.
* **Impact**: Although `allow_credentials=False` prevents standard credentials wildcard leakage, a wildcard origins header is still insecure for production deployments.
* **Proposed Fix**: Restrict `allow_origins` to specific domains (such as the Telegram WebApp domains and the server's own domain) or make it configurable via settings.
