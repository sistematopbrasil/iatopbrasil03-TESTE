ALTER TABLE public.users ADD COLUMN crm_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.capture_page_configs 
  ADD COLUMN custom_questions jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN email_enabled boolean NOT NULL DEFAULT true;