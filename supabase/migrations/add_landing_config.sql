-- Adicionar colunas para a Landing Page na tabela capture_page_configs
-- Execute este script no SQL Editor do Supabase Dashboard

ALTER TABLE capture_page_configs
  ADD COLUMN IF NOT EXISTS logo_image text,
  ADD COLUMN IF NOT EXISTS compare_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS compare_title text,
  ADD COLUMN IF NOT EXISTS compare_traditional_items jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS compare_topbrasil_items jsonb DEFAULT '[]'::jsonb;
