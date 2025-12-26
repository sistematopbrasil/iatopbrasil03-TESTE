-- Fix lead visibility + stabilize ranking points via backend trigger

-- 1) Tighten SELECT policy for quiz_submissions_new (remove last-1h public leak)
DROP POLICY IF EXISTS "Consultants can view their submissions or super admin sees all" ON public.quiz_submissions_new;
CREATE POLICY "Consultants can view their submissions or super admin sees all"
ON public.quiz_submissions_new
FOR SELECT
USING (
  (consultant_id = get_current_consultant_id())
  OR is_super_admin()
);

-- 2) Helper: stage id for "Novos Consultores" per organization
CREATE OR REPLACE FUNCTION public.get_novos_consultores_stage_id(org_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.pipeline_stages
  WHERE organization_id = org_id
    AND lower(name) LIKE '%novos%'
    AND lower(name) LIKE '%consultor%'
  ORDER BY order_index ASC
  LIMIT 1;
$$;

-- 3) Trigger to keep ranking_scores.consultants_recruited in sync with pipeline_stage_id
CREATE OR REPLACE FUNCTION public.sync_ranking_consultants_recruited()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_id uuid;
  old_in boolean;
  new_in boolean;
  delta int := 0;
  ps date;
  pe date;
BEGIN
  ps := date_trunc('month', now())::date;
  pe := (date_trunc('month', now()) + interval '1 month - 1 day')::date;

  IF TG_OP = 'UPDATE' THEN
    -- Only act when pipeline_stage_id actually changes
    IF NEW.pipeline_stage_id IS NOT DISTINCT FROM OLD.pipeline_stage_id THEN
      RETURN NEW;
    END IF;

    IF NEW.consultant_id IS NULL OR NEW.organization_id IS NULL THEN
      RETURN NEW;
    END IF;

    stage_id := public.get_novos_consultores_stage_id(NEW.organization_id);
    IF stage_id IS NULL THEN
      RETURN NEW;
    END IF;

    old_in := (OLD.pipeline_stage_id = stage_id);
    new_in := (NEW.pipeline_stage_id = stage_id);

    IF old_in = new_in THEN
      RETURN NEW;
    END IF;

    delta := CASE WHEN new_in THEN 1 ELSE -1 END;

    INSERT INTO public.ranking_scores (
      consultant_id,
      organization_id,
      period_start,
      period_end,
      consultants_recruited
    ) VALUES (
      NEW.consultant_id,
      NEW.organization_id,
      ps,
      pe,
      GREATEST(delta, 0)
    )
    ON CONFLICT (organization_id, consultant_id, period_start, period_end)
    DO UPDATE
      SET consultants_recruited = GREATEST(0, public.ranking_scores.consultants_recruited + delta),
          updated_at = now();

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.consultant_id IS NULL OR OLD.organization_id IS NULL THEN
      RETURN OLD;
    END IF;

    stage_id := public.get_novos_consultores_stage_id(OLD.organization_id);
    IF stage_id IS NULL THEN
      RETURN OLD;
    END IF;

    IF OLD.pipeline_stage_id <> stage_id THEN
      RETURN OLD;
    END IF;

    UPDATE public.ranking_scores
      SET consultants_recruited = GREATEST(0, consultants_recruited - 1),
          updated_at = now()
    WHERE organization_id = OLD.organization_id
      AND consultant_id = OLD.consultant_id
      AND period_start = ps
      AND period_end = pe;

    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4) Triggers
DROP TRIGGER IF EXISTS trg_sync_ranking_consultants_recruited ON public.quiz_submissions_new;
CREATE TRIGGER trg_sync_ranking_consultants_recruited
AFTER UPDATE OF pipeline_stage_id ON public.quiz_submissions_new
FOR EACH ROW
EXECUTE FUNCTION public.sync_ranking_consultants_recruited();

DROP TRIGGER IF EXISTS trg_sync_ranking_consultants_recruited_delete ON public.quiz_submissions_new;
CREATE TRIGGER trg_sync_ranking_consultants_recruited_delete
AFTER DELETE ON public.quiz_submissions_new
FOR EACH ROW
EXECUTE FUNCTION public.sync_ranking_consultants_recruited();

-- 5) Backfill current month so existing leads already in "Novos Consultores" count immediately
DO $$
DECLARE
  ps date := date_trunc('month', now())::date;
  pe date := (date_trunc('month', now()) + interval '1 month - 1 day')::date;
BEGIN
  INSERT INTO public.ranking_scores (
    consultant_id,
    organization_id,
    period_start,
    period_end,
    consultants_recruited
  )
  SELECT
    q.consultant_id,
    q.organization_id,
    ps,
    pe,
    COUNT(*)::int
  FROM public.quiz_submissions_new q
  WHERE q.consultant_id IS NOT NULL
    AND q.organization_id IS NOT NULL
    AND q.pipeline_stage_id = public.get_novos_consultores_stage_id(q.organization_id)
  GROUP BY q.consultant_id, q.organization_id
  ON CONFLICT (organization_id, consultant_id, period_start, period_end)
  DO UPDATE
    SET consultants_recruited = EXCLUDED.consultants_recruited,
        updated_at = now();

  UPDATE public.ranking_scores rs
    SET consultants_recruited = 0,
        updated_at = now()
  WHERE rs.period_start = ps
    AND rs.period_end = pe
    AND NOT EXISTS (
      SELECT 1
      FROM public.quiz_submissions_new q
      WHERE q.consultant_id = rs.consultant_id
        AND q.organization_id = rs.organization_id
        AND q.pipeline_stage_id = public.get_novos_consultores_stage_id(rs.organization_id)
    );
END $$;
