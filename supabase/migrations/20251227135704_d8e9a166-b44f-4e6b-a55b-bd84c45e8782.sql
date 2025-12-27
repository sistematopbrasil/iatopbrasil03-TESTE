-- Remove duplicate triggers on quiz_submissions_new
-- Keep only one UPDATE trigger and one DELETE trigger

-- Drop the duplicate UPDATE trigger
DROP TRIGGER IF EXISTS trg_sync_ranking_consultants_recruited ON public.quiz_submissions_new;

-- Drop the duplicate DELETE trigger
DROP TRIGGER IF EXISTS trg_sync_ranking_consultants_recruited_delete ON public.quiz_submissions_new;

-- Now recalibrate consultants_recruited for current month
-- Reset all to 0 first
UPDATE public.ranking_scores
SET consultants_recruited = 0, updated_at = now()
WHERE period_start = date_trunc('month', now())::date
  AND period_end = (date_trunc('month', now()) + interval '1 month - 1 day')::date;

-- Recalculate based on actual leads in "Novos Consultores" stage
WITH novos_counts AS (
  SELECT 
    q.consultant_id,
    q.organization_id,
    COUNT(*) as recruited_count
  FROM public.quiz_submissions_new q
  JOIN public.pipeline_stages ps ON q.pipeline_stage_id = ps.id
  WHERE ps.name ILIKE '%novos%' AND ps.name ILIKE '%consultor%'
    AND q.consultant_id IS NOT NULL
  GROUP BY q.consultant_id, q.organization_id
)
INSERT INTO public.ranking_scores (
  consultant_id,
  organization_id,
  period_start,
  period_end,
  consultants_recruited
)
SELECT 
  nc.consultant_id,
  nc.organization_id,
  date_trunc('month', now())::date,
  (date_trunc('month', now()) + interval '1 month - 1 day')::date,
  nc.recruited_count
FROM novos_counts nc
ON CONFLICT (organization_id, consultant_id, period_start, period_end)
DO UPDATE SET 
  consultants_recruited = EXCLUDED.consultants_recruited,
  updated_at = now();