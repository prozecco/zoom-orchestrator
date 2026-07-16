
-- meetings
CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zoom_id TEXT UNIQUE NOT NULL,
  topic TEXT NOT NULL,
  host TEXT,
  host_email TEXT,
  start_time TIMESTAMPTZ,
  duration_min INT,
  join_url TEXT,
  passcode TEXT,
  capacity INT DEFAULT 100,
  status TEXT DEFAULT 'scheduled',
  is_active BOOLEAN DEFAULT false,
  raw JSONB,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX meetings_only_one_active ON public.meetings (is_active) WHERE is_active = true;
GRANT SELECT ON public.meetings TO anon, authenticated;
GRANT ALL ON public.meetings TO service_role;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meetings_read_all" ON public.meetings FOR SELECT USING (true);

-- registrants
CREATE TABLE public.registrants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
  telegram_id BIGINT,
  telegram_user TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','attended')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX registrants_meeting_idx ON public.registrants(meeting_id);
CREATE INDEX registrants_tg_idx ON public.registrants(telegram_id);
GRANT SELECT, INSERT ON public.registrants TO anon, authenticated;
GRANT ALL ON public.registrants TO service_role;
ALTER TABLE public.registrants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "registrants_read_all" ON public.registrants FOR SELECT USING (true);
CREATE POLICY "registrants_insert_all" ON public.registrants FOR INSERT WITH CHECK (true);

-- messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
  registrant_id UUID REFERENCES public.registrants(id) ON DELETE CASCADE,
  from_role TEXT NOT NULL CHECK (from_role IN ('host','attendee')),
  from_name TEXT NOT NULL,
  text TEXT NOT NULL,
  telegram_message_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_registrant_idx ON public.messages(registrant_id, created_at);
GRANT SELECT, INSERT ON public.messages TO anon, authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_read_all" ON public.messages FOR SELECT USING (true);
CREATE POLICY "messages_insert_all" ON public.messages FOR INSERT WITH CHECK (true);

-- audit_log
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO anon, authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_read_all" ON public.audit_log FOR SELECT USING (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER meetings_touch BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER registrants_touch BEFORE UPDATE ON public.registrants FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- realtime for messages + registrants
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.registrants;

-- Seed the active meeting placeholder (will be overwritten by Zoom sync)
INSERT INTO public.meetings (zoom_id, topic, host, is_active, status)
VALUES ('83483016779', 'Weekly Strategy Sync', 'Elena Ross', true, 'live')
ON CONFLICT (zoom_id) DO NOTHING;
