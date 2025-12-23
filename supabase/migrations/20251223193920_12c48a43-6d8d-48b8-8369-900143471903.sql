-- Fix generate_quiz_slug function to not cut first letter
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
  
  -- Apply unaccent and convert to slug format
  base_slug := lower(regexp_replace(
    unaccent(cleaned_name),
    '[^a-z0-9]+',
    '-',
    'g'
  ));
  
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

-- Fix generate_unique_username function to not cut first letter
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
  
  -- Apply unaccent and remove special characters
  base_username := lower(regexp_replace(
    unaccent(cleaned_name),
    '[^a-z0-9]+',
    '',
    'g'
  ));
  
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

-- Add is_default column to quiz_questions table
ALTER TABLE public.quiz_questions 
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Update existing questions to mark them as default based on common question patterns
UPDATE public.quiz_questions 
SET is_default = true 
WHERE question_text ILIKE '%nome completo%'
   OR question_text ILIKE '%telefone%whatsapp%'
   OR question_text ILIKE '%sua idade%'
   OR question_text ILIKE '%casado%solteiro%'
   OR question_text ILIKE '%cidade e estado%'
   OR question_text ILIKE '%carro ou moto%'
   OR question_text ILIKE '%cnh%'
   OR question_text ILIKE '%situação profissional%'
   OR question_text ILIKE '%trabalha com o quê%'
   OR question_text ILIKE '%vendas antes%'
   OR question_text ILIKE '%proteção veicular%'
   OR question_text ILIKE '%faixa de ganhos%'
   OR question_text ILIKE '%gostaria de ganhar%'
   OR question_text ILIKE '%tornar um consultor%';