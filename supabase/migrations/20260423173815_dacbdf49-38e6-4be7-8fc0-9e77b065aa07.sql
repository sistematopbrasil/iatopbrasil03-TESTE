-- 1) Add quiz_slug_associado
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS quiz_slug_associado text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'users_quiz_slug_associado_key'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_quiz_slug_associado_key UNIQUE (quiz_slug_associado);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_quiz_slug_associado ON public.users (quiz_slug_associado);

-- 2) Replace get_consultant_by_slug to resolve both slugs and override quiz_funnel_type accordingly
CREATE OR REPLACE FUNCTION public.get_consultant_by_slug(p_slug text)
 RETURNS TABLE(id uuid, full_name text, organization_id uuid, quiz_slug text, profile_photo text, whatsapp_button_url text, quiz_cover_image text, quiz_image_position text, quiz_image_shape text, quiz_image_size text, pixel_id text, quiz_funnel_type funnel_type, quiz_enabled_consultor boolean, quiz_enabled_associado boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    u.id,
    u.full_name,
    u.organization_id,
    -- preserve original quiz_slug for back-compat
    u.quiz_slug,
    u.profile_photo,
    u.whatsapp_button_url,
    u.quiz_cover_image,
    u.quiz_image_position,
    u.quiz_image_shape,
    u.quiz_image_size,
    u.pixel_id,
    -- override quiz_funnel_type if slug matched the associado slug
    CASE
      WHEN u.quiz_slug_associado IS NOT NULL AND u.quiz_slug_associado = p_slug THEN 'associado'::public.funnel_type
      ELSE COALESCE(u.quiz_funnel_type, 'consultor'::public.funnel_type)
    END AS quiz_funnel_type,
    COALESCE(u.quiz_enabled_consultor, true) AS quiz_enabled_consultor,
    COALESCE(u.quiz_enabled_associado, false) AS quiz_enabled_associado
  FROM public.users u
  WHERE (u.quiz_slug = p_slug OR u.quiz_slug_associado = p_slug)
    AND u.is_active = true
  LIMIT 1;
$function$;

-- 3) Backfill quiz_slug_associado for users with associado in allowed_funnels
DO $$
DECLARE
  rec RECORD;
  base_slug text;
  candidate text;
  counter int;
BEGIN
  FOR rec IN
    SELECT id, quiz_slug, full_name
    FROM public.users
    WHERE 'associado' = ANY(allowed_funnels)
      AND quiz_slug_associado IS NULL
      AND is_active = true
  LOOP
    base_slug := COALESCE(rec.quiz_slug, public.generate_quiz_slug(rec.full_name));
    candidate := base_slug || '-associado';
    counter := 1;
    WHILE EXISTS (SELECT 1 FROM public.users WHERE quiz_slug_associado = candidate OR quiz_slug = candidate) LOOP
      counter := counter + 1;
      candidate := base_slug || '-associado-' || counter;
    END LOOP;
    UPDATE public.users SET quiz_slug_associado = candidate WHERE id = rec.id;
  END LOOP;
END $$;

-- 4) Trigger to auto-generate quiz_slug_associado when allowed_funnels gains 'associado'
CREATE OR REPLACE FUNCTION public.set_quiz_slug_associado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  base_slug text;
  candidate text;
  counter int;
BEGIN
  IF NEW.quiz_slug_associado IS NOT NULL AND NEW.quiz_slug_associado <> '' THEN
    -- Validate uniqueness on UPDATE if changed
    IF TG_OP = 'UPDATE' AND NEW.quiz_slug_associado IS DISTINCT FROM OLD.quiz_slug_associado THEN
      IF EXISTS (SELECT 1 FROM public.users WHERE quiz_slug_associado = NEW.quiz_slug_associado AND id <> NEW.id) THEN
        RAISE EXCEPTION 'Este slug já está em uso.' USING ERRCODE = '23505';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- auto-generate if user has associado in allowed_funnels and slug is missing
  IF 'associado'::public.funnel_type = ANY(NEW.allowed_funnels) AND (NEW.quiz_slug_associado IS NULL OR NEW.quiz_slug_associado = '') THEN
    base_slug := COALESCE(NEW.quiz_slug, public.generate_quiz_slug(NEW.full_name));
    candidate := base_slug || '-associado';
    counter := 1;
    WHILE EXISTS (SELECT 1 FROM public.users WHERE quiz_slug_associado = candidate OR quiz_slug = candidate) LOOP
      counter := counter + 1;
      candidate := base_slug || '-associado-' || counter;
    END LOOP;
    NEW.quiz_slug_associado := candidate;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_quiz_slug_associado ON public.users;
CREATE TRIGGER trg_set_quiz_slug_associado
BEFORE INSERT OR UPDATE OF quiz_slug_associado, allowed_funnels, full_name, quiz_slug
ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.set_quiz_slug_associado();