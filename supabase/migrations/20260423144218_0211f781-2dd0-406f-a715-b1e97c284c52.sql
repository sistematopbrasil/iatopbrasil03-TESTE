-- 1) Adicionar funnel_type em quiz_questions
ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS funnel_type public.funnel_type NOT NULL DEFAULT 'consultor';

CREATE INDEX IF NOT EXISTS idx_quiz_questions_consultant_funnel
  ON public.quiz_questions(consultant_id, funnel_type, order_index);

-- 2) Seed: para cada consultor que ainda NAO tem perguntas no funil 'associado', criar as 6 perguntas-padrao
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT u.id
    FROM public.users u
    WHERE u.role IN ('admin', 'consultor', 'super_admin')
      AND NOT EXISTS (
        SELECT 1 FROM public.quiz_questions q
        WHERE q.consultant_id = u.id AND q.funnel_type = 'associado'
      )
  LOOP
    INSERT INTO public.quiz_questions (consultant_id, question_text, question_type, options, order_index, is_active, is_default, funnel_type)
    VALUES
      (c.id, 'Qual é o seu nome completo?', 'open_text', NULL, 1, true, true, 'associado'),
      (c.id, 'Qual é o seu telefone/WhatsApp para eu te enviar o resultado do seu perfil?', 'open_text', NULL, 2, true, true, 'associado'),
      (c.id, 'Qual a sua idade?', 'open_text', NULL, 3, true, true, 'associado'),
      (c.id, 'Qual a sua cidade e estado?', 'open_text', NULL, 5, true, true, 'associado'),
      (c.id, 'Você possui carro ou moto?', 'multiple_choice',
        '["Sim, carro.", "Sim, moto.", "Possui ambos (carro e moto).", "Não tenho veículo."]'::jsonb,
        6, true, true, 'associado'),
      (c.id, 'Você possui CNH (Carteira Nacional de Habilitação)?', 'multiple_choice',
        '["Sim, possuo CNH", "Não possuo CNH eu preciso"]'::jsonb,
        7, true, true, 'associado');
  END LOOP;
END $$;

-- 3) Atualizar calculate_lead_score: Associados nao-quiz comecam morno
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
        -- Temperatura inicial: associados nao-quiz = morno; consultores nao-quiz = frio (legado)
        IF NEW.temperature_override = false AND TG_OP = 'INSERT' THEN
            IF NEW.funnel_type = 'associado'::public.funnel_type THEN
                NEW.temperature := 'warm'::lead_temperature;
            ELSE
                NEW.temperature := 'cold'::lead_temperature;
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    -- === QUIZ LEAD SCORE CALCULATION (mantido) ===
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

-- 4) Atualizar update_temperature_on_pipeline_move: Associados so vira frio em "Descartados"
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

  -- Funil de Associados: morno por padrao, frio so em Descartados, quente em stages avancados/qualificados
  IF NEW.funnel_type = 'associado'::public.funnel_type THEN
    IF lower(stage_name) LIKE '%descart%' THEN
      NEW.temperature := 'cold'::lead_temperature;
    ELSIF lower(stage_name) LIKE '%qualificad%' OR lower(stage_name) LIKE '%fechad%' OR lower(stage_name) LIKE '%convertid%' OR lower(stage_name) LIKE '%ganho%' OR lower(stage_name) LIKE '%associad%' THEN
      NEW.temperature := 'hot'::lead_temperature;
    ELSE
      NEW.temperature := 'warm'::lead_temperature;
    END IF;
    RETURN NEW;
  END IF;

  -- Funil de Consultores: comportamento legado preservado
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

-- 5) Backfill: leads de Associados nao-quiz que estao frios mas nao em "Descartados" -> morno
UPDATE public.quiz_submissions_new q
SET temperature = 'warm'::public.lead_temperature, updated_at = now()
WHERE q.funnel_type = 'associado'::public.funnel_type
  AND q.lead_source <> 'quiz'
  AND COALESCE(q.temperature_override, false) = false
  AND q.temperature = 'cold'::public.lead_temperature
  AND (
    q.pipeline_stage_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.pipeline_stages ps
      WHERE ps.id = q.pipeline_stage_id AND lower(ps.name) LIKE '%descart%'
    )
  );