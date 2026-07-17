
## Phase 1 — Registrants overhaul (build now)

### 1.1 Schema (single migration)
- Add `registrants.status` values: extend to `pending | on_hold | approved | denied | cancelled | attended`. Backfill `rejected` → `denied`.
- Add `registrants.cancelled_at timestamptz null`.
- New table `public.registrant_notes` — fields: `registrant_id`, `author_tg_id bigint`, `author_name`, `body text`, timestamps. RLS: read-all (admin surface only), writes via service role from server fns. GRANTs to authenticated + service_role.
- New view (or server-side aggregation) `registrant_history` keyed by normalized email + telegram_id:
  - `prior_count` (previous registrations by same email or telegram_id)
  - `past_meetings` (topic + status + registered_at)
  - `name_variants`, `handle_variants` (distinct historical values)
- Realtime: add `registrant_notes` to `supabase_realtime` publication.

### 1.2 Server functions (`src/lib/registrants.functions.ts` + new `registrant-notes.functions.ts`)
- `groupedRegistrants()` returns `{ pending, on_hold, approved, denied, cancelled, attended }`.
  - Bucket rule: `pending` if `status='pending' AND age(registered_at) <= 3 days`; else `on_hold`.
  - Automatic promotion happens at read time (no cron needed); optional `promoteStaleToOnHold()` admin action to persist.
- `getRegistrantDetail({ id })` returns registrant + meeting + `history` + `notes`.
- `addRegistrantNote({ registrantId, body, actorTelegramId })` — admin-gated.
- Extend `updateRegistrantStatus` to accept `on_hold | cancelled` and log to audit.

### 1.3 UI — `src/routes/admin.registrants.tsx`
Two-pane layout:
- Left: tabbed groups (Pending ≤3d · On hold >3d · Approved · Denied · Cancelled · Attended) with counts; search across all groups; row click opens the card.
- Right: **Registrant card** (Sheet on mobile, side panel on desktop):
  - Header: name, handle, email, phone, current status badge, quick actions (Approve / Deny / On hold / Cancel).
  - History block: prior registrations count, past meetings list, name/handle change history.
  - Notes: timeline of admin notes with author + timestamp; composer to add a note (realtime).

### 1.4 Attendee-side
- `/app/status` gains a "Cancel my registration" button → sets `status='cancelled'`.

---

## Phase 2 — Chat overhaul (after Phase 1 lands)

### 2.1 Message model
Add `messages.channel enum('dm' | 'meeting_1to1' | 'meeting_central')` and `messages.source enum('web' | 'telegram' | 'zoom')`. Backfill existing rows → `dm` / current source.

### 2.2 Zoom in-meeting chat via API
- Extend Zoom S2S scopes needed: `chat_message:read:admin`, `chat_message:write:admin`, `meeting:read:admin` (user confirms scopes in Zoom Marketplace).
- Poll endpoint `GET /chat/users/{hostId}/messages?to_contact=...` for 1:1 in-meeting; `GET /metrics/meetings/{id}/participants/qos` fallback for central chat is not available — central chat requires **Zoom Meeting Chat via Events**, so we'll subscribe to `meeting.chat_message_sent` webhook.
- New route `src/routes/api/public/zoom/webhook.ts` — signature-verified (`ZOOM_WEBHOOK_SECRET_TOKEN` via `add_secret`) — writes chat + participant events into DB.

### 2.3 Participants (Zoom webhooks)
- Subscribe events: `meeting.participant_joined`, `meeting.participant_left`, `meeting.started`, `meeting.ended`.
- New table `public.meeting_participants` (`meeting_id`, `zoom_user_id`, `name`, `email`, `joined_at`, `left_at`, `registrant_id nullable`).
- Match to registrant by email (case-insensitive) on join.

### 2.4 UI
- `/admin/live`: three tabs — **Central chat** (whole meeting) · **1:1 in-meeting** (per participant) · **DMs** (per registrant, outside meeting). Participants panel driven by `meeting_participants` filtered to `left_at IS NULL`.
- `/app/chat`: two tabs — **DM host** (current behavior) and **In-meeting chat** (visible only while user is a live participant).

---

## Technical notes

- Bucketing uses `now() - registered_at > interval '3 days'` in SQL; UI shows the boundary date.
- History aggregation is a server-side SQL query, not a materialized view, so it stays live without refresh.
- Notes and status changes both write to `audit_log`.
- All new tables get `GRANT` + RLS with policies scoped to server-role writes; admin identity is enforced in server fns via `isAdminId(actorTelegramId)`, matching existing pattern.
- Zoom webhook uses the standard "URL validation" handshake — the route must respond to `endpoint.url_validation` events; secret stored via `add_secret` (shared secret flow).

I'll start on Phase 1 as soon as you approve.
