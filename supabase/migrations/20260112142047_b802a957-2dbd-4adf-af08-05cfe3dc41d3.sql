-- Função para normalizar telefone brasileiro (55 + DDD + número com 9)
CREATE OR REPLACE FUNCTION public.normalize_br_phone(phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  cleaned text;
  ddd text;
  number text;
BEGIN
  -- Retornar null se input for null ou vazio
  IF phone IS NULL OR trim(phone) = '' THEN
    RETURN NULL;
  END IF;
  
  -- Remover tudo que não é número
  cleaned := regexp_replace(phone, '\D', '', 'g');
  
  -- Se já tem código do país (55) e 13 dígitos (formato completo com 9), retorna como está
  IF cleaned LIKE '55%' AND length(cleaned) = 13 THEN
    RETURN cleaned;
  END IF;
  
  -- Se tem 55 + 12 dígitos (falta o 9 no celular), adicionar o 9
  IF cleaned LIKE '55%' AND length(cleaned) = 12 THEN
    ddd := substring(cleaned from 3 for 2);
    number := substring(cleaned from 5);
    RETURN '55' || ddd || '9' || number;
  END IF;
  
  -- Se tem 11 dígitos (DDD + número com 9), adiciona 55
  IF length(cleaned) = 11 THEN
    RETURN '55' || cleaned;
  END IF;
  
  -- Se tem 10 dígitos (DDD + número sem 9), adiciona 55 e 9
  IF length(cleaned) = 10 THEN
    ddd := substring(cleaned from 1 for 2);
    number := substring(cleaned from 3);
    RETURN '55' || ddd || '9' || number;
  END IF;
  
  -- Se tem 8-9 dígitos (só número, sem DDD), retornar como está (não podemos inferir DDD)
  IF length(cleaned) >= 8 AND length(cleaned) <= 9 THEN
    RETURN cleaned;
  END IF;
  
  -- Retorna limpo se não se encaixa nos padrões
  RETURN cleaned;
END;
$function$;

-- Trigger para normalizar telefone automaticamente em quiz_submissions_new
CREATE OR REPLACE FUNCTION public.trigger_normalize_phone_quiz()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    NEW.phone := public.normalize_br_phone(NEW.phone);
  END IF;
  RETURN NEW;
END;
$function$;

-- Criar trigger para quiz_submissions_new
DROP TRIGGER IF EXISTS normalize_phone_quiz_trigger ON public.quiz_submissions_new;
CREATE TRIGGER normalize_phone_quiz_trigger
  BEFORE INSERT OR UPDATE OF phone ON public.quiz_submissions_new
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_normalize_phone_quiz();

-- BACKFILL: Normalizar telefones existentes na quiz_submissions_new
UPDATE public.quiz_submissions_new 
SET phone = public.normalize_br_phone(phone)
WHERE phone IS NOT NULL 
  AND phone != '' 
  AND phone != public.normalize_br_phone(phone);