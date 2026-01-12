-- 1. Adicionar coluna temperature_override para permitir override manual da temperatura
ALTER TABLE public.quiz_submissions_new 
ADD COLUMN IF NOT EXISTS temperature_override boolean NOT NULL DEFAULT false;

-- 2. Atualizar a função calculate_lead_score para respeitar o override
CREATE OR REPLACE FUNCTION public.calculate_lead_score()
RETURNS TRIGGER AS $$
DECLARE
    score integer := 0;
    key_points integer := 0;
    works_with_protection boolean := false;
BEGIN
    -- Calcular score numérico
    -- Idade (max 20 pts)
    IF NEW.age IS NOT NULL THEN
        IF NEW.age >= 18 AND NEW.age <= 25 THEN score := score + 15;
        ELSIF NEW.age >= 26 AND NEW.age <= 35 THEN score := score + 20;
        ELSIF NEW.age >= 36 AND NEW.age <= 45 THEN score := score + 15;
        ELSIF NEW.age >= 46 THEN score := score + 10;
        END IF;
    END IF;
    
    -- Veículo (max 25 pts)
    IF NEW.has_vehicle IS NOT NULL THEN
        IF LOWER(NEW.has_vehicle) LIKE '%ambos%' THEN 
            score := score + 25;
            key_points := key_points + 1;
        ELSIF LOWER(NEW.has_vehicle) LIKE '%carro%' THEN 
            score := score + 20;
            key_points := key_points + 1;
        ELSIF LOWER(NEW.has_vehicle) LIKE '%moto%' THEN 
            score := score + 15;
            key_points := key_points + 1;
        END IF;
    END IF;
    
    -- CNH (max 15 pts)
    IF NEW.has_driver_license IS NOT NULL THEN
        IF LOWER(NEW.has_driver_license) LIKE '%sim%' THEN 
            score := score + 15;
            key_points := key_points + 1;
        END IF;
    END IF;
    
    -- Estado civil (max 15 pts)
    IF NEW.relationship_status IS NOT NULL THEN
        IF LOWER(NEW.relationship_status) LIKE '%casado%' THEN 
            score := score + 15;
            key_points := key_points + 1;
        ELSIF LOWER(NEW.relationship_status) LIKE '%namorando%' THEN score := score + 10;
        ELSIF LOWER(NEW.relationship_status) LIKE '%solteiro%' THEN score := score + 10;
        ELSIF LOWER(NEW.relationship_status) LIKE '%divorciado%' THEN score := score + 12;
        END IF;
    END IF;
    
    -- Situação profissional (max 20 pts)
    IF NEW.employment_status IS NOT NULL THEN
        IF LOWER(NEW.employment_status) LIKE '%próprio%' THEN score := score + 20;
        ELSIF LOWER(NEW.employment_status) LIKE '%autônomo%' THEN score := score + 15;
        ELSIF LOWER(NEW.employment_status) LIKE '%clt%' OR LOWER(NEW.employment_status) LIKE '%registrado%' THEN score := score + 10;
        ELSIF LOWER(NEW.employment_status) LIKE '%desempregado%' THEN score := score + 5;
        ELSIF LOWER(NEW.employment_status) LIKE '%estudante%' THEN score := score + 5;
        END IF;
    END IF;
    
    -- Experiência em vendas (max 20 pts)
    IF NEW.sales_experience IS NOT NULL THEN
        IF LOWER(NEW.sales_experience) LIKE '%já trabalho%' THEN 
            score := score + 20;
            key_points := key_points + 1;
        ELSIF LOWER(NEW.sales_experience) LIKE '%já trabalhei%' THEN 
            score := score + 15;
            key_points := key_points + 1;
        ELSIF LOWER(NEW.sales_experience) LIKE '%interesse%' THEN score := score + 10;
        ELSE score := score + 5;
        END IF;
    END IF;
    
    -- Proteção veicular (max 20 pts)
    IF NEW.vehicle_protection_experience IS NOT NULL THEN
        IF LOWER(NEW.vehicle_protection_experience) LIKE '%sim%' OR 
           LOWER(NEW.vehicle_protection_experience) LIKE '%já trabalho%' THEN 
            score := score + 20;
            works_with_protection := true;
        ELSE 
            score := score + 5;
        END IF;
    END IF;
    
    -- Renda atual (max 20 pts)
    IF NEW.current_income IS NOT NULL THEN
        IF LOWER(NEW.current_income) LIKE '%acima%' AND LOWER(NEW.current_income) LIKE '%5.000%' THEN score := score + 20;
        ELSIF LOWER(NEW.current_income) LIKE '%3.000%' AND LOWER(NEW.current_income) LIKE '%5.000%' THEN score := score + 15;
        ELSIF LOWER(NEW.current_income) LIKE '%1.500%' AND LOWER(NEW.current_income) LIKE '%3.000%' THEN score := score + 10;
        ELSE score := score + 5;
        END IF;
    END IF;
    
    -- Renda desejada (max 25 pts)
    IF NEW.desired_income IS NOT NULL THEN
        IF LOWER(NEW.desired_income) LIKE '%melhor renda%' THEN score := score + 25;
        ELSIF LOWER(NEW.desired_income) LIKE '%acima%' AND LOWER(NEW.desired_income) LIKE '%12.000%' THEN score := score + 20;
        ELSIF LOWER(NEW.desired_income) LIKE '%8.000%' AND LOWER(NEW.desired_income) LIKE '%12.000%' THEN score := score + 20;
        ELSIF LOWER(NEW.desired_income) LIKE '%5.000%' AND LOWER(NEW.desired_income) LIKE '%8.000%' THEN score := score + 15;
        ELSE score := score + 10;
        END IF;
    END IF;
    
    -- Atribuir score
    NEW.lead_score := score;
    
    -- ✅ NOVO: Só recalcular temperatura se NÃO for override manual
    IF NEW.temperature_override = false THEN
        -- REGRA ORIGINAL: Lead veio do quiz incompleto = frio
        IF NEW.completion_percentage < 100 THEN
            NEW.temperature := 'cold'::lead_temperature;
        ELSE
            -- Lead do quiz completo: calcular temperatura pelo score
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
    -- Se temperature_override = true, manter a temperatura que foi definida manualmente
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3. Reparar dados: garantir que conversas estejam linkadas a leads do mesmo consultor
-- 3.1 Vincular conversas a leads existentes do mesmo consultor
UPDATE public.crm_conversations cc
SET lead_id = sub.lead_id,
    updated_at = now()
