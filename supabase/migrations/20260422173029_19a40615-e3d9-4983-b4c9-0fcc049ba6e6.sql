-- 1. Cofre interno da chave-mestra (sem RLS exposta a usuários)
CREATE TABLE IF NOT EXISTS public._encryption_keyring (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true), -- single-row enforced
  master_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public._encryption_keyring ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy: ninguém acessa diretamente. Apenas SECURITY DEFINER funcs.
REVOKE ALL ON public._encryption_keyring FROM anon, authenticated, public;

-- 2. Semeia a chave se não existir
INSERT INTO public._encryption_keyring (id, master_key)
VALUES (true, encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (id) DO NOTHING;

-- 3. Helper interno para ler a chave (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public._get_master_encryption_key()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  k text;
  setting_key text;
BEGIN
  -- Prioridade 1: tabela interna
  SELECT master_key INTO k FROM public._encryption_keyring WHERE id = true LIMIT 1;
  IF k IS NOT NULL AND k <> '' THEN
    RETURN k;
  END IF;

  -- Fallback: setting Postgres (compatibilidade)
  setting_key := current_setting('app.settings.encryption_key', true);
  IF setting_key IS NOT NULL AND setting_key <> '' THEN
    RETURN setting_key;
  END IF;

  RETURN NULL;
END;
$fn$;

REVOKE ALL ON FUNCTION public._get_master_encryption_key() FROM anon, authenticated, public;

-- 4. Refatora encrypt_api_key para usar o helper
CREATE OR REPLACE FUNCTION public.encrypt_api_key(plain_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  encryption_secret text;
BEGIN
  IF plain_key IS NULL OR plain_key = '' THEN
    RETURN NULL;
  END IF;
  encryption_secret := public._get_master_encryption_key();
  IF encryption_secret IS NULL OR encryption_secret = '' THEN
    RAISE EXCEPTION 'Encryption key not configured.';
  END IF;
  RETURN encode(
    extensions.pgp_sym_encrypt(plain_key, encryption_secret),
    'base64'
  );
END;
$fn$;

-- 5. Refatora decrypt_api_key para usar o helper
CREATE OR REPLACE FUNCTION public.decrypt_api_key(encrypted_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  encryption_secret text;
BEGIN
  IF encrypted_key IS NULL OR encrypted_key = '' THEN
    RETURN NULL;
  END IF;
  encryption_secret := public._get_master_encryption_key();
  IF encryption_secret IS NULL OR encryption_secret = '' THEN
    RAISE EXCEPTION 'Encryption key not configured.';
  END IF;
  RETURN extensions.pgp_sym_decrypt(
    decode(encrypted_key, 'base64'),
    encryption_secret
  );
END;
$fn$;

-- 6. Smoke test
DO $$
DECLARE
  enc text;
  dec text;
BEGIN
  enc := public.encrypt_api_key('__smoke_test__');
  dec := public.decrypt_api_key(enc);
  IF dec <> '__smoke_test__' THEN
    RAISE EXCEPTION 'Encryption smoke test failed: got %', dec;
  END IF;
END $$;