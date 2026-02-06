
-- CORRIGIR: Remover a policy que re-expõe todos os campos do users
DROP POLICY IF EXISTS "Public can read active consultants basic info" ON public.users;

-- Remover a view (vamos usar função security definer em vez disso)
DROP VIEW IF EXISTS public.consultants_public;

-- Criar função security definer que retorna APENAS campos seguros
CREATE OR REPLACE FUNCTION public.get_consultant_by_slug(p_slug text)
RETURNS TABLE (
  id uuid,
  full_name text,
  organization_id uuid,
  quiz_slug text,
  profile_photo text,
  whatsapp_button_url text,
  quiz_cover_image text,
  quiz_image_position text,
  quiz_image_shape text,
  quiz_image_size text,
  pixel_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    u.id, u.full_name, u.organization_id, u.quiz_slug,
    u.profile_photo, u.whatsapp_button_url, u.quiz_cover_image,
    u.quiz_image_position, u.quiz_image_shape, u.quiz_image_size,
    u.pixel_id
  FROM public.users u
  WHERE u.quiz_slug = p_slug
    AND u.is_active = true
  LIMIT 1;
$$;

-- Função para buscar consultores de uma organização (para listagem pública)
CREATE OR REPLACE FUNCTION public.get_consultants_by_org(p_org_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  organization_id uuid,
  quiz_slug text,
  profile_photo text,
  whatsapp_button_url text,
  quiz_cover_image text,
  quiz_image_position text,
  quiz_image_shape text,
  quiz_image_size text,
  pixel_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    u.id, u.full_name, u.organization_id, u.quiz_slug,
    u.profile_photo, u.whatsapp_button_url, u.quiz_cover_image,
    u.quiz_image_position, u.quiz_image_shape, u.quiz_image_size,
    u.pixel_id
  FROM public.users u
  WHERE u.organization_id = p_org_id
    AND u.is_active = true
    AND u.quiz_slug IS NOT NULL;
$$;
