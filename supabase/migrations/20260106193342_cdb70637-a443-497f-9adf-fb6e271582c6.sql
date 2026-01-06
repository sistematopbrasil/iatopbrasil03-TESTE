-- 1. Criar função para atribuir stage inicial automaticamente
CREATE OR REPLACE FUNCTION public.assign_initial_pipeline_stage()
RETURNS TRIGGER AS $$
DECLARE
  first_stage_id UUID;
BEGIN
  -- Se já tem stage, não fazer nada
  IF NEW.pipeline_stage_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar primeiro stage da organização
  SELECT id INTO first_stage_id
  FROM public.pipeline_stages
  WHERE organization_id = NEW.organization_id
  ORDER BY order_index ASC
  LIMIT 1;
  
  -- Se encontrou stage, atribuir ao lead
  IF first_stage_id IS NOT NULL THEN
    NEW.pipeline_stage_id := first_stage_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Criar trigger para novos leads do quiz
DROP TRIGGER IF EXISTS trg_assign_initial_stage ON public.quiz_submissions_new;
CREATE TRIGGER trg_assign_initial_stage
  BEFORE INSERT ON public.quiz_submissions_new
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_initial_pipeline_stage();

-- 3. Atualizar leads existentes sem stage para receberem o primeiro stage
UPDATE public.quiz_submissions_new qs
SET pipeline_stage_id = (
  SELECT ps.id 
  FROM public.pipeline_stages ps 
  WHERE ps.organization_id = qs.organization_id 
  ORDER BY ps.order_index ASC 
  LIMIT 1
)
WHERE qs.pipeline_stage_id IS NULL;

-- 4. Garantir realtime para quiz_submissions_new
ALTER TABLE public.quiz_submissions_new REPLICA IDENTITY FULL;

-- 5. Garantir realtime para crm_messages  
ALTER TABLE public.crm_messages REPLICA IDENTITY FULL;

-- 6. Garantir realtime para crm_conversations
ALTER TABLE public.crm_conversations REPLICA IDENTITY FULL;

-- 7. Adicionar tabelas ao supabase_realtime publication
DO $$
BEGIN
  -- quiz_submissions_new
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'quiz_submissions_new'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_submissions_new;
  END IF;
  
  -- crm_messages
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'crm_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_messages;
  END IF;
  
  -- crm_conversations
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'crm_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_conversations;
  END IF;
END $$;