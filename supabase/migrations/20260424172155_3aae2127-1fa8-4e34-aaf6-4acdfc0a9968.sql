-- Função que retorna o stage de conversão final por funil
-- Para 'consultor' busca stage com nome contendo 'consultor' (excluindo 'novos leads')
-- Para 'associado' busca stage com nome contendo 'associad' (excluindo 'novos leads')
CREATE OR REPLACE FUNCTION public.get_conversion_stage_id_by_funnel(
  org_id uuid,
  p_funnel public.funnel_type DEFAULT 'consultor'::public.funnel_type
)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id
  FROM public.pipeline_stages
  WHERE organization_id = org_id
    AND funnel_type = p_funnel
    AND (
      (p_funnel = 'consultor' AND lower(name) LIKE '%consultor%' AND lower(name) NOT LIKE '%novos leads%')
      OR
      (p_funnel = 'associado' AND lower(name) LIKE '%associad%' AND lower(name) NOT LIKE '%novos leads%')
    )
  ORDER BY order_index DESC
  LIMIT 1;
$$;