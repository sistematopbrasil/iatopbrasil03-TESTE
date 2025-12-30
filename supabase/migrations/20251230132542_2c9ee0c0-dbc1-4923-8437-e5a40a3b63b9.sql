-- Update get_consultant_ranking_dynamic to filter by the current user's organization
-- This fixes the cross-org data leakage and score inconsistency issues
CREATE OR REPLACE FUNCTION public.get_consultant_ranking_dynamic(
  period_start timestamp with time zone DEFAULT NULL::timestamp with time zone, 
  period_end timestamp with time zone DEFAULT now()
) 
RETURNS TABLE(
  consultant_id uuid, 
  full_name text, 
  quiz_slug text, 
  total_leads bigint, 
  hot_leads bigint, 
  warm_leads bigint, 
  cold_leads bigint, 
  conversion_rate numeric, 
  last_lead_date timestamp with time zone, 
  ranking_position bigint
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_org_id uuid;
BEGIN
  -- Get the organization ID of the current user
  user_org_id := get_user_organization_id();
  
  RETURN QUERY
  WITH ranked_consultants AS (
    SELECT 
      u.id as cid,
      u.full_name as fname,
      u.quiz_slug as qslug,
      COUNT(l.id) as tleads,
      COUNT(l.id) FILTER (WHERE l.temperature = 'hot') as hleads,
      COUNT(l.id) FILTER (WHERE l.temperature = 'warm') as wleads,
      COUNT(l.id) FILTER (WHERE l.temperature = 'cold') as cleads,
      ROUND(
        COALESCE(
          (COUNT(l.id) FILTER (WHERE l.temperature = 'hot')::NUMERIC / 
           NULLIF(COUNT(l.id), 0) * 100), 
          0
        ),
        1
      ) as crate,
      MAX(l.created_at) as ldate
    FROM users u
    LEFT JOIN quiz_submissions_new l ON l.consultant_id = u.id 
      AND l.completion_percentage = 100
      AND (period_start IS NULL OR l.created_at >= period_start)
      AND l.created_at <= period_end
    WHERE u.role IN ('admin', 'consultor')
      AND u.is_active = true
      AND u.organization_id = user_org_id
    GROUP BY u.id, u.full_name, u.quiz_slug
  )
  SELECT 
    rc.cid,
    rc.fname,
    rc.qslug,
    rc.tleads,
    rc.hleads,
    rc.wleads,
    rc.cleads,
    rc.crate,
    rc.ldate,
    ROW_NUMBER() OVER (ORDER BY rc.tleads DESC, rc.hleads DESC, rc.crate DESC)
  FROM ranked_consultants rc;
END;
$$;