
This is a big integration touching backend, auth, and four separate surfaces. Here is the plan I'll execute end-to-end.

## 1. Lovable Cloud + schema

Enable Lovable Cloud and add these tables (with RLS + grants):

- `admins` — `telegram_id bigint pk`. Seeded with `6255415226`.
- `meetings` — mirrors Zoom meeting (`zoom_id`, topic, host, host_email, start_time, duration_min, join_url, passcode, capacity, status, is_active, raw jsonb, synced_at). One row flagged `is_active`.
- `registrants` — `id`, `meeting_id`, `telegram_id`, `telegram_user`, `name`, `email`, `phone`, `status` (`pending|approved|rejected|attended`), `registered_at`.
- `messages` — `id`, `meeting_id`, `registrant_id` (null for admin broadcasts / admin thread), `from_role` (`host|attendee`), `from_name`, `text`, `telegram_message_id`, `created_at`. Chat is per-registrant (1:1 thread with host).
- `audit_log` — actor, action, target, at.

## 2. Zoom S2S integration

- Secrets: `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_ACCOUNT_ID`, `ZOOM_MEETING_ID` (default `83483016779`).
- Server helper `src/lib/zoom.server.ts`: OAuth token cache + `getMeeting(id)` + `listUpcomingMeetings(userId?)`.
- Server functions in `src/lib/zoom.functions.ts`:
  - `syncActiveMeeting()` — fetch `ZOOM_MEETING_ID`, upsert into `meetings` as `is_active`.
  - `listMeetings()` — reads from DB (cached).
  - `getActiveMeeting()` — reads active row.
- Admin Schedule + Details screens read from these via TanStack Query; a "Sync from Zoom" button triggers `syncActiveMeeting`.

## 3. Telegram bot + role routing

- Connect Telegram connector (gateway) — you'll pick the bot connection.
- Public webhook `src/routes/api/public/telegram/webhook.ts` with `X-Telegram-Bot-Api-Secret-Token` derived from `TELEGRAM_API_KEY`.
- Register webhook + BotFather Mini App URL via one-off gateway call.
- Handlers:
  - `/start` → checks `admins` table. If admin → reply with inline `web_app` button opening `${PUBLIC_URL}/admin`. Else → button opening `${PUBLIC_URL}/app`.
  - `/help`, `/active`, `/setmeeting <id>` (admin only) → maps to `syncActiveMeeting`.
  - Any other text message from a registered attendee → inserts into `messages` for their thread; from admin (reply) → inserted as host message and forwarded to that attendee via `sendMessage`.
- Mini App receives Telegram initData through `window.Telegram.WebApp.initDataUnsafe`; a server fn `resolveViewer` validates the initData HMAC with the bot token and returns `{ role, telegramId, name }`. `/` landing route uses this to redirect (admin→`/admin`, user→`/app`); falls back to manual toggle when opened outside Telegram.

## 4. Registration pipeline

- `submitRegistration` server fn: takes form fields + viewer's telegram id, inserts `registrants` row (status `pending`) tied to active meeting, writes audit entry, notifies admin group `-1004310551647` via Telegram.
- `/app/` form calls it via `useMutation`; on success routes to `/app/status` which polls the viewer's registrant row.
- Admin `/admin/registrants` lists live rows; Approve/Reject call `updateRegistrantStatus` server fn → updates DB, audit entry, and DMs the attendee via Telegram.

## 5. Live chat (1:1 threads)

- Admin `/admin/live` gets a left-hand list of approved/attended registrants → selecting one opens their thread. Sends go through `sendChatMessage` server fn which inserts a `messages` row and pushes via Telegram `sendMessage` to that attendee's chat.
- User `/app/chat` shows only that attendee's thread with the host; input calls same server fn tagged as attendee.
- Incoming Telegram messages (webhook) resolve `telegram_id → registrant` and insert into the same thread; UI polls every 3s via TanStack Query (`refetchInterval`) — no realtime dep needed.

## 6. UI cleanup / bugs

- Replace all `Date.toLocaleString()` in route bodies with a stable `formatDate` util (fixed `en-US`, `UTC`) to fix the current SSR hydration mismatch on `/admin/schedule`.
- Swap `src/lib/mock-data.ts` consumers over to live queries; delete the file once unused.

## 7. Secrets you'll be prompted for

After you approve this plan I'll:
1. Enable Lovable Cloud (creates DB).
2. Ask you to link the **Telegram** connector.
3. Open a secure form for the Zoom secrets (`ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_ACCOUNT_ID`, `ZOOM_MEETING_ID`).

## Technical notes

- Cloudflare Worker runtime: all Zoom + Telegram calls use `fetch`; no Node-only deps.
- Telegram initData verification uses Web Crypto HMAC-SHA256 in a server fn.
- `messages` polling uses TanStack Query `refetchInterval: 3000` while a thread is open; cheap and Worker-friendly.
- Admin identity is hardcoded via `admins` table seeded with `6255415226`; add/remove by SQL migration later.

Approve and I'll start with Cloud + Telegram connector, then Zoom secrets.
