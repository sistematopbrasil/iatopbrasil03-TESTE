ALTER TABLE public.capture_page_configs 
  ADD COLUMN IF NOT EXISTS logo_image text,
  ADD COLUMN IF NOT EXISTS compare_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS compare_title text DEFAULT 'Por que pagar caro no seguro se você pode pagar muito menos?',
  ADD COLUMN IF NOT EXISTS compare_traditional_items jsonb DEFAULT '["Consulta de crédito","Processo burocrático","Atendimento demorado","Preço varia pelo seu perfil","Franquia obrigatória","Renovação anual forçada"]'::jsonb,
  ADD COLUMN IF NOT EXISTS compare_topbrasil_items jsonb DEFAULT '["Sem consulta de crédito","Aprovação na hora","Assistência 24h inclusa","Preço justo pra todos","Sem franquia surpresa","Atendimento humanizado"]'::jsonb;