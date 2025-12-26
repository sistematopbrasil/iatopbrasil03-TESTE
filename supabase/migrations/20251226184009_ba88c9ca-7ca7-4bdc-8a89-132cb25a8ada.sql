
-- Recalcular consultants_recruited para todos os consultores baseado no estado atual
-- Primeiro, resetar todos para 0
UPDATE public.ranking_scores SET consultants_recruited = 0, updated_at = now();

-- Recalcular com base nos leads que REALMENTE estão em "Novos Consultores"
WITH counts AS (
  SELECT 
    q.consultant_id,
    q.organization_id,
    COUNT(*) as recruited_count
  FROM quiz_submissions_new q
  INNER JOIN pipeline_stages ps ON q.pipeline_stage_id = ps.id
  WHERE LOWER(ps.name) LIKE '%novo%' AND LOWER(ps.name) LIKE '%consultor%'
    AND q.consultant_id IS NOT NULL
  GROUP BY q.consultant_id, q.organization_id
)
UPDATE public.ranking_scores rs
SET 
  consultants_recruited = c.recruited_count,
  updated_at = now()
FROM counts c
WHERE rs.consultant_id = c.consultant_id
  AND rs.organization_id = c.organization_id
  AND rs.period_start = date_trunc('month', now())::date
  AND rs.period_end = (date_trunc('month', now()) + interval '1 month - 1 day')::date;
