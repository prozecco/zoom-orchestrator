
-- 1) Status enum expansion
ALTER TABLE public.registrants DROP CONSTRAINT IF EXISTS registrants_status_check;
UPDATE public.registrants SET status = 'denied' WHERE status = 'rejected';
ALTER TABLE public.registrants
  ADD CONSTRAINT registrants_status_check
  CHECK (status = ANY (ARRAY['pending','on_hold','approved','denied','cancelled','attended']));

ALTER TABLE public.registrants
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- 2) Notes table
CREATE TABLE IF NOT EXISTS public.registrant_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registrant_id uuid NOT NULL REFERENCES public.registrants(id) ON DELETE CASCADE,
  author_tg_id bigint,
  author_name text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS registrant_notes_reg_idx ON public.registrant_notes(registrant_id, created_at DESC);

GRANT SELECT ON public.registrant_notes TO authenticated, anon;
GRANT ALL ON public.registrant_notes TO service_role;

ALTER TABLE public.registrant_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "registrant_notes_read_all" ON public.registrant_notes FOR SELECT USING (true);

CREATE TRIGGER registrant_notes_touch
  BEFORE UPDATE ON public.registrant_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.registrant_notes;
