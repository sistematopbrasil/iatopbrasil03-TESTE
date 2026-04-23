-- 1) Adicionar flags de habilitação do quiz por funil
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS quiz_enabled_consultor boolean NOT NULL DEFAULT true;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS quiz_enabled_associado boolean NOT NULL DEFAULT false;

-- 2) Atualizar get_consultant_by_slug para retornar essas colunas
DROP FUNCTION IF EXISTS public.get_consultant_by_slug(text);

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
  pixel_id text,
  quiz_funnel_type public.funnel_type,
  quiz_enabled_consultor boolean,
  quiz_enabled_associado boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    u.id, u.full_name, u.organization_id, u.quiz_slug,
    u.profile_photo, u.whatsapp_button_url, u.quiz_cover_image,
    u.quiz_image_position, u.quiz_image_shape, u.quiz_image_size,
    u.pixel_id,
    COALESCE(u.quiz_funnel_type, 'consultor'::public.funnel_type) AS quiz_funnel_type,
    COALESCE(u.quiz_enabled_consultor, true) AS quiz_enabled_consultor,
    COALESCE(u.quiz_enabled_associado, false) AS quiz_enabled_associado
  FROM public.users u
  WHERE u.quiz_slug = p_slug
    AND u.is_active = true
  LIMIT 1;
$$;