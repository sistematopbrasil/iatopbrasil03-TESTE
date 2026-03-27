ALTER TABLE public.capture_page_configs ADD COLUMN IF NOT EXISTS logo_position text DEFAULT 'left';
ALTER TABLE public.capture_page_configs ADD COLUMN IF NOT EXISTS logo_size text DEFAULT 'medium';