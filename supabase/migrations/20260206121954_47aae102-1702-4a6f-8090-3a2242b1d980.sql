
-- ============================================
-- FASE 1: CORREÇÕES DE SEGURANÇA CRÍTICAS
-- ============================================

-- 1.1 - Criar view pública segura para consultores (expõe APENAS campos necessários)
CREATE OR REPLACE VIEW public.consultants_public AS
SELECT 
  id,
  full_name,
  organization_id,
  quiz_slug,
  profile_photo,
  whatsapp_button_url,
  quiz_cover_image,
  quiz_image_position,
  quiz_image_shape,
  quiz_image_size,
  pixel_id
FROM public.users
WHERE is_active = true AND quiz_slug IS NOT NULL;

-- Remover policy que expõe TODOS os dados dos consultores publicamente
DROP POLICY IF EXISTS "Public can read consultants by quiz slug" ON public.users;

-- 1.2 - Remover policies perigosas da tabela legada quiz_submissions
DROP POLICY IF EXISTS "Anyone can select recent quiz submissions" ON public.quiz_submissions;
DROP POLICY IF EXISTS "Anyone can update recent quiz submissions" ON public.quiz_submissions;
DROP POLICY IF EXISTS "Anyone can insert quiz submissions" ON public.quiz_submissions;

-- 1.3 - Endurecer policies "always true" em quiz_submissions_new
DROP POLICY IF EXISTS "Public can insert submissions" ON public.quiz_submissions_new;
CREATE POLICY "Public can insert submissions" 
  ON public.quiz_submissions_new FOR INSERT
  WITH CHECK (organization_id IS NOT NULL);

DROP POLICY IF EXISTS "Public can update recent submissions" ON public.quiz_submissions_new;
CREATE POLICY "Public can update recent submissions" 
  ON public.quiz_submissions_new FOR UPDATE
  USING (created_at > (now() - interval '2 hours'))
  WITH CHECK (organization_id IS NOT NULL);

-- 1.3b - Endurecer policies em tracking_sessions
DROP POLICY IF EXISTS "Public can insert tracking sessions" ON public.tracking_sessions;
CREATE POLICY "Public can insert tracking sessions" 
  ON public.tracking_sessions FOR INSERT
  WITH CHECK (organization_id IS NOT NULL);

DROP POLICY IF EXISTS "Public can update tracking sessions" ON public.tracking_sessions;
CREATE POLICY "Public can update tracking sessions" 
  ON public.tracking_sessions FOR UPDATE
  USING (started_at > (now() - interval '2 hours'))
  WITH CHECK (organization_id IS NOT NULL);
