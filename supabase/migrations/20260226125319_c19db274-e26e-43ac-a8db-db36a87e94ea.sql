
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
  ELSIF lower(stage_name) LIKE '%qualificad%' OR lower(stage_name) LIKE '%convertid%' 
        OR lower(stage_name) LIKE '%novo%consultor%' THEN
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
