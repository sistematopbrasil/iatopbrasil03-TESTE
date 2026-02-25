
-- Create the TOP Brasil organization
INSERT INTO organizations (name, slug, is_active)
VALUES ('TOP Brasil', 'topbrasil', true)
ON CONFLICT DO NOTHING;

-- Insert user as super_admin linked to the organization
INSERT INTO users (auth_user_id, organization_id, email, full_name, role, is_active)
SELECT 
  '6f875044-c9ce-4f9a-a08d-bdc6d693af65',
  o.id,
  'topbrasil@gmail.com',
  'TOP Brasil Admin',
  'super_admin',
  true
FROM organizations o
WHERE o.slug = 'topbrasil'
ON CONFLICT DO NOTHING;
