-- Garantir uma única configuração por (consultor, finalidade)
-- Primeiro deduplicar caso existam (não há, mas seguro)
WITH ranked AS (
  SELECT id, consultant_id, page_purpose,
         ROW_NUMBER() OVER (PARTITION BY consultant_id, page_purpose ORDER BY updated_at DESC NULLS LAST, created_at DESC) AS rn
  FROM public.capture_page_configs
)
DELETE FROM public.capture_page_configs WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Adicionar a constraint UNIQUE
ALTER TABLE public.capture_page_configs
  DROP CONSTRAINT IF EXISTS capture_page_configs_consultant_purpose_uniq;

ALTER TABLE public.capture_page_configs
  ADD CONSTRAINT capture_page_configs_consultant_purpose_uniq
  UNIQUE (consultant_id, page_purpose);