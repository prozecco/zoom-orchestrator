-- =============================================================================
-- Migration: Create core tables for Telegram Mini App
-- Tables: telegram_users, contacts, conversations, conversation_members,
--         messages, meeting_participants
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
CREATE TYPE conversation_type AS ENUM ('direct', 'meeting_central', 'meeting_private');
CREATE TYPE participant_status AS ENUM ('registered', 'approved', 'rejected', 'joined', 'left');

-- ---------------------------------------------------------------------------
-- 2. telegram_users — Raw data from Telegram initDataUnsafe.user
-- ---------------------------------------------------------------------------
CREATE TABLE telegram_users (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id     bigint NOT NULL UNIQUE,
  first_name      text NOT NULL,
  last_name       text,
  username        text,
  language_code   text,
  is_bot          boolean NOT NULL DEFAULT false,
  is_premium      boolean NOT NULL DEFAULT false,
  added_to_attachment_menu boolean NOT NULL DEFAULT false,
  allows_write_to_pm       boolean NOT NULL DEFAULT true,
  photo_url       text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_users_username ON telegram_users (username);

-- ---------------------------------------------------------------------------
-- 3. contacts — User-to-user contact list (bidirectional Add Contact)
-- ---------------------------------------------------------------------------
CREATE TABLE contacts (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_telegram_id      bigint NOT NULL REFERENCES telegram_users (telegram_id),
  contact_telegram_id   bigint NOT NULL REFERENCES telegram_users (telegram_id),
  nickname              text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_telegram_id, contact_telegram_id),
  CHECK (user_telegram_id <> contact_telegram_id)
);

CREATE INDEX idx_contacts_user ON contacts (user_telegram_id);

-- ---------------------------------------------------------------------------
-- 4. conversations — Chat rooms (3 types)
-- ---------------------------------------------------------------------------
CREATE TABLE conversations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type        conversation_type NOT NULL,
  meeting_id  text,               -- Zoom meeting ID (null for direct chats)
  title       text,               -- Display name for meeting chats
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_meeting ON conversations (meeting_id) WHERE meeting_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. conversation_members — Who is in which conversation
-- ---------------------------------------------------------------------------
CREATE TABLE conversation_members (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id   uuid NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  telegram_id       bigint NOT NULL REFERENCES telegram_users (telegram_id),
  joined_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, telegram_id)
);

CREATE INDEX idx_conv_members_telegram ON conversation_members (telegram_id);

-- ---------------------------------------------------------------------------
-- 6. messages — Chat messages
-- ---------------------------------------------------------------------------
CREATE TABLE messages (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id       uuid NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  sender_telegram_id    bigint NOT NULL REFERENCES telegram_users (telegram_id),
  content               text NOT NULL,
  media_url             text DEFAULT NULL,
  media_type            text DEFAULT NULL,
  is_view_once          boolean NOT NULL DEFAULT false,
  view_once_seen        boolean NOT NULL DEFAULT false,
  expires_at            timestamptz DEFAULT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- 7. meeting_participants — Tracks registration & join status per meeting
-- ---------------------------------------------------------------------------
CREATE TABLE meeting_participants (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id    text NOT NULL,        -- Zoom meeting ID
  telegram_id   bigint NOT NULL REFERENCES telegram_users (telegram_id),
  status        participant_status NOT NULL DEFAULT 'registered',
  joined_at     timestamptz,
  left_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, telegram_id)
);

CREATE INDEX idx_participants_meeting ON meeting_participants (meeting_id);
CREATE INDEX idx_participants_telegram ON meeting_participants (telegram_id);

-- ---------------------------------------------------------------------------
-- 8. Row Level Security (RLS)
-- ---------------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE telegram_users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;

-- For now, allow all authenticated access (Mini App uses anon key with custom verification).
-- In production, replace these with tighter policies based on telegram_id claims.
CREATE POLICY "Allow anon full access to telegram_users"
  ON telegram_users FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon full access to contacts"
  ON contacts FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon full access to conversations"
  ON conversations FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon full access to conversation_members"
  ON conversation_members FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon full access to messages"
  ON messages FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon full access to meeting_participants"
  ON meeting_participants FOR ALL TO anon USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 9. Auto-update updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_telegram_users_updated_at
  BEFORE UPDATE ON telegram_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_meeting_participants_updated_at
  BEFORE UPDATE ON meeting_participants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 9b. Shared conversation helper RPC function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_shared_conversation(
  p_type conversation_type,
  p_user1 bigint,
  p_user2 bigint,
  p_meeting_id text DEFAULT NULL
)
RETURNS TABLE (conversation_id uuid) AS $$
BEGIN
  RETURN QUERY
  SELECT cm1.conversation_id
  FROM conversation_members cm1
  JOIN conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
  JOIN conversations c ON cm1.conversation_id = c.id
  WHERE c.type = p_type
    AND cm1.telegram_id = p_user1
    AND cm2.telegram_id = p_user2
    AND (p_meeting_id IS NULL OR c.meeting_id = p_meeting_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ---------------------------------------------------------------------------
-- 10. Enable Realtime for chat messages
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
