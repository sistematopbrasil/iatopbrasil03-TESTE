
-- =============================================
-- PARTE 1: SEGURANCA - Extensao unaccent
-- =============================================

-- Criar schema extensions se não existir
CREATE SCHEMA IF NOT EXISTS extensions;

-- Mover extensão unaccent para schema extensions
ALTER EXTENSION unaccent SET SCHEMA extensions;

-- Recriar função generate_quiz_slug usando extensions.unaccent
CREATE OR REPLACE FUNCTION public.generate_quiz_slug(full_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 1;
  cleaned_name TEXT;
BEGIN
  cleaned_name := TRIM(COALESCE(full_name, 'consultor'));
  cleaned_name := regexp_replace(cleaned_name, E'[\\x00-\\x1F\\x7F\\u200B\\uFEFF]', '', 'g');
  cleaned_name := extensions.unaccent(cleaned_name);
  cleaned_name := lower(cleaned_name);
  base_slug := regexp_replace(cleaned_name, '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' OR base_slug IS NULL THEN
    base_slug := 'consultor';
  END IF;
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM users WHERE quiz_slug = final_slug) LOOP
    final_slug := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;
  RETURN final_slug;
END;
$function$;

-- Recriar função generate_unique_username usando extensions.unaccent
CREATE OR REPLACE FUNCTION public.generate_unique_username(full_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INT := 1;
  cleaned_name TEXT;
BEGIN
  cleaned_name := TRIM(COALESCE(full_name, 'consultor'));
  cleaned_name := regexp_replace(cleaned_name, E'[\\x00-\\x1F\\x7F\\u200B\\uFEFF]', '', 'g');
  cleaned_name := extensions.unaccent(cleaned_name);
  cleaned_name := lower(cleaned_name);
  base_username := regexp_replace(cleaned_name, '[^a-z0-9]+', '', 'g');
  IF base_username = '' OR base_username IS NULL THEN
    base_username := 'consultor';
  END IF;
  base_username := base_username || 'topbrasil';
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM users WHERE username = final_username) LOOP
    final_username := base_username || counter;
    counter := counter + 1;
  END LOOP;
  RETURN final_username;
END;
$function$;

-- =============================================
-- PARTE 2: SEGURANCA - Organizations RPC
-- =============================================

-- Criar RPC Security Definer para busca pública de organizações
CREATE OR REPLACE FUNCTION public.get_organization_public(p_slug text)
RETURNS TABLE(id uuid, name text, slug text, logo_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT o.id, o.name, o.slug, o.logo_url
  FROM public.organizations o
  WHERE o.slug = p_slug
    AND o.is_active = true
  LIMIT 1;
$function$;

-- Criar RPC para buscar org por ID (autenticado)
CREATE OR REPLACE FUNCTION public.get_organization_by_id(p_id uuid)
RETURNS TABLE(id uuid, name text, slug text, logo_url text, whatsapp_number text, meta_pixel_id text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT o.id, o.name, o.slug, o.logo_url, o.whatsapp_number, o.meta_pixel_id
  FROM public.organizations o
  WHERE o.id = p_id
    AND o.is_active = true
  LIMIT 1;
$function$;

-- Remover a policy pública permissiva de organizations
DROP POLICY IF EXISTS "Public can read active organizations by slug" ON public.organizations;

-- =============================================
-- PARTE 3: SEGURANCA - Policies TO authenticated
-- =============================================

-- crm_conversations: recriar SELECT policy com TO authenticated
DROP POLICY IF EXISTS "Users can view own conversations" ON public.crm_conversations;
CREATE POLICY "Users can view own conversations"
  ON public.crm_conversations FOR SELECT
  TO authenticated
  USING ((user_id = get_current_consultant_id()) OR is_super_admin());

-- crm_messages: recriar SELECT policy com TO authenticated
DROP POLICY IF EXISTS "Users can view messages from own conversations" ON public.crm_messages;
CREATE POLICY "Users can view messages from own conversations"
  ON public.crm_messages FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM crm_conversations
    WHERE crm_conversations.id = crm_messages.conversation_id
    AND (crm_conversations.user_id = get_current_consultant_id() OR is_super_admin())
  ));

-- tracking_sessions: recriar SELECT policy com TO authenticated
DROP POLICY IF EXISTS "Users can view tracking in their organization" ON public.tracking_sessions;
CREATE POLICY "Users can view tracking in their organization"
  ON public.tracking_sessions FOR SELECT
  TO authenticated
  USING (organization_id = get_user_organization_id());

-- crm_notes: recriar ALL policy com TO authenticated
DROP POLICY IF EXISTS "Users can manage own notes" ON public.crm_notes;
CREATE POLICY "Users can manage own notes"
  ON public.crm_notes FOR ALL
  TO authenticated
  USING (user_id = get_current_consultant_id());

-- crm_tags: recriar ALL policy com TO authenticated
DROP POLICY IF EXISTS "Users can manage own tags" ON public.crm_tags;
CREATE POLICY "Users can manage own tags"
  ON public.crm_tags FOR ALL
  TO authenticated
  USING ((user_id = get_current_consultant_id()) OR is_super_admin());

-- crm_quick_replies: recriar ALL policy com TO authenticated
DROP POLICY IF EXISTS "Users can manage own quick replies" ON public.crm_quick_replies;
CREATE POLICY "Users can manage own quick replies"
  ON public.crm_quick_replies FOR ALL
  TO authenticated
  USING ((user_id = get_current_consultant_id()) OR is_super_admin());

-- ai_agent_configs: recriar policies com TO authenticated
DROP POLICY IF EXISTS "Users can manage own AI config" ON public.ai_agent_configs;
CREATE POLICY "Users can manage own AI config"
  ON public.ai_agent_configs FOR ALL
  TO authenticated
  USING (user_id = get_current_consultant_id());

DROP POLICY IF EXISTS "Super admin can view all AI configs" ON public.ai_agent_configs;
CREATE POLICY "Super admin can view all AI configs"
  ON public.ai_agent_configs FOR SELECT
  TO authenticated
  USING (is_super_admin());

DROP POLICY IF EXISTS "Super admin can update all AI configs" ON public.ai_agent_configs;
CREATE POLICY "Super admin can update all AI configs"
  ON public.ai_agent_configs FOR UPDATE
  TO authenticated
  USING (is_super_admin());

-- ai_conversation_state: recriar policy com TO authenticated
DROP POLICY IF EXISTS "Users can manage own AI conversation state" ON public.ai_conversation_state;
CREATE POLICY "Users can manage own AI conversation state"
  ON public.ai_conversation_state FOR ALL
  TO authenticated
  USING (user_id = get_current_consultant_id());
