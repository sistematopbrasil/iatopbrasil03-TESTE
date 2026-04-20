-- ============================================================
-- DUAL-FUNNEL: Consultor + Associado (Fase A — Banco apenas)
-- ============================================================

-- 1) Criar enum funnel_type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'funnel_type') THEN
    CREATE TYPE public.funnel_type AS ENUM ('consultor', 'associado');
  END IF;
END $$;

-- ============================================================
-- 2) Adicionar coluna funnel_type nas tabelas-chave
--    DEFAULT 'consultor' garante backfill automático
-- ============================================================

ALTER TABLE public.quiz_submissions_new
  ADD COLUMN IF NOT EXISTS funnel_type public.funnel_type NOT NULL DEFAULT 'consultor';

ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS funnel_type public.funnel_type NOT NULL DEFAULT 'consultor';

ALTER TABLE public.ai_agent_configs
  ADD COLUMN IF NOT EXISTS funnel_type public.funnel_type NOT NULL DEFAULT 'consultor';

ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS funnel_type public.funnel_type NOT NULL DEFAULT 'consultor';

ALTER TABLE public.capture_page_configs
  ADD COLUMN IF NOT EXISTS funnel_type public.funnel_type NOT NULL DEFAULT 'consultor';

ALTER TABLE public.followup_rules
  ADD COLUMN IF NOT EXISTS funnel_type public.funnel_type NOT NULL DEFAULT 'consultor';

ALTER TABLE public.pipeline_stage_prompts
  ADD COLUMN IF NOT EXISTS funnel_type public.funnel_type NOT NULL DEFAULT 'consultor';

ALTER TABLE public.ranking_scores
  ADD COLUMN IF NOT EXISTS funnel_type public.funnel_type NOT NULL DEFAULT 'consultor';

-- ============================================================
-- 3) Backfill defensivo (redundante, mas garante zero NULL)
-- ============================================================
UPDATE public.quiz_submissions_new   SET funnel_type = 'consultor' WHERE funnel_type IS NULL;
UPDATE public.pipeline_stages        SET funnel_type = 'consultor' WHERE funnel_type IS NULL;
UPDATE public.ai_agent_configs       SET funnel_type = 'consultor' WHERE funnel_type IS NULL;
UPDATE public.whatsapp_instances     SET funnel_type = 'consultor' WHERE funnel_type IS NULL;
UPDATE public.capture_page_configs   SET funnel_type = 'consultor' WHERE funnel_type IS NULL;
UPDATE public.followup_rules         SET funnel_type = 'consultor' WHERE funnel_type IS NULL;
UPDATE public.pipeline_stage_prompts SET funnel_type = 'consultor' WHERE funnel_type IS NULL;
UPDATE public.ranking_scores         SET funnel_type = 'consultor' WHERE funnel_type IS NULL;

-- ============================================================
-- 4) Atualizar UNIQUE constraints para incluir funnel_type
-- ============================================================

-- 4.1) ai_agent_configs: (user_id) -> (user_id, funnel_type)
DO $$
DECLARE
  cons_name text;
BEGIN
  FOR cons_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.ai_agent_configs'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%(user_id)%'
  LOOP
    EXECUTE format('ALTER TABLE public.ai_agent_configs DROP CONSTRAINT IF EXISTS %I', cons_name);
  END LOOP;
END $$;

DROP INDEX IF EXISTS public.ai_agent_configs_user_id_key;

ALTER TABLE public.ai_agent_configs
  ADD CONSTRAINT ai_agent_configs_user_funnel_unique UNIQUE (user_id, funnel_type);

-- 4.2) whatsapp_instances: garantir UNIQUE (user_id, funnel_type) sem quebrar registros existentes
--      Só adiciona se a tabela existir e não houver duplicatas conflitantes
DO $$
DECLARE
  cons_name text;
  has_dup boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='whatsapp_instances') THEN
    -- Remover constraint antiga apenas em (user_id) se existir
    FOR cons_name IN
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'public.whatsapp_instances'::regclass
        AND contype = 'u'
        AND pg_get_constraintdef(oid) = 'UNIQUE (user_id)'
    LOOP
      EXECUTE format('ALTER TABLE public.whatsapp_instances DROP CONSTRAINT IF EXISTS %I', cons_name);
    END LOOP;

    -- Verifica se existem duplicatas em (user_id, funnel_type)
    SELECT EXISTS (
      SELECT 1 FROM public.whatsapp_instances
      GROUP BY user_id, funnel_type
      HAVING count(*) > 1
    ) INTO has_dup;

    IF NOT has_dup THEN
      -- Cria UNIQUE somente se ainda não existir
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.whatsapp_instances'::regclass
          AND conname = 'whatsapp_instances_user_funnel_unique'
      ) THEN
        ALTER TABLE public.whatsapp_instances
          ADD CONSTRAINT whatsapp_instances_user_funnel_unique UNIQUE (user_id, funnel_type);
      END IF;
    END IF;
  END IF;