FROM (
  SELECT DISTINCT ON (cc2.id)
    cc2.id as conversation_id,
    qsn.id as lead_id
  FROM public.crm_conversations cc2
  INNER JOIN public.quiz_submissions_new qsn 
    ON qsn.organization_id = cc2.organization_id
    AND qsn.consultant_id = cc2.user_id
    AND public.normalize_br_phone(qsn.phone) = public.normalize_br_phone(cc2.contact_phone)
  WHERE cc2.lead_id IS NULL 
     OR NOT EXISTS (
       SELECT 1 FROM public.quiz_submissions_new qsn2 
       WHERE qsn2.id = cc2.lead_id AND qsn2.consultant_id = cc2.user_id
     )
  ORDER BY cc2.id, qsn.created_at DESC
) sub
WHERE cc.id = sub.conversation_id;

-- 3.2 Criar leads para conversas que ainda não têm lead do mesmo consultor
INSERT INTO public.quiz_submissions_new (
  organization_id,
  consultant_id,
  name,
  phone,
  completion_percentage,
  pipeline_stage_id,
  stage,
  temperature,
  created_at,
  updated_at
)
SELECT DISTINCT ON (cc.id)
  cc.organization_id,
  cc.user_id,
  COALESCE(cc.contact_name, 'Contato WhatsApp'),
  public.normalize_br_phone(cc.contact_phone),
  0,
  ps.id,
  'novo'::lead_stage,
  'cold'::lead_temperature,
  cc.created_at,
  now()
FROM public.crm_conversations cc
JOIN public.pipeline_stages ps 
  ON ps.organization_id = cc.organization_id 
  AND ps.order_index = 0
WHERE cc.lead_id IS NULL 
   OR NOT EXISTS (
     SELECT 1 FROM public.quiz_submissions_new qsn 
     WHERE qsn.id = cc.lead_id AND qsn.consultant_id = cc.user_id
   )
ORDER BY cc.id, cc.created_at DESC;

-- 3.3 Vincular as conversas recém-criadas aos leads
UPDATE public.crm_conversations cc
SET lead_id = sub.lead_id,
    updated_at = now()
FROM (
  SELECT DISTINCT ON (cc2.id)
    cc2.id as conversation_id,
    qsn.id as lead_id
  FROM public.crm_conversations cc2
  INNER JOIN public.quiz_submissions_new qsn 
    ON qsn.organization_id = cc2.organization_id
    AND qsn.consultant_id = cc2.user_id
    AND public.normalize_br_phone(qsn.phone) = public.normalize_br_phone(cc2.contact_phone)
  WHERE cc2.lead_id IS NULL
  ORDER BY cc2.id, qsn.created_at DESC
) sub
WHERE cc.id = sub.conversation_id;

-- 4. Garantir que leads sem pipeline_stage_id recebam o primeiro quadro
UPDATE public.quiz_submissions_new qsn
SET pipeline_stage_id = ps.id,
    updated_at = now()
FROM public.pipeline_stages ps
WHERE qsn.pipeline_stage_id IS NULL
  AND ps.organization_id = qsn.organization_id
  AND ps.order_index = 0;

-- 5. Garantir que leads WhatsApp (completion_percentage = 0) sejam "cold"
UPDATE public.quiz_submissions_new
SET temperature = 'cold'::lead_temperature,
    updated_at = now()
WHERE completion_percentage = 0 
  AND temperature != 'cold'
  AND temperature_override = false;