
-- Enable pgcrypto if not already
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Helper function to encrypt API keys using a server-side secret
CREATE OR REPLACE FUNCTION public.encrypt_api_key(plain_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  encryption_secret text;
BEGIN
  IF plain_key IS NULL OR plain_key = '' THEN
    RETURN NULL;
  END IF;
  -- Use the database password as encryption key (only accessible server-side)
  encryption_secret := current_setting('app.settings.encryption_key', true);
  IF encryption_secret IS NULL OR encryption_secret = '' THEN
    encryption_secret := 'top-brasil-encryption-key-2026';
  END IF;
  RETURN encode(
    extensions.pgp_sym_encrypt(plain_key, encryption_secret),
    'base64'
  );
END;
$$;

-- Helper function to decrypt API keys
CREATE OR REPLACE FUNCTION public.decrypt_api_key(encrypted_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  encryption_secret text;
BEGIN
  IF encrypted_key IS NULL OR encrypted_key = '' THEN
    RETURN NULL;
  END IF;
  encryption_secret := current_setting('app.settings.encryption_key', true);
  IF encryption_secret IS NULL OR encryption_secret = '' THEN
    encryption_secret := 'top-brasil-encryption-key-2026';
  END IF;
  RETURN extensions.pgp_sym_decrypt(
    decode(encrypted_key, 'base64'),
    encryption_secret
  );
END;
$$;
