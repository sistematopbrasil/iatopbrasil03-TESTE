-- Criar tabela crm_settings para configurações globais do CRM
CREATE TABLE IF NOT EXISTS public.crm_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID,
  quick_replies_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.crm_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own CRM settings"
  ON public.crm_settings FOR SELECT
  USING (user_id = public.get_current_consultant_id());

CREATE POLICY "Users can insert their own CRM settings"
  ON public.crm_settings FOR INSERT
  WITH CHECK (user_id = public.get_current_consultant_id());

CREATE POLICY "Users can update their own CRM settings"
  ON public.crm_settings FOR UPDATE
  USING (user_id = public.get_current_consultant_id());

-- Adicionar crm_quick_replies ao realtime para atualizações em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_quick_replies;
ALTER TABLE public.crm_quick_replies REPLICA IDENTITY FULL;

-- Remover coluna is_enabled das respostas rápidas individuais (agora é global)
ALTER TABLE public.crm_quick_replies DROP COLUMN IF EXISTS is_enabled;