
-- MIGRATION 1: Add lead_source column
ALTER TABLE quiz_submissions_new 
  ADD COLUMN IF NOT EXISTS lead_source text NOT NULL DEFAULT 'quiz';

-- Update existing WhatsApp leads
UPDATE quiz_submissions_new 
SET lead_source = 'whatsapp' 
WHERE completion_percentage = 0 
  AND has_vehicle IS NULL 
  AND has_driver_license IS NULL 
  AND sales_experience IS NULL;

-- MIGRATION 2: Create capture_page_configs table
CREATE TABLE IF NOT EXISTS capture_page_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  title text DEFAULT 'Quer uma renda extra ou mudar de vida?',
  subtitle text DEFAULT 'Preencha seus dados e descubra como fazer parte do nosso time de sucesso.',
  button_text text DEFAULT 'Quero saber mais!',
  button_color text DEFAULT '#EB6608',
  hero_image text,
  redirect_type text DEFAULT 'whatsapp',
  redirect_url text,
  whatsapp_message text DEFAULT 'Olá! Vim pela página de captura e quero saber mais.',
  custom_slug text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(consultant_id)
);

ALTER TABLE capture_page_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultants can manage own capture config"
  ON capture_page_configs FOR ALL
  USING (consultant_id = get_current_consultant_id());

CREATE POLICY "Public can read active configs"
  ON capture_page_configs FOR SELECT
  USING (is_active = true);

-- MIGRATION 3: Update calculate_lead_score to respect lead_source
CREATE OR REPLACE FUNCTION public.calculate_lead_score()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    score integer := 0;
    key_points integer := 0;
    works_with_protection boolean := false;
