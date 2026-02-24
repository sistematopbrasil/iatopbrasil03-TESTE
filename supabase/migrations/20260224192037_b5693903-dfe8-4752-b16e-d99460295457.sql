
-- Fix quiz_submissions_new SELECT: scope super_admin to their organization
DROP POLICY IF EXISTS "Consultants can view their submissions or super admin sees all" ON public.quiz_submissions_new;
CREATE POLICY "Consultants can view their submissions or super admin sees all"
ON public.quiz_submissions_new
FOR SELECT
USING (
  consultant_id = get_current_consultant_id()
  OR (is_super_admin() AND organization_id = get_user_organization_id())
);

-- Fix quiz_submissions_new DELETE: scope super_admin to their organization  
DROP POLICY IF EXISTS "Users can delete leads in their organization" ON public.quiz_submissions_new;
CREATE POLICY "Users can delete leads in their organization"
ON public.quiz_submissions_new
FOR DELETE
USING (
  organization_id = get_user_organization_id()
);

-- Fix crm_conversations SELECT: scope super_admin to their organization
DROP POLICY IF EXISTS "Users can view own conversations" ON public.crm_conversations;
CREATE POLICY "Users can view own conversations"
ON public.crm_conversations
FOR SELECT
USING (
  user_id = get_current_consultant_id()
  OR (is_super_admin() AND organization_id = get_user_organization_id())
);

-- Fix crm_messages SELECT: scope super_admin through conversation org
DROP POLICY IF EXISTS "Users can view messages from own conversations" ON public.crm_messages;
CREATE POLICY "Users can view messages from own conversations"
ON public.crm_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM crm_conversations
    WHERE crm_conversations.id = crm_messages.conversation_id
    AND (
      crm_conversations.user_id = get_current_consultant_id()
      OR (is_super_admin() AND crm_conversations.organization_id = get_user_organization_id())
    )
  )
);
