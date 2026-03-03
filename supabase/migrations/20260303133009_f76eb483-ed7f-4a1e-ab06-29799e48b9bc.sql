
-- Table: pipeline_stage_prompts - custom AI descriptions per pipeline stage
CREATE TABLE public.pipeline_stage_prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(stage_id, user_id)
);

ALTER TABLE public.pipeline_stage_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own stage prompts"
  ON public.pipeline_stage_prompts
  FOR ALL
  USING (user_id = get_current_consultant_id())
  WITH CHECK (user_id = get_current_consultant_id());

-- Table: followup_rules - automated follow-up configuration
CREATE TABLE public.followup_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Follow-up',
  is_active BOOLEAN NOT NULL DEFAULT true,
  delay_minutes INTEGER NOT NULL DEFAULT 60,
  max_followups INTEGER NOT NULL DEFAULT 3,
  message_type TEXT NOT NULL DEFAULT 'ai_generated',
  fixed_message TEXT,
  ai_prompt TEXT,
  exclude_stages UUID[] DEFAULT '{}',
  only_open_conversations BOOLEAN NOT NULL DEFAULT true,
  respect_working_hours BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.followup_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own followup rules"
  ON public.followup_rules
  FOR ALL
  USING (user_id = get_current_consultant_id())
  WITH CHECK (user_id = get_current_consultant_id());

-- Table: followup_logs - track follow-up sends
CREATE TABLE public.followup_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.crm_conversations(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES public.followup_rules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  message_content TEXT
);

ALTER TABLE public.followup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own followup logs"
  ON public.followup_logs
  FOR ALL
  USING (user_id = get_current_consultant_id())
  WITH CHECK (user_id = get_current_consultant_id());
