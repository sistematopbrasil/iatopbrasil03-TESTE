
-- =============================================
-- USERS: Recriar policies com TO authenticated
-- =============================================
DROP POLICY IF EXISTS "Users can view users in their organization" ON public.users;
CREATE POLICY "Users can view users in their organization"
  ON public.users FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Super Admin can create consultants" ON public.users;
CREATE POLICY "Super Admin can create consultants"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() AND organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Super Admin can update consultants" ON public.users;
CREATE POLICY "Super Admin can update consultants"
  ON public.users FOR UPDATE TO authenticated
  USING (is_super_admin() AND organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Super Admin can delete consultants" ON public.users;
CREATE POLICY "Super Admin can delete consultants"
  ON public.users FOR DELETE TO authenticated
  USING (is_super_admin() AND organization_id = get_user_organization_id());

-- =============================================
-- CONSULTANT_RECRUITS: Recriar policies com TO authenticated
-- =============================================
DROP POLICY IF EXISTS "Users can view recruits in their organization" ON public.consultant_recruits;
CREATE POLICY "Users can view recruits in their organization"
  ON public.consultant_recruits FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can create recruits in their organization" ON public.consultant_recruits;
CREATE POLICY "Users can create recruits in their organization"
  ON public.consultant_recruits FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can update recruits in their organization" ON public.consultant_recruits;
CREATE POLICY "Users can update recruits in their organization"
  ON public.consultant_recruits FOR UPDATE TO authenticated
  USING (organization_id = get_user_organization_id());

-- =============================================
-- TRACKING_SESSIONS: SELECT com TO authenticated
-- =============================================
DROP POLICY IF EXISTS "Users can view tracking in their organization" ON public.tracking_sessions;
CREATE POLICY "Users can view tracking in their organization"
  ON public.tracking_sessions FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());
