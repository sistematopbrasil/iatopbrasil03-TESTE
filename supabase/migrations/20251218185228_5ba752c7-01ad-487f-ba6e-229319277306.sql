-- Criar organização TOP Brasil
INSERT INTO public.organizations (id, name, slug, is_active, whatsapp_number)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'TOP Brasil',
  'topbrasil',
  true,
  NULL
)
ON CONFLICT (slug) DO NOTHING;

-- Criar pipeline stages padrão
INSERT INTO public.pipeline_stages (organization_id, name, order_index, color, icon)
VALUES 
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Novos Leads', 0, '#3B82F6', 'inbox'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Contato Inicial', 1, '#8B5CF6', 'phone'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Qualificados', 2, '#F59E0B', 'star'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Em Negociação', 3, '#EC4899', 'handshake'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Leads Convertidos', 4, '#22C55E', 'check-circle'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Descartados', 5, '#6B7280', 'x-circle')
ON CONFLICT DO NOTHING;