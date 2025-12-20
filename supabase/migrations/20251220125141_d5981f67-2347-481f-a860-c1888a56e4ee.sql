-- 1. Corrigir RLS para temperatura do lead - permitir update em leads recentes mesmo com 100% completion
DROP POLICY IF EXISTS "Public can update incomplete submissions" ON quiz_submissions_new;

CREATE POLICY "Public can update recent submissions"
ON quiz_submissions_new
FOR UPDATE
USING (created_at > (now() - '02:00:00'::interval))
WITH CHECK (true);

-- 2. Corrigir RLS tracking_sessions - permitir update baseado em started_at
DROP POLICY IF EXISTS "Public can update tracking sessions" ON tracking_sessions;

CREATE POLICY "Public can update tracking sessions"
ON tracking_sessions
FOR UPDATE
USING (started_at > (now() - '02:00:00'::interval))
WITH CHECK (true);

-- 3. Adicionar coluna username na tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- 4. Criar índice para username
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 5. Função para gerar username único baseado no nome
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
BEGIN
  -- Remove acentos, espaços e caracteres especiais, adiciona 'topbrasil'
  base_username := lower(regexp_replace(
    unaccent(TRIM(COALESCE(full_name, 'consultor'))),
    '[^a-z0-9]+',
    '',
    'g'
  )) || 'topbrasil';
  
  final_username := base_username;
  
  -- Verificar se username já existe e adicionar número se necessário
  WHILE EXISTS (SELECT 1 FROM users WHERE username = final_username) LOOP
    final_username := base_username || counter;
    counter := counter + 1;
  END LOOP;
  
  RETURN final_username;
END;
$function$;

-- 6. Trigger para gerar username automaticamente no INSERT
CREATE OR REPLACE FUNCTION public.set_username()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Só gerar username automático se for INSERT e username for nulo
  IF TG_OP = 'INSERT' AND (NEW.username IS NULL OR NEW.username = '') THEN
    NEW.username := public.generate_unique_username(NEW.full_name);
  END IF;
  
  -- Se for UPDATE e username mudou, validar unicidade
  IF TG_OP = 'UPDATE' AND NEW.username IS NOT NULL AND NEW.username != '' AND NEW.username IS DISTINCT FROM OLD.username THEN
    IF EXISTS (SELECT 1 FROM users WHERE username = NEW.username AND id != NEW.id) THEN
      RAISE EXCEPTION 'Este nome de usuário já está em uso.' USING ERRCODE = '23505';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 7. Dropar trigger existente se houver e criar novo
DROP TRIGGER IF EXISTS set_user_username ON users;

CREATE TRIGGER set_user_username
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION public.set_username();

-- 8. Atualizar usuários existentes sem username
UPDATE users 
SET username = public.generate_unique_username(full_name)
WHERE username IS NULL;