
-- Fix quiz_submissions_new: SELECT policy -> TO authenticated only
DROP POLICY IF EXISTS "Consultants can view their submissions or super admin sees all" ON public.quiz_submissions_new;
CREATE POLICY "Consultants can view their submissions or super admin sees all"
ON public.quiz_submissions_new
FOR SELECT
TO authenticated
USING ((consultant_id = get_current_consultant_id()) OR is_super_admin());

-- Fix quiz_submissions_new: DELETE policy -> TO authenticated
DROP POLICY IF EXISTS "Users can delete leads in their organization" ON public.quiz_submissions_new;
CREATE POLICY "Users can delete leads in their organization"
ON public.quiz_submissions_new
FOR DELETE
TO authenticated
USING ((organization_id = get_user_organization_id()) OR is_super_admin());

-- Fix quiz_submissions_new: UPDATE org policy -> TO authenticated
DROP POLICY IF EXISTS "Users can update submissions in their organization" ON public.quiz_submissions_new;
CREATE POLICY "Users can update submissions in their organization"
ON public.quiz_submissions_new
FOR UPDATE
TO authenticated
USING (organization_id = get_user_organization_id());

-- Fix ranking_scores: SELECT policy -> TO authenticated
DROP POLICY IF EXISTS "Consultants can view ranking in their organization" ON public.ranking_scores;
CREATE POLICY "Consultants can view ranking in their organization"
ON public.ranking_scores
FOR SELECT
TO authenticated
USING ((organization_id = get_user_organization_id()) OR is_super_admin());

-- Fix ranking_scores: INSERT policy -> TO authenticated
DROP POLICY IF EXISTS "Consultants can insert their own ranking" ON public.ranking_scores;
CREATE POLICY "Consultants can insert their own ranking"
ON public.ranking_scores
FOR INSERT
TO authenticated
WITH CHECK (consultant_id = get_current_consultant_id());

-- Fix ranking_scores: UPDATE policy -> TO authenticated
DROP POLICY IF EXISTS "Consultants can update their own ranking" ON public.ranking_scores;
CREATE POLICY "Consultants can update their own ranking"
ON public.ranking_scores
FOR UPDATE
TO authenticated
USING (consultant_id = get_current_consultant_id());
