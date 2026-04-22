-- 1) Coluna no users para o quiz saber qual funil alimenta
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS quiz_funnel_type public.funnel_type NOT NULL DEFAULT 'consultor';

-- 2) Atualiza RPC pública para retornar a nova coluna
DROP FUNCTION IF EXISTS public.get_consultant_by_slug(text);

CREATE FUNCTION public.get_consultant_by_slug(p_slug text)
 RETURNS TABLE(
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
   quiz_funnel_type public.funnel_type
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    u.id, u.full_name, u.organization_id, u.quiz_slug,
    u.profile_photo, u.whatsapp_button_url, u.quiz_cover_image,
    u.quiz_image_position, u.quiz_image_shape, u.quiz_image_size,
    u.pixel_id,
    COALESCE(u.quiz_funnel_type, 'consultor'::public.funnel_type) AS quiz_funnel_type
  FROM public.users u
  WHERE u.quiz_slug = p_slug
    AND u.is_active = true
  LIMIT 1;
$function$;