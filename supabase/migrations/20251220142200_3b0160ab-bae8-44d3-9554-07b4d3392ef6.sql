-- ================================================================
-- PROBLEMA 4: Corrigir trigger calculate_lead_score e remover constraint
-- ================================================================

-- Primeiro, remover o constraint que limita lead_score a 0-100
ALTER TABLE quiz_submissions_new DROP CONSTRAINT IF EXISTS lead_score_range;

-- Adicionar novo constraint com limite correto (0-185)
ALTER TABLE quiz_submissions_new ADD CONSTRAINT lead_score_range CHECK (lead_score >= 0 AND lead_score <= 200);

-- Dropar o trigger existente
DROP TRIGGER IF EXISTS calculate_lead_score_trigger ON quiz_submissions_new;

-- Recriar a função calculate_lead_score com a lógica correta TOP Brasil
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
    
    -- Proteção veicular (max 20 pts) + REGRA DECISIVA PARA TEMPERATURA
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
    
    -- ================================================================
    -- LÓGICA DE TEMPERATURA TOP BRASIL
    -- ================================================================
    
    -- 🧊 FRIO: Não completou o quiz
    IF NEW.completion_percentage < 100 THEN
        NEW.temperature := 'cold';
    -- 🔥 QUENTE: Trabalha com proteção veicular (REGRA DECISIVA)
    ELSIF works_with_protection THEN
        NEW.temperature := 'hot';
    -- 🔥 QUENTE: 3+ pontos nas perguntas-chave
    ELSIF key_points >= 3 THEN
        NEW.temperature := 'hot';
    -- 🌡️ MORNO: Completou mas não atingiu critérios
    ELSE
        NEW.temperature := 'warm';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Recriar o trigger
CREATE TRIGGER calculate_lead_score_trigger
    BEFORE INSERT OR UPDATE ON public.quiz_submissions_new
    FOR EACH ROW
    EXECUTE FUNCTION calculate_lead_score();