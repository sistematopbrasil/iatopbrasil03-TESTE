
-- 1. Add ai_enabled column to users
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT false;

-- 2. Create ai_agent_configs table
CREATE TABLE public.ai_agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  
  -- Agent Identity
  agent_name TEXT DEFAULT 'Assistente',
  description TEXT,
  
  -- Prompt / Persona
  persona TEXT,
  skills TEXT,
  products_info TEXT,
  restrictions TEXT,
  objective TEXT,
  
  -- AI Engine
  api_provider TEXT NOT NULL DEFAULT 'openai',
  api_key_encrypted TEXT,
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  temperature NUMERIC(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 500,
  
  -- Behavior
  auto_reply BOOLEAN DEFAULT true,
  pause_on_human_minutes INTEGER DEFAULT 120,
  greeting_message TEXT,
  farewell_message TEXT,
  working_hours_only BOOLEAN DEFAULT false,
  working_hours_start TIME DEFAULT '08:00',
  working_hours_end TIME DEFAULT '18:00',
  
  -- Pipeline
  auto_pipeline BOOLEAN DEFAULT false,
  
  -- Multimodal
  transcribe_audio BOOLEAN DEFAULT true,
  analyze_images BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id)
);

-- 3. Create ai_conversation_state table
CREATE TABLE public.ai_conversation_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.crm_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  is_active BOOLEAN DEFAULT true,
  paused_until TIMESTAMPTZ,
  paused_by TEXT DEFAULT 'system',
  permanently_disabled BOOLEAN DEFAULT false,
  
  last_ai_message_at TIMESTAMPTZ,
  messages_sent INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(conversation_id)
);

-- 4. Enable RLS
ALTER TABLE public.ai_agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversation_state ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for ai_agent_configs
CREATE POLICY "Users can manage own AI config"
  ON public.ai_agent_configs FOR ALL
  USING (user_id = get_current_consultant_id());

CREATE POLICY "Super admin can view all AI configs"
  ON public.ai_agent_configs FOR SELECT
  USING (is_super_admin());

CREATE POLICY "Super admin can update all AI configs"
  ON public.ai_agent_configs FOR UPDATE
  USING (is_super_admin());

-- 6. RLS policies for ai_conversation_state
CREATE POLICY "Users can manage own AI conversation state"
  ON public.ai_conversation_state FOR ALL
  USING (user_id = get_current_consultant_id());

-- 7. pgcrypto extension for API key encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- 8. Trigger for updated_at
CREATE TRIGGER update_ai_agent_configs_updated_at
  BEFORE UPDATE ON public.ai_agent_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_conversation_state_updated_at
  BEFORE UPDATE ON public.ai_conversation_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
