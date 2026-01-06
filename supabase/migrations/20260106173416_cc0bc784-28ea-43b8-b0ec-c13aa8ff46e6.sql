-- Adicionar tabelas ao realtime para mensagens atualizarem em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_conversations;

-- Habilitar REPLICA IDENTITY FULL para capturar dados completos nas mudanças
ALTER TABLE public.crm_messages REPLICA IDENTITY FULL;
ALTER TABLE public.crm_conversations REPLICA IDENTITY FULL;