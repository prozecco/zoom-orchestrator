-- =============================================================================
-- Migration: Enable Supabase Realtime for Registrants
-- Run this in Supabase SQL Editor if not already enabled
-- =============================================================================

-- 1. Ensure the realtime publication exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

-- 2. Add registrants table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.registrants;

-- 3. Verify (should show 'registrants' in the list)
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- 4. Optional: Add meetings table for live meeting updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;

-- 5. Enable RLS select for anon on registrants (required for Realtime to work with anon key)
-- This should already exist from your initial migration, but verify:
CREATE POLICY IF NOT EXISTS "registrants_read_all" ON public.registrants FOR SELECT USING (true);

-- 6. Grant usage on realtime schema (for Supabase JS client)
GRANT USAGE ON SCHEMA realtime TO anon, authenticated;
