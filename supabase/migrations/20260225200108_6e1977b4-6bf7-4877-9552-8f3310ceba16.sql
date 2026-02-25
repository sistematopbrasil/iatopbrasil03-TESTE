ALTER TABLE capture_page_configs
  ADD COLUMN IF NOT EXISTS hero_image_size text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS hero_image_position text DEFAULT 'top',
  ADD COLUMN IF NOT EXISTS hero_image_shape text DEFAULT 'rounded',
  ADD COLUMN IF NOT EXISTS whatsapp_number text DEFAULT NULL;