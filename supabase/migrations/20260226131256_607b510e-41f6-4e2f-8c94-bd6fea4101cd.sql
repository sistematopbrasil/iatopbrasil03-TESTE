
-- Insert default pipeline stages for all organizations that don't have any
INSERT INTO pipeline_stages (organization_id, name, color, icon, order_index)
SELECT o.id, s.name, s.color, s.icon, s.order_index
FROM organizations o
CROSS JOIN (VALUES
  ('Novos Leads', '#3B82F6', 'trending-up', 0),
  ('Contato Inicial', '#8B5CF6', 'phone', 1),
  ('Qualificados', '#F59E0B', 'sparkles', 2),
  ('Convertidos', '#10B981', 'check-circle', 3),
  ('Descartados', '#EF4444', 'x-circle', 4)
) AS s(name, color, icon, order_index)
WHERE NOT EXISTS (
  SELECT 1 FROM pipeline_stages ps WHERE ps.organization_id = o.id
);

-- Assign leads without pipeline_stage_id to the first stage of their org
UPDATE quiz_submissions_new qsn
SET pipeline_stage_id = (
  SELECT ps.id FROM pipeline_stages ps 
  WHERE ps.organization_id = qsn.organization_id 
  ORDER BY ps.order_index ASC LIMIT 1
)
WHERE qsn.pipeline_stage_id IS NULL;
