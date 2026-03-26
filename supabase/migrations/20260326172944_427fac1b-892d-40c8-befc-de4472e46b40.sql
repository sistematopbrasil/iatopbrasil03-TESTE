ALTER TABLE public.capture_page_configs 
  ADD COLUMN template_type text NOT NULL DEFAULT 'standard',
  ADD COLUMN gallery_images jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN gallery_title text DEFAULT 'Veja nossos resultados';