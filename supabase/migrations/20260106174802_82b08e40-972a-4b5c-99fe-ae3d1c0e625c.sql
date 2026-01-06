-- Reaplicar REPLICA IDENTITY FULL para garantir que realtime funcione
ALTER TABLE public.crm_messages REPLICA IDENTITY FULL;
ALTER TABLE public.crm_conversations REPLICA IDENTITY FULL;