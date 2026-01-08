-- Adicionar colunas de telemetria na tabela whatsapp_instances (se ainda não existem)
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS last_webhook_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_webhook_event TEXT,
ADD COLUMN IF NOT EXISTS last_webhook_message_id TEXT;

-- Habilitar realtime para crm_messages (crm_conversations já está ativo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'crm_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_messages;
  END IF;
END $$;