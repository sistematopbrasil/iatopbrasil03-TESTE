-- Tabela de competições (marco para reset de ranking)
CREATE TABLE IF NOT EXISTS public.ranking_competitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  label TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  is_current BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Apenas uma competição corrente por org
CREATE UNIQUE INDEX IF NOT EXISTS idx_ranking_competitions_one_current
  ON public.ranking_competitions (organization_id)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_ranking_competitions_org
  ON public.ranking_competitions (organization_id, started_at DESC);

ALTER TABLE public.ranking_competitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin manages competitions" ON public.ranking_competitions;
CREATE POLICY "Super admin manages competitions"
  ON public.ranking_competitions FOR ALL
  TO authenticated
  USING (is_super_admin() AND organization_id = get_user_organization_id())
  WITH CHECK (is_super_admin() AND organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Org users can view current competition" ON public.ranking_competitions;
CREATE POLICY "Org users can view current competition"
  ON public.ranking_competitions FOR SELECT
  TO authenticated
  USING (organization_id = get_user_organization_id());

-- Seed: criar competição corrente para cada org existente (started_at = MIN(quiz_submissions_new.created_at) ou now)
INSERT INTO public.ranking_competitions (organization_id, label, started_at, is_current)
SELECT
  o.id,
  'Competição inicial',
  COALESCE(
    (SELECT MIN(created_at) FROM public.quiz_submissions_new q WHERE q.organization_id = o.id),
    now()
  ),
  true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.ranking_competitions c
  WHERE c.organization_id = o.id AND c.is_current = true
);

-- Função: pegar started_at da competição corrente (chamada pela edge function ranking-get)
CREATE OR REPLACE FUNCTION public.get_current_competition_start(p_org_id UUID)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT started_at
  FROM public.ranking_competitions
  WHERE organization_id = p_org_id AND is_current = true
  LIMIT 1;
$$;

-- Substituir archive_and_reset_ranking: agora rotaciona competições.
-- O snapshot histórico é construído a partir dos LEADS reais do período (não mais de ranking_scores).
CREATE OR REPLACE FUNCTION public.archive_and_reset_ranking(p_competition_label text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_caller uuid;
  v_label text;
  v_old_id uuid;
  v_old_started timestamp with time zone;
  v_archived_count integer := 0;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_org := public.get_user_organization_id();
  v_caller := public.get_current_consultant_id();
  v_label := COALESCE(NULLIF(trim(p_competition_label), ''),
                      'Competição ' || to_char(now(), 'DD/MM/YYYY HH24:MI'));

  -- Pega competição atual (se existir)
  SELECT id, started_at INTO v_old_id, v_old_started
  FROM public.ranking_competitions
  WHERE organization_id = v_org AND is_current = true
  LIMIT 1;

  -- Snapshot por consultor a partir dos leads reais do período da competição que está fechando
  IF v_old_id IS NOT NULL THEN
    INSERT INTO public.ranking_history (
      organization_id, consultant_id, funnel_type,
      period_start, period_end,
      leads_captured, leads_contacted, leads_qualified, leads_converted,
      events_hosted, consultants_recruited, total_points,
      competition_label, archived_by,
      source_created_at, source_updated_at
    )
    SELECT
      v_org,
      q.consultant_id,
      COALESCE(q.funnel_type, 'consultor'::public.funnel_type),
      v_old_started::date,
      now()::date,
      COUNT(*)::int,                                                  -- captured
      0,                                                              -- contacted (não rastreado)
      COUNT(*) FILTER (WHERE q.temperature = 'hot')::int,             -- qualified ~ hot
      COUNT(*) FILTER (
        WHERE q.pipeline_stage_id IN (
          SELECT id FROM public.pipeline_stages
          WHERE organization_id = v_org
            AND (lower(name) LIKE '%consultor%' OR lower(name) LIKE '%associad%' OR lower(name) LIKE '%convertid%' OR lower(name) LIKE '%fechad%' OR lower(name) LIKE '%ganho%')
            AND lower(name) NOT LIKE '%novos leads%'
        )
      )::int,                                                         -- converted
      0,                                                              -- events
      COUNT(*) FILTER (
        WHERE q.pipeline_stage_id = public.get_novos_consultores_stage_id(v_org)
      )::int,                                                         -- recruited
      (
        COUNT(*) FILTER (WHERE q.temperature = 'hot') * 30 +
        COUNT(*) FILTER (WHERE q.temperature = 'warm') * 15 +
        COUNT(*) FILTER (WHERE q.temperature = 'cold' OR q.temperature IS NULL) * 5
      )::int,                                                         -- total_points
      v_label,
      v_caller,
      MIN(q.created_at),
      MAX(q.updated_at)
    FROM public.quiz_submissions_new q
    WHERE q.organization_id = v_org
      AND q.consultant_id IS NOT NULL
      AND q.created_at >= v_old_started
      AND q.created_at <= now()
    GROUP BY q.consultant_id, q.funnel_type;

    GET DIAGNOSTICS v_archived_count = ROW_COUNT;

    -- Fecha a competição anterior
    UPDATE public.ranking_competitions
    SET is_current = false, ended_at = now()
    WHERE id = v_old_id;
  END IF;

  -- Limpa ranking_scores legados (mantém compatibilidade)
  DELETE FROM public.ranking_scores WHERE organization_id = v_org;

  -- Cria nova competição corrente
  INSERT INTO public.ranking_competitions (organization_id, label, started_at, is_current, created_by)
  VALUES (v_org, v_label, now(), true, v_caller);

  -- Auditoria (best-effort)
  BEGIN
    INSERT INTO public.crm_audit_logs (user_id, organization_id, action, resource_type, metadata)
    VALUES (v_caller, v_org, 'ranking.archive_and_reset', 'ranking_competitions',
            jsonb_build_object('competition_label', v_label, 'rows_archived', v_archived_count));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'competition_label', v_label,
    'rows_archived', v_archived_count
  );
END;
$$;