BEGIN
    -- For non-quiz leads, skip score calculation entirely
    IF NEW.lead_source IS DISTINCT FROM 'quiz' THEN
        NEW.lead_score := 0;
        -- Temperature for non-quiz leads is managed by the pipeline trigger
        -- On insert, set to cold if not overridden
        IF NEW.temperature_override = false AND TG_OP = 'INSERT' THEN
            NEW.temperature := 'cold'::lead_temperature;
        END IF;
        RETURN NEW;
    END IF;

    -- === QUIZ LEAD SCORE CALCULATION (unchanged) ===
    IF NEW.age IS NOT NULL THEN
        IF NEW.age >= 18 AND NEW.age <= 25 THEN score := score + 15;
        ELSIF NEW.age >= 26 AND NEW.age <= 35 THEN score := score + 20;
        ELSIF NEW.age >= 36 AND NEW.age <= 45 THEN score := score + 15;
        ELSIF NEW.age >= 46 THEN score := score + 10;
        END IF;
    END IF;
    
    IF NEW.has_vehicle IS NOT NULL THEN
        IF LOWER(NEW.has_vehicle) LIKE '%ambos%' THEN 
            score := score + 25; key_points := key_points + 1;
        ELSIF LOWER(NEW.has_vehicle) LIKE '%carro%' THEN 
            score := score + 20; key_points := key_points + 1;
        ELSIF LOWER(NEW.has_vehicle) LIKE '%moto%' THEN 
            score := score + 15; key_points := key_points + 1;
        END IF;
    END IF;
    
    IF NEW.has_driver_license IS NOT NULL THEN
        IF LOWER(NEW.has_driver_license) LIKE '%sim%' THEN 
            score := score + 15; key_points := key_points + 1;
        END IF;
    END IF;
    
    IF NEW.relationship_status IS NOT NULL THEN
        IF LOWER(NEW.relationship_status) LIKE '%casado%' THEN 
            score := score + 15; key_points := key_points + 1;
        ELSIF LOWER(NEW.relationship_status) LIKE '%namorando%' THEN score := score + 10;
        ELSIF LOWER(NEW.relationship_status) LIKE '%solteiro%' THEN score := score + 10;
        ELSIF LOWER(NEW.relationship_status) LIKE '%divorciado%' THEN score := score + 12;
        END IF;
    END IF;
    
    IF NEW.employment_status IS NOT NULL THEN
        IF LOWER(NEW.employment_status) LIKE '%próprio%' THEN score := score + 20;
        ELSIF LOWER(NEW.employment_status) LIKE '%autônomo%' THEN score := score + 15;
        ELSIF LOWER(NEW.employment_status) LIKE '%clt%' OR LOWER(NEW.employment_status) LIKE '%registrado%' THEN score := score + 10;
        ELSIF LOWER(NEW.employment_status) LIKE '%desempregado%' THEN score := score + 5;
        ELSIF LOWER(NEW.employment_status) LIKE '%estudante%' THEN score := score + 5;
        END IF;
    END IF;
    
    IF NEW.sales_experience IS NOT NULL THEN
        IF LOWER(NEW.sales_experience) LIKE '%já trabalho%' THEN 
            score := score + 20; key_points := key_points + 1;
        ELSIF LOWER(NEW.sales_experience) LIKE '%já trabalhei%' THEN 
            score := score + 15; key_points := key_points + 1;
        ELSIF LOWER(NEW.sales_experience) LIKE '%interesse%' THEN score := score + 10;
        ELSE score := score + 5;
        END IF;
    END IF;
    
    IF NEW.vehicle_protection_experience IS NOT NULL THEN
        IF LOWER(NEW.vehicle_protection_experience) LIKE '%sim%' OR 
           LOWER(NEW.vehicle_protection_experience) LIKE '%já trabalho%' THEN 
            score := score + 20;
            works_with_protection := true;
        ELSE 
            score := score + 5;
        END IF;
    END IF;
    
    IF NEW.current_income IS NOT NULL THEN
        IF LOWER(NEW.current_income) LIKE '%acima%' AND LOWER(NEW.current_income) LIKE '%5.000%' THEN score := score + 20;
        ELSIF LOWER(NEW.current_income) LIKE '%3.000%' AND LOWER(NEW.current_income) LIKE '%5.000%' THEN score := score + 15;
        ELSIF LOWER(NEW.current_income) LIKE '%1.500%' AND LOWER(NEW.current_income) LIKE '%3.000%' THEN score := score + 10;
        ELSE score := score + 5;
        END IF;
    END IF;
    
    IF NEW.desired_income IS NOT NULL THEN
        IF LOWER(NEW.desired_income) LIKE '%melhor renda%' THEN score := score + 25;
        ELSIF LOWER(NEW.desired_income) LIKE '%acima%' AND LOWER(NEW.desired_income) LIKE '%12.000%' THEN score := score + 20;
        ELSIF LOWER(NEW.desired_income) LIKE '%8.000%' AND LOWER(NEW.desired_income) LIKE '%12.000%' THEN score := score + 20;
        ELSIF LOWER(NEW.desired_income) LIKE '%5.000%' AND LOWER(NEW.desired_income) LIKE '%8.000%' THEN score := score + 15;
        ELSE score := score + 10;
        END IF;
    END IF;
    
    NEW.lead_score := score;
    
    IF NEW.temperature_override = false THEN
        IF NEW.completion_percentage < 100 THEN
            NEW.temperature := 'cold'::lead_temperature;
        ELSE
            IF works_with_protection THEN
                NEW.temperature := 'hot'::lead_temperature;
            ELSIF key_points >= 3 AND score >= 80 THEN
                NEW.temperature := 'hot'::lead_temperature;
            ELSIF key_points >= 2 OR score >= 50 THEN
                NEW.temperature := 'warm'::lead_temperature;
            ELSE
                NEW.temperature := 'cold'::lead_temperature;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- MIGRATION 4: Trigger for temperature update on pipeline move (non-quiz leads)
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
    NEW.temperature := 'cold';
  ELSIF lower(stage_name) LIKE '%qualificad%' OR lower(stage_name) LIKE '%convertid%' 
        OR lower(stage_name) LIKE '%novo%consultor%' THEN
    NEW.temperature := 'hot';
  ELSIF lower(stage_name) LIKE '%contato%' THEN
    NEW.temperature := 'warm';
  ELSIF stage_order = 0 THEN
    NEW.temperature := 'cold';
  ELSIF stage_order >= (total_stages - 2) AND NOT lower(stage_name) LIKE '%descart%' THEN
    NEW.temperature := 'hot';
  ELSE
    NEW.temperature := 'warm';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_update_temp_on_pipeline_move
  BEFORE UPDATE OF pipeline_stage_id ON quiz_submissions_new
  FOR EACH ROW
  EXECUTE FUNCTION update_temperature_on_pipeline_move();

-- Enable realtime for capture_page_configs
ALTER PUBLICATION supabase_realtime ADD TABLE capture_page_configs;
