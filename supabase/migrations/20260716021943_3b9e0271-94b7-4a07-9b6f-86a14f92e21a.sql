
DROP POLICY IF EXISTS "registrants_insert_all" ON public.registrants;
DROP POLICY IF EXISTS "registrant_messages_insert_all" ON public.registrant_messages;
REVOKE INSERT ON public.registrants FROM anon, authenticated;
REVOKE INSERT ON public.registrant_messages FROM anon, authenticated;
