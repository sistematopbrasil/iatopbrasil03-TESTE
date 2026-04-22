
-- =========================================================================
-- FASE D: Painel de Integrações Globais (Super Admin)
-- =========================================================================

-- Tabela principal
CREATE TABLE public.integration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('whatsapp', 'meta_ads', 'instagram')),
  key text NOT NULL UNIQUE,
  value_encrypted text,
  is_secret boolean NOT NULL DEFAULT true,
  description text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_integration_settings_category ON public.integration_settings(category);
CREATE INDEX idx_integration_settings_key ON public.integration_settings(key);

-- RLS
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can read integration_settings"
  ON public.integration_settings FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Super admin can insert integration_settings"
  ON public.integration_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admin can update integration_settings"
  ON public.integration_settings FOR UPDATE
  TO authenticated
  USING (public.is_super_admin());

-- DELETE intencionalmente proibido (sem policy = nega tudo)

-- Trigger updated_at
CREATE TRIGGER trg_integration_settings_updated_at
  BEFORE UPDATE ON public.integration_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- RPCs
-- =========================================================================

-- 1) Leitura interna (usada por edge functions com service role)
CREATE OR REPLACE FUNCTION public.get_integration_value(p_key text)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enc text;
  decoded text;
BEGIN
  SELECT value_encrypted INTO enc
  FROM public.integration_settings
  WHERE key = p_key
  LIMIT 1;

  IF enc IS NULL OR enc = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    decoded := public.decrypt_api_key(enc);
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  RETURN decoded;
END;
$$;

REVOKE ALL ON FUNCTION public.get_integration_value(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_integration_value(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_integration_value(text) TO service_role;

-- 2) Metadados para UI (sem expor valor)
CREATE OR REPLACE FUNCTION public.list_integration_settings_metadata()
RETURNS TABLE(
  id uuid,
  category text,
  key text,
  is_secret boolean,
  description text,
  has_value boolean,
  updated_by uuid,
  updated_by_name text,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
    SELECT 
      s.id,
      s.category,
      s.key,
      s.is_secret,
      s.description,
      (s.value_encrypted IS NOT NULL AND s.value_encrypted <> '') AS has_value,
      s.updated_by,
      u.full_name AS updated_by_name,
      s.updated_at
    FROM public.integration_settings s
    LEFT JOIN public.users u ON u.id = s.updated_by
    ORDER BY s.category, s.key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_integration_settings_metadata() TO authenticated;

-- 3) Revelar valor (com auditoria)
CREATE OR REPLACE FUNCTION public.reveal_integration_value(p_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enc text;
  decoded text;
  caller_id uuid;
  setting_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  caller_id := public.get_current_consultant_id();

  SELECT id, value_encrypted INTO setting_id, enc
  FROM public.integration_settings
  WHERE key = p_key
  LIMIT 1;

  IF enc IS NULL OR enc = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    decoded := public.decrypt_api_key(enc);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'decrypt_failed';
  END;

  -- Auditoria
  INSERT INTO public.crm_audit_logs (
    user_id, organization_id, action, resource_type, resource_id, metadata
  ) VALUES (
    caller_id,
    public.get_user_organization_id(),
    'integration_setting.revealed',
    'integration_setting',
    setting_id,
    jsonb_build_object('key', p_key)
  );

  RETURN decoded;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reveal_integration_value(text) TO authenticated;

-- 4) Salvar valor (com auditoria)
CREATE OR REPLACE FUNCTION public.set_integration_value(
  p_key text,
  p_value text,
  p_category text,
  p_is_secret boolean DEFAULT true,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid;
  setting_id uuid;
  had_previous boolean := false;
  enc text;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_category NOT IN ('whatsapp', 'meta_ads', 'instagram') THEN
    RAISE EXCEPTION 'invalid_category';
  END IF;

  caller_id := public.get_current_consultant_id();

  IF p_value IS NULL OR p_value = '' THEN
    enc := NULL;
  ELSE
    enc := public.encrypt_api_key(p_value);
  END IF;

  SELECT id, (value_encrypted IS NOT NULL AND value_encrypted <> '')
    INTO setting_id, had_previous
  FROM public.integration_settings
  WHERE key = p_key
  LIMIT 1;

  IF setting_id IS NULL THEN
    INSERT INTO public.integration_settings (
      category, key, value_encrypted, is_secret, description, updated_by
    ) VALUES (
      p_category, p_key, enc, p_is_secret, p_description, caller_id
    )
    RETURNING id INTO setting_id;
  ELSE
    UPDATE public.integration_settings
    SET value_encrypted = enc,
        category = p_category,
        is_secret = p_is_secret,
        description = COALESCE(p_description, description),
        updated_by = caller_id,
        updated_at = now()
    WHERE id = setting_id;
  END IF;

  INSERT INTO public.crm_audit_logs (
    user_id, organization_id, action, resource_type, resource_id, metadata
  ) VALUES (
    caller_id,
    public.get_user_organization_id(),
    'integration_setting.updated',
    'integration_setting',
    setting_id,
    jsonb_build_object(
      'key', p_key,
      'category', p_category,
      'had_previous_value', had_previous,
      'cleared', (enc IS NULL)
    )
  );

  RETURN setting_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_integration_value(text, text, text, boolean, text) TO authenticated;

-- 5) Limpar valor (volta ao fallback de env)
CREATE OR REPLACE FUNCTION public.clear_integration_value(p_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid;
  setting_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  caller_id := public.get_current_consultant_id();

  SELECT id INTO setting_id
  FROM public.integration_settings
  WHERE key = p_key
  LIMIT 1;

  IF setting_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.integration_settings
  SET value_encrypted = NULL,
      updated_by = caller_id,
      updated_at = now()
  WHERE id = setting_id;

  INSERT INTO public.crm_audit_logs (
    user_id, organization_id, action, resource_type, resource_id, metadata
  ) VALUES (
    caller_id,
    public.get_user_organization_id(),
    'integration_setting.cleared',
    'integration_setting',
    setting_id,
    jsonb_build_object('key', p_key)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_integration_value(text) TO authenticated;
