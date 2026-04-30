CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.bio_pages_set_slug()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  raw_name text;
  base text;
  candidate text;
  n int := 1;
BEGIN
  raw_name := coalesce(NEW.header->>'name', '');

  base := lower(extensions.unaccent(split_part(trim(raw_name), ' ', 1)));
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
$function$;