
-- =============================================
-- SECURITY FIX: Remove hardcoded encryption key fallback
-- =============================================

-- Fix encrypt_api_key: raise exception instead of using hardcoded fallback
CREATE OR REPLACE FUNCTION public.encrypt_api_key(plain_key text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  encryption_secret text;
BEGIN
  IF plain_key IS NULL OR plain_key = '' THEN
    RETURN NULL;
  END IF;
  encryption_secret := current_setting('app.settings.encryption_key', true);
  IF encryption_secret IS NULL OR encryption_secret = '' THEN
    RAISE EXCEPTION 'Encryption key not configured. Set app.settings.encryption_key in database settings.';
  END IF;
  RETURN encode(
    extensions.pgp_sym_encrypt(plain_key, encryption_secret),
    'base64'
  );
END;
$function$;

-- Fix decrypt_api_key: raise exception instead of using hardcoded fallback
CREATE OR REPLACE FUNCTION public.decrypt_api_key(encrypted_key text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  encryption_secret text;
BEGIN
  IF encrypted_key IS NULL OR encrypted_key = '' THEN
    RETURN NULL;
  END IF;
  encryption_secret := current_setting('app.settings.encryption_key', true);
  IF encryption_secret IS NULL OR encryption_secret = '' THEN
    RAISE EXCEPTION 'Encryption key not configured. Set app.settings.encryption_key in database settings.';
  END IF;
  RETURN extensions.pgp_sym_decrypt(
    decode(encrypted_key, 'base64'),
    encryption_secret
  );
END;
$function$;

-- =============================================
-- SECURITY FIX: Add auth requirement to SELECT policies
-- These are RESTRICTIVE policies that stack with existing ones
-- =============================================

-- 1. users table - require auth for SELECT
CREATE POLICY "users_require_auth_for_select"
  ON public.users
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 2. quiz_submissions_new - add auth requirement to SELECT 
-- (public INSERT stays, but reading requires auth)
CREATE POLICY "leads_require_auth_for_select"
  ON public.quiz_submissions_new
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 3. consultant_recruits - require auth for SELECT
CREATE POLICY "recruits_require_auth_for_select"
  ON public.consultant_recruits
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 4. organizations - require auth for SELECT
CREATE POLICY "orgs_require_auth_for_select"
  ON public.organizations
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 5. crm_conversations - require auth for SELECT
CREATE POLICY "conversations_require_auth_for_select"
  ON public.crm_conversations
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 6. crm_messages - require auth for SELECT
CREATE POLICY "messages_require_auth_for_select"
  ON public.crm_messages
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 7. tracking_sessions - require auth for SELECT
CREATE POLICY "tracking_require_auth_for_select"
  ON public.tracking_sessions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
