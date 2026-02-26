
-- 1. Rename "Convertidos" to "Consultor" in all organizations
UPDATE public.pipeline_stages 
SET name = 'Consultor', updated_at = now()
WHERE lower(name) = 'convertidos';

-- 2. Update get_novos_consultores_stage_id to detect "consultor" without requiring "novos"
CREATE OR REPLACE FUNCTION public.get_novos_consultores_stage_id(org_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id
  FROM public.pipeline_stages
  WHERE organization_id = org_id
    AND lower(name) LIKE '%consultor%'
  ORDER BY order_index ASC
  LIMIT 1;
$function$;

-- 3. Update map_stage_enum_to_uuid to map 'convertido' to 'Consultor'
CREATE OR REPLACE FUNCTION public.map_stage_enum_to_uuid(stage_name text, org_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  stage_id UUID;
  name_mapping TEXT;
BEGIN
  name_mapping := CASE stage_name
    WHEN 'novo' THEN 'Novos Leads'
    WHEN 'contatado' THEN 'Contato Inicial'
    WHEN 'qualificado' THEN 'Qualificados'
    WHEN 'convertido' THEN 'Consultor'
    WHEN 'descartado' THEN 'Descartados'
    ELSE 'Novos Leads'
  END;
  
  SELECT id INTO stage_id
  FROM public.pipeline_stages
  WHERE organization_id = org_id
    AND (name = name_mapping OR LOWER(name) LIKE '%' || LOWER(stage_name) || '%')
  LIMIT 1;
  
  IF stage_id IS NULL THEN
    SELECT id INTO stage_id
    FROM public.pipeline_stages
    WHERE organization_id = org_id
    ORDER BY order_index ASC
    LIMIT 1;
  END IF;
  
  RETURN stage_id;
END;
$function$;

-- 4. Update temperature trigger to also detect 'consultor' stage
CREATE OR REPLACE FUNCTION public.update_temperature_on_pipeline_move()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  stage_name text;
  stage_order int;
  total_stages int;
BEGIN
  IF NEW.pipeline_stage_id IS NOT DISTINCT FROM OLD.pipeline_stage_id THEN
    RETURN NEW;
  END IF;

  IF NEW.lead_source = 'quiz' OR NEW.temperature_override = true THEN
    RETURN NEW;
  END IF;

  SELECT ps.name, ps.order_index INTO stage_name, stage_order
  FROM pipeline_stages ps WHERE ps.id = NEW.pipeline_stage_id;

  SELECT count(*) INTO total_stages
  FROM pipeline_stages WHERE organization_id = NEW.organization_id;

  IF lower(stage_name) LIKE '%descart%' THEN
    NEW.temperature := 'cold'::lead_temperature;
  ELSIF lower(stage_name) LIKE '%qualificad%' OR lower(stage_name) LIKE '%consultor%' THEN
    NEW.temperature := 'hot'::lead_temperature;
  ELSIF lower(stage_name) LIKE '%contato%' THEN
    NEW.temperature := 'warm'::lead_temperature;
  ELSIF stage_order = 0 THEN
    NEW.temperature := 'cold'::lead_temperature;
  ELSIF stage_order >= (total_stages - 2) AND NOT lower(stage_name) LIKE '%descart%' THEN
    NEW.temperature := 'hot'::lead_temperature;
  ELSE
    NEW.temperature := 'warm'::lead_temperature;
  END IF;

  RETURN NEW;
END;
$function$;
