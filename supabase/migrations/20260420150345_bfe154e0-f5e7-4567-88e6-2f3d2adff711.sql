-- 1. Adicionar colunas à tabela users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS allowed_funnels public.funnel_type[] NOT NULL DEFAULT ARRAY['consultor']::public.funnel_type[],
  ADD COLUMN IF NOT EXISTS default_funnel public.funnel_type NOT NULL DEFAULT 'consultor'::public.funnel_type,
  ADD COLUMN IF NOT EXISTS last_active_funnel public.funnel_type;

-- 2. Backfill defensivo (garante que nenhum registro fique com array vazio ou valor inconsistente)
UPDATE public.users
SET allowed_funnels = ARRAY['consultor']::public.funnel_type[]
WHERE allowed_funnels IS NULL OR array_length(allowed_funnels, 1) IS NULL;

UPDATE public.users
SET default_funnel = 'consultor'::public.funnel_type
WHERE default_funnel IS NULL;

-- 3. CHECK constraint: default_funnel deve estar em allowed_funnels
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_default_funnel_in_allowed'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_default_funnel_in_allowed
      CHECK (default_funnel = ANY(allowed_funnels));
  END IF;
END $$;

-- 4. Função helper: verificar se um usuário tem acesso a um funil específico
CREATE OR REPLACE FUNCTION public.user_has_funnel_access(p_user_id uuid, p_funnel public.funnel_type)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = p_user_id
      AND p_funnel = ANY(allowed_funnels)
  );
$$;

-- 5. Função utilitária: frontend busca os acessos do próprio usuário logado
CREATE OR REPLACE FUNCTION public.get_my_funnel_access()
RETURNS TABLE(
  allowed public.funnel_type[],
  default_f public.funnel_type,
  last_active public.funnel_type
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT allowed_funnels, default_funnel, last_active_funnel
  FROM public.users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;