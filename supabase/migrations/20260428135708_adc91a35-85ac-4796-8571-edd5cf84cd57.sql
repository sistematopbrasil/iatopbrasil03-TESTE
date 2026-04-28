
-- 1. Tabela de histórico de ranking (snapshot ao resetar)
CREATE TABLE IF NOT EXISTS public.ranking_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  consultant_id uuid NOT NULL,
  funnel_type public.funnel_type NOT NULL DEFAULT 'consultor'::public.funnel_type,
  period_start date NOT NULL,
  period_end date NOT NULL,
  leads_captured integer NOT NULL DEFAULT 0,
  leads_contacted integer NOT NULL DEFAULT 0,
  leads_qualified integer NOT NULL DEFAULT 0,
  leads_converted integer NOT NULL DEFAULT 0,
  events_hosted integer NOT NULL DEFAULT 0,
  consultants_recruited integer NOT NULL DEFAULT 0,
  total_points integer,
  competition_label text NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archived_by uuid,
  source_created_at timestamptz,
  source_updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ranking_history_org ON public.ranking_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_ranking_history_label ON public.ranking_history(organization_id, competition_label);
CREATE INDEX IF NOT EXISTS idx_ranking_history_archived_at ON public.ranking_history(organization_id, archived_at DESC);

ALTER TABLE public.ranking_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin can view ranking_history" ON public.ranking_history;
CREATE POLICY "Super admin can view ranking_history"
  ON public.ranking_history FOR SELECT
  TO authenticated
  USING (public.is_super_admin() AND organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "Super admin can insert ranking_history" ON public.ranking_history;
CREATE POLICY "Super admin can insert ranking_history"
  ON public.ranking_history FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin() AND organization_id = public.get_user_organization_id());

-- 2. Função para arquivar e resetar
CREATE OR REPLACE FUNCTION public.archive_and_reset_ranking(p_competition_label text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_caller uuid;
  v_archived_count integer;
  v_label text;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_org := public.get_user_organization_id();
  v_caller := public.get_current_consultant_id();
  v_label := COALESCE(NULLIF(trim(p_competition_label), ''),
                      'Competição ' || to_char(now(), 'DD/MM/YYYY HH24:MI'));

  INSERT INTO public.ranking_history (
    organization_id, consultant_id, funnel_type,
    period_start, period_end,
    leads_captured, leads_contacted, leads_qualified, leads_converted,
    events_hosted, consultants_recruited, total_points,
    competition_label, archived_by,
    source_created_at, source_updated_at
  )
  SELECT
    organization_id, consultant_id, funnel_type,
    period_start, period_end,
    leads_captured, leads_contacted, leads_qualified, leads_converted,
    events_hosted, consultants_recruited, total_points,
    v_label, v_caller,
    created_at, updated_at
  FROM public.ranking_scores
  WHERE organization_id = v_org;

  GET DIAGNOSTICS v_archived_count = ROW_COUNT;

  DELETE FROM public.ranking_scores WHERE organization_id = v_org;

  -- Auditoria
  BEGIN
    INSERT INTO public.crm_audit_logs (
      user_id, organization_id, action, resource_type, metadata
    ) VALUES (
      v_caller, v_org, 'ranking.archive_and_reset', 'ranking_scores',
      jsonb_build_object('competition_label', v_label, 'rows_archived', v_archived_count)
    );
  EXCEPTION WHEN OTHERS THEN
    -- não bloquear por log
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'competition_label', v_label,
    'rows_archived', v_archived_count
  );
END;
$$;

-- 3. Listar histórico agrupado por competição
CREATE OR REPLACE FUNCTION public.list_ranking_history()
RETURNS TABLE(
  competition_label text,
  archived_at timestamptz,
  total_consultants bigint,
  total_points bigint,
  total_captured bigint,
  total_converted bigint,
  total_recruited bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_org := public.get_user_organization_id();

  RETURN QUERY
    SELECT
      h.competition_label,
      MAX(h.archived_at) AS archived_at,
      COUNT(DISTINCT h.consultant_id) AS total_consultants,
      COALESCE(SUM(h.total_points), 0)::bigint AS total_points,
      COALESCE(SUM(h.leads_captured), 0)::bigint AS total_captured,
      COALESCE(SUM(h.leads_converted), 0)::bigint AS total_converted,
      COALESCE(SUM(h.consultants_recruited), 0)::bigint AS total_recruited
    FROM public.ranking_history h
    WHERE h.organization_id = v_org
    GROUP BY h.competition_label
    ORDER BY MAX(h.archived_at) DESC;
END;
$$;

-- 4. Detalhes de uma competição específica
CREATE OR REPLACE FUNCTION public.get_ranking_history_details(p_competition_label text)
RETURNS TABLE(
  consultant_id uuid,
  full_name text,
  funnel_type public.funnel_type,
  total_points integer,
  leads_captured integer,
  leads_contacted integer,
  leads_qualified integer,
  leads_converted integer,
  consultants_recruited integer,
  archived_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_org := public.get_user_organization_id();

  RETURN QUERY
    SELECT
      h.consultant_id,
      u.full_name,
      h.funnel_type,
      COALESCE(h.total_points, 0),
      h.leads_captured,
      h.leads_contacted,
      h.leads_qualified,
      h.leads_converted,
      h.consultants_recruited,
      h.archived_at
    FROM public.ranking_history h
    LEFT JOIN public.users u ON u.id = h.consultant_id
    WHERE h.organization_id = v_org
      AND h.competition_label = p_competition_label
    ORDER BY COALESCE(h.total_points, 0) DESC;
END;
$$;
