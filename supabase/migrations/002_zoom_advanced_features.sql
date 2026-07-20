-- =============================================================================
-- Migration 002: Advanced Zoom Integration Features
-- Tables: zoom_registration_questions, identity_change_log, member_id_configs,
--         attendance_target_roster, meeting_attendance_logs,
--         chat_media_attachments, chat_message_reactions
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend existing tables
-- ---------------------------------------------------------------------------

-- Extend telegram_users with Zoom profile mapping and Member ID
ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS zoom_user_id text DEFAULT NULL;
ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS zoom_email text DEFAULT NULL;
ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS member_id text UNIQUE DEFAULT NULL;

-- Extend meeting_participants for cached responses, personal join URL, flags & tracking toggle
ALTER TABLE meeting_participants ADD COLUMN IF NOT EXISTS registration_responses jsonb DEFAULT NULL;
ALTER TABLE meeting_participants ADD COLUMN IF NOT EXISTS zoom_join_url text DEFAULT NULL;
ALTER TABLE meeting_participants ADD COLUMN IF NOT EXISTS flags jsonb DEFAULT '[]'::jsonb;
ALTER TABLE meeting_participants ADD COLUMN IF NOT EXISTS is_attendance_enabled boolean DEFAULT true;

-- ---------------------------------------------------------------------------
-- 2. zoom_registration_questions — Cached meeting registration forms
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS zoom_registration_questions (
  meeting_id           text PRIMARY KEY,
  questions_json       jsonb NOT NULL,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. member_id_configs — Pattern & Reserved Ranges Configuration
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS member_id_configs (
  id                integer PRIMARY KEY DEFAULT 1,
  pattern_template  text NOT NULL DEFAULT 'MBR-{YYYY}-{SEQ:4}',
  current_sequence  integer NOT NULL DEFAULT 101,
  reserved_ranges   jsonb DEFAULT '[{"start": 1, "end": 100}]'::jsonb,
  assignment_mode   text NOT NULL DEFAULT 'auto', -- 'auto' or 'manual'
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Seed initial config if not exists
INSERT INTO member_id_configs (id, pattern_template, current_sequence, reserved_ranges, assignment_mode)
VALUES (1, 'MBR-{YYYY}-{SEQ:4}', 101, '[{"start": 1, "end": 100}]'::jsonb, 'auto')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. identity_change_log — Identity Resolution Audit Trail
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS identity_change_log (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  telegram_id     bigint NOT NULL,
  change_type     text NOT NULL,  -- 'email_change', 'name_change', 'account_transfer', 'admin_override'
  old_value       jsonb,
  new_value       jsonb,
  reason          text,
  changed_by      text DEFAULT 'system',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_identity_log_telegram ON identity_change_log (telegram_id);

-- ---------------------------------------------------------------------------
-- 5. attendance_target_roster — Tracked Attendees Selection per Meeting
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_target_roster (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  meeting_id    text NOT NULL,
  telegram_id   bigint REFERENCES telegram_users (telegram_id),
  zoom_email    text NOT NULL,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_roster_meeting ON attendance_target_roster (meeting_id);

-- ---------------------------------------------------------------------------
-- 6. meeting_attendance_logs — Detailed Join/Leave Sessions & Duration
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meeting_attendance_logs (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  meeting_id          text NOT NULL,
  telegram_id         bigint REFERENCES telegram_users (telegram_id),
  zoom_email          text NOT NULL,
  join_count          integer DEFAULT 0,
  sessions_detail     jsonb DEFAULT '[]'::jsonb, -- [{"join": "...", "leave": "...", "duration_min": 45}]
  total_duration_min  integer DEFAULT 0,
  attended_percentage numeric(5,2) DEFAULT 0.00,
  is_qualified        boolean DEFAULT false,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_meeting ON meeting_attendance_logs (meeting_id);

-- ---------------------------------------------------------------------------
-- 7. chat_media_attachments — Uploaded Media & Files
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_media_attachments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      uuid REFERENCES messages (id) ON DELETE CASCADE,
  telegram_id     bigint NOT NULL REFERENCES telegram_users (telegram_id),
  file_name       text NOT NULL,
  file_type       text NOT NULL,
  file_size       bigint NOT NULL,
  storage_path    text NOT NULL,
  zoom_file_id    text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 8. chat_message_reactions — Emoji Reactions on Chat Messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_message_reactions (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message_id      uuid NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  telegram_id     bigint NOT NULL REFERENCES telegram_users (telegram_id),
  emoji_code      text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, telegram_id, emoji_code)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message ON chat_message_reactions (message_id);

-- ---------------------------------------------------------------------------
-- 9. Row Level Security (RLS)
-- ---------------------------------------------------------------------------
ALTER TABLE zoom_registration_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_id_configs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_change_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_target_roster     ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendance_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_media_attachments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_message_reactions      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon full access to zoom_registration_questions"
  ON zoom_registration_questions FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon full access to member_id_configs"
  ON member_id_configs FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon full access to identity_change_log"
  ON identity_change_log FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon full access to attendance_target_roster"
  ON attendance_target_roster FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon full access to meeting_attendance_logs"
  ON meeting_attendance_logs FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon full access to chat_media_attachments"
  ON chat_media_attachments FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon full access to chat_message_reactions"
  ON chat_message_reactions FOR ALL TO anon USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 10. Enable Realtime for reactions and attendance updates
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE chat_message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE meeting_attendance_logs;
