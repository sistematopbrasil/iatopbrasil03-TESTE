
-- =========================================================
-- 1) BIO PAGES (Link na Bio)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.bio_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  is_published boolean NOT NULL DEFAULT true,
  theme jsonb NOT NULL DEFAULT '{
    "preset": "topbrasil",
    "background": {"type": "solid", "color": "#0D0D0D", "pattern": "dots"},
    "card_color": "#161616",
    "text_color": "#FFFFFF",
    "muted_color": "#A1A1AA",
    "accent_color": "#EB6608",
    "button_style": "soft",
    "button_fill": "solid",
    "button_shadow": "soft",
    "font": "inter"
  }'::jsonb,
  header jsonb NOT NULL DEFAULT '{
    "logo_url": null,
    "avatar_url": null,
    "name": "",
    "name_accent_word_index": 1,
    "bio": "",
    "show_socials_inline": false
  }'::jsonb,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bio_pages_org ON public.bio_pages(organization_id);

ALTER TABLE public.bio_pages ENABLE ROW LEVEL SECURITY;

-- Owner CRUD
CREATE POLICY "bio_pages owner select" ON public.bio_pages
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_consultant_id());

CREATE POLICY "bio_pages owner insert" ON public.bio_pages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = public.get_current_consultant_id()
    AND organization_id = public.get_user_organization_id()
  );

CREATE POLICY "bio_pages owner update" ON public.bio_pages
  FOR UPDATE TO authenticated
  USING (user_id = public.get_current_consultant_id())
  WITH CHECK (user_id = public.get_current_consultant_id());

CREATE POLICY "bio_pages owner delete" ON public.bio_pages
  FOR DELETE TO authenticated
  USING (user_id = public.get_current_consultant_id());

-- Super admin full access (within org)
CREATE POLICY "bio_pages super_admin all" ON public.bio_pages
  FOR ALL TO authenticated
  USING (public.is_super_admin() AND organization_id = public.get_user_organization_id())
  WITH CHECK (public.is_super_admin() AND organization_id = public.get_user_organization_id());

CREATE TRIGGER trg_bio_pages_updated_at
  BEFORE UPDATE ON public.bio_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 2) BIO CLICKS (analytics)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.bio_clicks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bio_page_id uuid NOT NULL REFERENCES public.bio_pages(id) ON DELETE CASCADE,
  block_id text NOT NULL,
  clicked_at timestamptz NOT NULL DEFAULT now(),
  user_agent_hash text
);
CREATE INDEX IF NOT EXISTS idx_bio_clicks_page ON public.bio_clicks(bio_page_id, clicked_at DESC);

ALTER TABLE public.bio_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bio_clicks owner select" ON public.bio_clicks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bio_pages bp
      WHERE bp.id = bio_clicks.bio_page_id
        AND bp.user_id = public.get_current_consultant_id()
    )
  );

-- (inserts feitos via SECURITY DEFINER track_bio_click; nenhuma policy de INSERT pública)

-- =========================================================
-- 3) Public RPCs for bio
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_bio_by_slug(p_slug text)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  username text,
  profile_photo text,
  is_published boolean,
  theme jsonb,
  header jsonb,
  blocks jsonb,
  seo jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bp.id, u.id AS user_id, u.full_name, u.username, u.profile_photo,
         bp.is_published, bp.theme, bp.header, bp.blocks, bp.seo
  FROM public.users u
  JOIN public.bio_pages bp ON bp.user_id = u.id
  WHERE u.username = p_slug
    AND u.is_active = true
    AND bp.is_published = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_bio_by_slug(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.track_bio_click(p_bio_page_id uuid, p_block_id text, p_ua_hash text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_bio_page_id IS NULL OR p_block_id IS NULL OR length(p_block_id) > 100 THEN
    RETURN;
  END IF;
  INSERT INTO public.bio_clicks (bio_page_id, block_id, user_agent_hash)
  SELECT p_bio_page_id, p_block_id, NULLIF(left(p_ua_hash, 64), '')
  WHERE EXISTS (SELECT 1 FROM public.bio_pages WHERE id = p_bio_page_id AND is_published = true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_bio_click(uuid, text, text) TO anon, authenticated;

-- =========================================================
-- 4) Bio assets storage bucket
-- =========================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('bio-assets', 'bio-assets', true, 10485760)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit;

-- Public read (paths convention: <user_id>/<filename>)
DROP POLICY IF EXISTS "bio-assets public read" ON storage.objects;
CREATE POLICY "bio-assets public read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'bio-assets');

DROP POLICY IF EXISTS "bio-assets owner insert" ON storage.objects;
CREATE POLICY "bio-assets owner insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'bio-assets'
    AND (storage.foldername(name))[1] = public.get_current_consultant_id()::text
  );

DROP POLICY IF EXISTS "bio-assets owner update" ON storage.objects;
CREATE POLICY "bio-assets owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'bio-assets'
    AND (storage.foldername(name))[1] = public.get_current_consultant_id()::text
  );

