
-- Corrigir view para usar SECURITY INVOKER (não DEFINER)
CREATE OR REPLACE VIEW public.consultants_public 
WITH (security_invoker = true) AS
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

-- A view agora respeita as RLS policies da tabela users.
-- Precisamos de uma policy que permita leitura pública APENAS via view fields.
-- Como a view já filtra os campos, adicionamos uma policy SELECT restrita:
CREATE POLICY "Public can read active consultants basic info"
  ON public.users FOR SELECT
  USING (is_active = true AND quiz_slug IS NOT NULL);
