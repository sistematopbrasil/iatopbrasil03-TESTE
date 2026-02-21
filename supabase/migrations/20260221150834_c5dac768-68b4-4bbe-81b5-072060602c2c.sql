
-- Create traffic_ai_conversations table
CREATE TABLE public.traffic_ai_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  ad_account_id TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint per org + account
CREATE UNIQUE INDEX idx_traffic_ai_conv_org_account ON public.traffic_ai_conversations(organization_id, ad_account_id);

-- Enable RLS
ALTER TABLE public.traffic_ai_conversations ENABLE ROW LEVEL SECURITY;

-- RLS policy: super admin can manage
CREATE POLICY "Super admin can manage traffic_ai_conversations"
  ON public.traffic_ai_conversations
  FOR ALL
  USING (is_super_admin());

-- Add AI config columns to traffic_settings
ALTER TABLE public.traffic_settings
  ADD COLUMN ai_model TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  ADD COLUMN ai_system_prompt TEXT,
  ADD COLUMN ai_temperature NUMERIC NOT NULL DEFAULT 0.5,
  ADD COLUMN ai_response_mode TEXT NOT NULL DEFAULT 'detailed';

-- Trigger for updated_at on traffic_ai_conversations
CREATE TRIGGER update_traffic_ai_conversations_updated_at
  BEFORE UPDATE ON public.traffic_ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
