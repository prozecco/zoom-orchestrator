
DROP POLICY IF EXISTS "registrants_insert_all" ON public.registrants;
DROP POLICY IF EXISTS "messages_insert_all" ON public.messages;
REVOKE INSERT ON public.registrants FROM anon, authenticated;
REVOKE INSERT ON public.messages FROM anon, authenticated;
