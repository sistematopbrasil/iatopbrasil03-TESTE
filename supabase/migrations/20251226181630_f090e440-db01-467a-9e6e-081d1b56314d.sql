-- Fix generate_unique_username: apply lower() BEFORE the regex filter
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
  -- First trim the input to remove any leading/trailing whitespace
  cleaned_name := TRIM(COALESCE(full_name, 'consultor'));
  
  -- Remove invisible characters (like zero-width spaces)
  cleaned_name := regexp_replace(cleaned_name, E'[\\x00-\\x1F\\x7F\\u200B\\uFEFF]', '', 'g');
  
  -- Apply unaccent first
  cleaned_name := unaccent(cleaned_name);
  
  -- Convert to lowercase BEFORE applying the regex (fixes the uppercase letter removal bug)
  cleaned_name := lower(cleaned_name);
  
  -- Now remove non-alphanumeric characters (safe because already lowercase)
  base_username := regexp_replace(cleaned_name, '[^a-z0-9]+', '', 'g');
  
  -- Fallback if empty
  IF base_username = '' OR base_username IS NULL THEN
    base_username := 'consultor';
  END IF;
  
  -- Add suffix
  base_username := base_username || 'topbrasil';
  final_username := base_username;
  
  -- Check if username exists and add number if needed
  WHILE EXISTS (SELECT 1 FROM users WHERE username = final_username) LOOP
    final_username := base_username || counter;
    counter := counter + 1;
  END LOOP;
  
  RETURN final_username;
END;
$function$;

-- Fix generate_quiz_slug: apply lower() BEFORE the regex filter
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
  -- First trim the input to remove any leading/trailing whitespace
  cleaned_name := TRIM(COALESCE(full_name, 'consultor'));
  
  -- Remove invisible characters (like zero-width spaces)
  cleaned_name := regexp_replace(cleaned_name, E'[\\x00-\\x1F\\x7F\\u200B\\uFEFF]', '', 'g');
  
  -- Apply unaccent first
  cleaned_name := unaccent(cleaned_name);
  
  -- Convert to lowercase BEFORE applying the regex (fixes the uppercase letter removal bug)
  cleaned_name := lower(cleaned_name);
  
  -- Now convert to slug format (replace non-alphanumeric with hyphens)
  base_slug := regexp_replace(cleaned_name, '[^a-z0-9]+', '-', 'g');
  
  -- Remove hyphens at start and end
  base_slug := trim(both '-' from base_slug);
  
  -- Fallback if empty
  IF base_slug = '' OR base_slug IS NULL THEN
    base_slug := 'consultor';
  END IF;
  
  final_slug := base_slug;
  
  -- Check if slug exists and add number if needed
  WHILE EXISTS (SELECT 1 FROM users WHERE quiz_slug = final_slug) LOOP
    final_slug := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;
  
  RETURN final_slug;
END;
$function$;

-- Also update the existing user "Dioleno" to have the correct username and slug
UPDATE users 
SET 
  username = 'diolenotopbrasil',
  quiz_slug = 'dioleno'
WHERE email = 'diolenotopbrasil@gmail.com';