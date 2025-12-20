-- ================================================================
-- PROBLEMA 6 & 4: Garantir RLS permita INSERT e UPDATE corretamente
-- ================================================================

-- Drop existing policies to recreate with better permissions
DROP POLICY IF EXISTS "Public can insert tracking sessions" ON tracking_sessions;
DROP POLICY IF EXISTS "Public can update tracking sessions" ON tracking_sessions;
DROP POLICY IF EXISTS "Public can update recent submissions" ON quiz_submissions_new;

-- Tracking sessions: permitir INSERT público sem restrições
CREATE POLICY "Public can insert tracking sessions"
ON tracking_sessions
FOR INSERT
TO public
WITH CHECK (true);

-- Tracking sessions: permitir UPDATE em sessões recentes (2 horas)
CREATE POLICY "Public can update tracking sessions"
ON tracking_sessions
FOR UPDATE
TO public
USING (started_at > (now() - interval '2 hours'))
WITH CHECK (true);

-- Quiz submissions: garantir UPDATE funciona para leads recentes (2 horas) sem restrições
CREATE POLICY "Public can update recent submissions"
ON quiz_submissions_new
FOR UPDATE
TO public
USING (created_at > (now() - interval '2 hours'))
WITH CHECK (true);

-- ================================================================
-- PROBLEMA 7: Atualizar quadros do pipeline para o fluxo TOP Brasil
-- Em vez de deletar (que quebra FK), vamos ATUALIZAR os existentes e INSERIR os novos
-- ================================================================

-- Primeiro, obter o organization_id da TOP Brasil
DO $$
DECLARE
  org_id UUID;
  first_stage_id UUID;
BEGIN
  SELECT id INTO org_id FROM organizations WHERE name = 'TOP Brasil' LIMIT 1;
  
  IF org_id IS NOT NULL THEN
    -- Guardar o ID do primeiro stage para redirecionar leads órfãos
    SELECT id INTO first_stage_id FROM pipeline_stages 
    WHERE organization_id = org_id ORDER BY order_index LIMIT 1;

    -- 1. Atualizar stage 0: Novos Leads
    UPDATE pipeline_stages SET name = 'Novos Leads', color = '#3B82F6', icon = 'trending-up', order_index = 0
    WHERE organization_id = org_id AND order_index = 0;

    -- 2. Atualizar stage 1: Primeiro Contato
    UPDATE pipeline_stages SET name = 'Primeiro Contato', color = '#8B5CF6', icon = 'phone', order_index = 1
    WHERE organization_id = org_id AND order_index = 1;

    -- 3. Atualizar stage 2: Avaliando Perfil
    UPDATE pipeline_stages SET name = 'Avaliando Perfil', color = '#F59E0B', icon = 'sparkles', order_index = 2
    WHERE organization_id = org_id AND order_index = 2;

    -- 4. Atualizar stage 3: Perfil Qualificado
    UPDATE pipeline_stages SET name = 'Perfil Qualificado', color = '#EC4899', icon = 'check-circle', order_index = 3
    WHERE organization_id = org_id AND order_index = 3;

    -- 5. Atualizar stage 4: Confirmado no Evento
    UPDATE pipeline_stages SET name = 'Confirmado no Evento', color = '#10B981', icon = 'check-circle', order_index = 4
    WHERE organization_id = org_id AND order_index = 4;

    -- 6. Atualizar stage 5: Lembrete Enviado
    UPDATE pipeline_stages SET name = 'Lembrete Enviado', color = '#06B6D4', icon = 'bell', order_index = 5
    WHERE organization_id = org_id AND order_index = 5;

    -- Inserir novos stages que não existem (6, 7, 8)
    INSERT INTO pipeline_stages (organization_id, name, color, icon, order_index)
    VALUES 
      (org_id, 'Compareceu ao Evento', '#22C55E', 'calendar-check', 6),
      (org_id, 'Novos Consultores', '#9333EA', 'users', 7),
      (org_id, 'Descartados', '#6B7280', 'x-circle', 8)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;