END $$;

-- 4.3) ranking_scores: incluir funnel_type na UNIQUE
DO $$
DECLARE
  cons_name text;
BEGIN
  FOR cons_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.ranking_scores'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.ranking_scores DROP CONSTRAINT IF EXISTS %I', cons_name);
  END LOOP;

  ALTER TABLE public.ranking_scores
    ADD CONSTRAINT ranking_scores_org_consultant_period_funnel_unique
    UNIQUE (organization_id, consultant_id, period_start, period_end, funnel_type);
END $$;

-- ============================================================
-- 5) Função helper: estágio default por funil
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_default_pipeline_stage_for_funnel(
  org_id uuid,
  p_funnel public.funnel_type DEFAULT 'consultor'
)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.pipeline_stages
  WHERE organization_id = org_id
    AND funnel_type = p_funnel
  ORDER BY order_index ASC
  LIMIT 1;
$$;

-- ============================================================
-- 6) Atualizar trigger assign_initial_pipeline_stage
--    para considerar o funnel_type do lead
-- ============================================================
CREATE OR REPLACE FUNCTION public.assign_initial_pipeline_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  first_stage_id UUID;
BEGIN
  IF NEW.pipeline_stage_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar primeiro stage da organização DENTRO do funil correto
  SELECT id INTO first_stage_id
  FROM public.pipeline_stages
  WHERE organization_id = NEW.organization_id
    AND funnel_type = COALESCE(NEW.funnel_type, 'consultor'::public.funnel_type)
  ORDER BY order_index ASC
  LIMIT 1;

  -- Fallback: se o funil ainda não tem stages, usa qualquer um da org
  IF first_stage_id IS NULL THEN
    SELECT id INTO first_stage_id
    FROM public.pipeline_stages
    WHERE organization_id = NEW.organization_id
    ORDER BY order_index ASC
    LIMIT 1;
  END IF;

  IF first_stage_id IS NOT NULL THEN
    NEW.pipeline_stage_id := first_stage_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- 7) Seed dos 5 estágios "associado" para todas as organizações
-- ============================================================
INSERT INTO public.pipeline_stages (organization_id, name, color, order_index, funnel_type)
SELECT o.id, s.name, s.color, s.order_index, 'associado'::public.funnel_type
FROM public.organizations o
CROSS JOIN (
  VALUES
    ('Novos Leads',       '#3B82F6', 0),
    ('Primeiro Contato',  '#F59E0B', 1),
    ('Proposta Enviada',  '#8B5CF6', 2),
    ('Novos Associados',  '#10B981', 3),
    ('Descartados',       '#EF4444', 4)
) AS s(name, color, order_index)
WHERE NOT EXISTS (
  SELECT 1 FROM public.pipeline_stages ps
  WHERE ps.organization_id = o.id
    AND ps.funnel_type = 'associado'::public.funnel_type
);

-- ============================================================
-- 8) Índices para performance ao filtrar por funnel_type
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_new_funnel        ON public.quiz_submissions_new (organization_id, funnel_type);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_funnel             ON public.pipeline_stages (organization_id, funnel_type, order_index);
CREATE INDEX IF NOT EXISTS idx_ranking_scores_funnel              ON public.ranking_scores (organization_id, funnel_type, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_capture_page_configs_funnel        ON public.capture_page_configs (consultant_id, funnel_type);
CREATE INDEX IF NOT EXISTS idx_followup_rules_funnel              ON public.followup_rules (user_id, funnel_type);
CREATE INDEX IF NOT EXISTS idx_pipeline_stage_prompts_funnel      ON public.pipeline_stage_prompts (user_id, funnel_type);