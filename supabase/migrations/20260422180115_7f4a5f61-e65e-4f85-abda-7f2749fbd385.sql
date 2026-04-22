-- Conceder ao super admin acesso aos dois funis para que o seletor de funil apareça na sidebar
UPDATE public.users
SET 
  allowed_funnels = ARRAY['consultor','associado']::funnel_type[],
  default_funnel = 'consultor'
WHERE role = 'super_admin'
  AND email = 'topbrasil@gmail.com';