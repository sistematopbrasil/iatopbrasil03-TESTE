
-- Habilita unaccent
CREATE EXTENSION IF NOT EXISTS unaccent;

-- =========================================================
-- 1) bio_pages: slug por primeiro nome
-- =========================================================
ALTER TABLE public.bio_pages ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS bio_pages_slug_uniq ON public.bio_pages(slug);

CREATE OR REPLACE FUNCTION public.bio_pages_set_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw_name text;
  base text;
  candidate text;
  n int := 1;
BEGIN
  raw_name := coalesce(NEW.header->>'name', '');

  -- Pega o primeiro "token" antes do espaço, normaliza
  base := lower(unaccent(split_part(trim(raw_name), ' ', 1)));
  base := regexp_replace(base, '[^a-z0-9]+', '', 'g');

  IF base IS NULL OR base = '' THEN
    base := 'user-' || substring(NEW.user_id::text, 1, 8);
  END IF;

  candidate := base;
  WHILE EXISTS (
    SELECT 1 FROM public.bio_pages
    WHERE slug = candidate
      AND id <> coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) LOOP
    n := n + 1;
    candidate := base || '-' || n;
  END LOOP;

  NEW.slug := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bio_slug_ins ON public.bio_pages;
CREATE TRIGGER trg_bio_slug_ins
  BEFORE INSERT ON public.bio_pages
  FOR EACH ROW EXECUTE FUNCTION public.bio_pages_set_slug();

DROP TRIGGER IF EXISTS trg_bio_slug_upd ON public.bio_pages;
CREATE TRIGGER trg_bio_slug_upd
  BEFORE UPDATE OF header ON public.bio_pages
  FOR EACH ROW
  WHEN ((OLD.header->>'name') IS DISTINCT FROM (NEW.header->>'name'))
  EXECUTE FUNCTION public.bio_pages_set_slug();

-- Backfill para linhas existentes (slug NULL)
UPDATE public.bio_pages bp
SET header = bp.header
WHERE bp.slug IS NULL;

-- Atualiza RPC get_bio_by_slug para usar bio_pages.slug
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
  FROM public.bio_pages bp
  JOIN public.users u ON u.id = bp.user_id
  WHERE bp.slug = p_slug
    AND u.is_active = true
    AND bp.is_published = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_bio_by_slug(text) TO anon, authenticated;

-- =========================================================
-- 2) insta_profiles: vinculação a consultor
-- =========================================================
ALTER TABLE public.insta_profiles ADD COLUMN IF NOT EXISTS consultant_id uuid;
CREATE INDEX IF NOT EXISTS insta_profiles_consultant_idx ON public.insta_profiles(consultant_id);

-- Política: consultor (não super admin) só vê seus perfis vinculados
DROP POLICY IF EXISTS "Consultants view own insta profiles" ON public.insta_profiles;
CREATE POLICY "Consultants view own insta profiles"
  ON public.insta_profiles
  FOR SELECT
  TO authenticated
  USING (
    consultant_id = public.get_current_consultant_id()
    AND organization_id = public.get_user_organization_id()
  );

-- As políticas existentes (org-scoped) já permitem super admin e usuários da org administrarem.