DROP POLICY IF EXISTS "bio-assets owner delete" ON storage.objects;
CREATE POLICY "bio-assets owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'bio-assets'
    AND (storage.foldername(name))[1] = public.get_current_consultant_id()::text
  );

-- =========================================================
-- 5) SECURITY FIX: crm-media -> private + scoped policies
-- =========================================================
UPDATE storage.buckets SET public = false WHERE id = 'crm-media';

-- Drop overly permissive existing policies on crm-media (if any)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND (qual ILIKE '%crm-media%' OR with_check ILIKE '%crm-media%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- New SELECT policy: only authenticated users that own the instance referenced in path
-- Path convention: messages/<instance_name>/<file>
CREATE POLICY "crm-media owner read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'crm-media'
    AND EXISTS (
      SELECT 1 FROM public.whatsapp_instances wi
      WHERE wi.user_id = public.get_current_consultant_id()
        AND wi.instance_name = (storage.foldername(name))[2]
    )
  );

-- INSERT/UPDATE: only service_role writes (webhook). Authenticated users can also write into their own instance folder if needed.
CREATE POLICY "crm-media owner write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'crm-media'
    AND EXISTS (
      SELECT 1 FROM public.whatsapp_instances wi
      WHERE wi.user_id = public.get_current_consultant_id()
        AND wi.instance_name = (storage.foldername(name))[2]
    )
  );

-- =========================================================
-- 6) SECURITY FIX: quiz_submissions_new public UPDATE
-- =========================================================
DROP POLICY IF EXISTS "Public can update recent submissions" ON public.quiz_submissions_new;
DROP POLICY IF EXISTS "Anon can update session progress only" ON public.quiz_submissions_new;

-- Trigger that blocks anonymous changes to sensitive fields
CREATE OR REPLACE FUNCTION public.protect_quiz_submission_anon_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce for anonymous (no auth.uid())
  IF auth.uid() IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.name        IS DISTINCT FROM OLD.name        THEN RAISE EXCEPTION 'forbidden field: name'; END IF;
  IF NEW.phone       IS DISTINCT FROM OLD.phone       THEN RAISE EXCEPTION 'forbidden field: phone'; END IF;
  IF NEW.email       IS DISTINCT FROM OLD.email       THEN RAISE EXCEPTION 'forbidden field: email'; END IF;
  IF NEW.pipeline_stage_id IS DISTINCT FROM OLD.pipeline_stage_id THEN RAISE EXCEPTION 'forbidden field: pipeline_stage_id'; END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN RAISE EXCEPTION 'forbidden field: assigned_to'; END IF;
  IF NEW.lead_score  IS DISTINCT FROM OLD.lead_score  THEN RAISE EXCEPTION 'forbidden field: lead_score'; END IF;
  IF NEW.notes       IS DISTINCT FROM OLD.notes       THEN RAISE EXCEPTION 'forbidden field: notes'; END IF;
  IF NEW.consultant_id IS DISTINCT FROM OLD.consultant_id THEN RAISE EXCEPTION 'forbidden field: consultant_id'; END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN RAISE EXCEPTION 'forbidden field: organization_id'; END IF;
  IF NEW.temperature IS DISTINCT FROM OLD.temperature THEN RAISE EXCEPTION 'forbidden field: temperature'; END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_quiz_submission_anon_update ON public.quiz_submissions_new;
CREATE TRIGGER trg_protect_quiz_submission_anon_update
  BEFORE UPDATE ON public.quiz_submissions_new
  FOR EACH ROW EXECUTE FUNCTION public.protect_quiz_submission_anon_update();

-- New scoped anon UPDATE policy (only recent rows; trigger blocks sensitive fields)
CREATE POLICY "Anon can update session progress only"
  ON public.quiz_submissions_new
  FOR UPDATE TO anon
  USING (created_at > now() - interval '2 hours' AND organization_id IS NOT NULL)
  WITH CHECK (created_at > now() - interval '2 hours' AND organization_id IS NOT NULL);

-- =========================================================
-- 7) SECURITY FIX: legacy quiz_submissions public UPDATE
-- =========================================================
DROP POLICY IF EXISTS "Public can update recent quiz submissions" ON public.quiz_submissions;

-- =========================================================
-- 8) SECURITY FIX: realtime.messages RLS for CRM channels
-- =========================================================
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm realtime owner read" ON realtime.messages;
CREATE POLICY "crm realtime owner read" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    -- Only allow CRM-related topics for instances owned by the user
    (
      topic LIKE 'crm:%'
      AND EXISTS (
        SELECT 1 FROM public.whatsapp_instances wi
        WHERE wi.user_id = public.get_current_consultant_id()
          AND ('crm:' || wi.instance_name) = topic
      )
    )
    OR topic NOT LIKE 'crm:%'
  );
