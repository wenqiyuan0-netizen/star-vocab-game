-- ============================================
-- Security hardening (2026-11-22)
-- Addresses Supabase security advisor findings. No tables or user data are touched.
-- ============================================

-- 1. Remove dev-only debug RPCs (listening mode was removed from the client).
--    Originals live in 20251220_debug_tools.sql if ever needed again.
DROP FUNCTION IF EXISTS public.debug_add_balance(integer);
DROP FUNCTION IF EXISTS public.debug_force_expire_challenge();
DROP FUNCTION IF EXISTS public.debug_reset_penalty();

-- 2. Trigger function must not be callable over /rest/v1/rpc.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 3. XP writes require a signed-in user.
REVOKE EXECUTE ON FUNCTION public.add_xp(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_xp(integer, integer) TO authenticated;

-- 4. Pin search_path on every remaining public function (prevents search_path hijacking).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e') -- skip extension functions
      AND (p.proconfig IS NULL OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'))
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions, pg_temp', r.sig);
  END LOOP;
END $$;

-- 5. Listening mode was removed from the client; keep the RPC for signed-in users only.
REVOKE EXECUTE ON FUNCTION public.check_listening_challenge_expiry() FROM PUBLIC, anon;

-- Intentionally kept:
--  * check_username_exists: needed by the sign-up form (anon) to check nickname availability.
--  * add_xp: SECURITY DEFINER with server-side validation, scoped to auth.uid().
-- Manual (dashboard): enable Auth → Leaked password protection.
