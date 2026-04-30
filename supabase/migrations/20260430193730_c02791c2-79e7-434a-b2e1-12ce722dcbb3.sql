-- 1) Coluna instagram_visible em users (default true)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS instagram_visible boolean NOT NULL DEFAULT true;

-- 2) Ajustar RLS de SELECT em insta_profiles
-- Remover policy ampla atual e a "consultants view own" para recriar consolidadas
DROP POLICY IF EXISTS "Users can view insta profiles in their org" ON public.insta_profiles;
DROP POLICY IF EXISTS "Consultants view own insta profiles" ON public.insta_profiles;

-- Admin/Super admin: vê todos da organização
CREATE POLICY "Admins view all insta profiles in org"
ON public.insta_profiles
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = get_current_consultant_id()
        AND u.role = 'admin'
    )
  )
);

-- Consultor: só vê os perfis vinculados a ele
CREATE POLICY "Consultants view own insta profiles"
ON public.insta_profiles
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND consultant_id = get_current_consultant_id()
);
