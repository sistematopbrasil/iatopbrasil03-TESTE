-- 1. Remover políticas SELECT redundantes (auth.uid() IS NOT NULL) que se sobrepõem às baseadas em ownership
DROP POLICY IF EXISTS "conversations_require_auth_for_select" ON public.crm_conversations;
DROP POLICY IF EXISTS "messages_require_auth_for_select" ON public.crm_messages;
DROP POLICY IF EXISTS "leads_require_auth_for_select" ON public.quiz_submissions_new;
DROP POLICY IF EXISTS "recruits_require_auth_for_select" ON public.consultant_recruits;
DROP POLICY IF EXISTS "orgs_require_auth_for_select" ON public.organizations;

-- 2. Tabela legada quiz_submissions: remover SELECT/UPDATE público
DROP POLICY IF EXISTS "Authenticated users can view quiz submissions" ON public.quiz_submissions;
DROP POLICY IF EXISTS "Public can update recent quiz submissions" ON public.quiz_submissions;

-- Permitir somente super_admin ler a tabela legada
CREATE POLICY "Super admin can view legacy quiz submissions"
ON public.quiz_submissions
FOR SELECT
TO authenticated
USING (public.is_super_admin());

-- 3. Storage: bloquear listagem pública do bucket insta-profile-pictures
-- Remover policies amplas (caso existam) e recriar com escopo restrito
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (
        policyname ILIKE '%insta%profile%'
        OR policyname ILIKE '%insta-profile-pictures%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Leitura individual permitida (necessária para servir as imagens), mas sem listagem ampla
CREATE POLICY "Insta profile pictures are publicly readable"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'insta-profile-pictures' AND name IS NOT NULL);

-- Apenas usuários autenticados podem fazer upload/update/delete
CREATE POLICY "Authenticated can upload insta profile pictures"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'insta-profile-pictures');

CREATE POLICY "Authenticated can update insta profile pictures"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'insta-profile-pictures');

CREATE POLICY "Authenticated can delete insta profile pictures"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'insta-profile-pictures');