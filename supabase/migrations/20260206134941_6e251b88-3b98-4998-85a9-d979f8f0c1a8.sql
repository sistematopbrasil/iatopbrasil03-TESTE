
-- =============================================
-- QUIZ_SUBMISSIONS_NEW: TO authenticated
-- =============================================
DROP POLICY IF EXISTS "Consultants can view their submissions or super admin sees all" ON public.quiz_submissions_new;
CREATE POLICY "Consultants can view their submissions or super admin sees all"
  ON public.quiz_submissions_new FOR SELECT TO authenticated
  USING ((consultant_id = get_current_consultant_id()) OR is_super_admin());

DROP POLICY IF EXISTS "Users can update submissions in their organization" ON public.quiz_submissions_new;
CREATE POLICY "Users can update submissions in their organization"
  ON public.quiz_submissions_new FOR UPDATE TO authenticated
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can delete leads in their organization" ON public.quiz_submissions_new;
CREATE POLICY "Users can delete leads in their organization"
  ON public.quiz_submissions_new FOR DELETE TO authenticated
  USING ((organization_id = get_user_organization_id()) OR is_super_admin());

-- INSERT and public UPDATE remain public (anonymous quiz submissions)

-- =============================================
-- CRM_CONVERSATIONS: TO authenticated
-- =============================================
DROP POLICY IF EXISTS "Users can view own conversations" ON public.crm_conversations;
CREATE POLICY "Users can view own conversations"
  ON public.crm_conversations FOR SELECT TO authenticated
  USING ((user_id = get_current_consultant_id()) OR is_super_admin());

DROP POLICY IF EXISTS "Users can insert own conversations" ON public.crm_conversations;
CREATE POLICY "Users can insert own conversations"
  ON public.crm_conversations FOR INSERT TO authenticated
  WITH CHECK (user_id = get_current_consultant_id());

DROP POLICY IF EXISTS "Users can update own conversations" ON public.crm_conversations;
CREATE POLICY "Users can update own conversations"
  ON public.crm_conversations FOR UPDATE TO authenticated
  USING (user_id = get_current_consultant_id());

DROP POLICY IF EXISTS "Users can delete own conversations" ON public.crm_conversations;
CREATE POLICY "Users can delete own conversations"
  ON public.crm_conversations FOR DELETE TO authenticated
  USING (user_id = get_current_consultant_id());

-- =============================================
-- CRM_MESSAGES: TO authenticated
-- =============================================
DROP POLICY IF EXISTS "Users can view messages from own conversations" ON public.crm_messages;
CREATE POLICY "Users can view messages from own conversations"
  ON public.crm_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM crm_conversations WHERE crm_conversations.id = crm_messages.conversation_id AND ((crm_conversations.user_id = get_current_consultant_id()) OR is_super_admin())));

DROP POLICY IF EXISTS "Users can insert messages in own conversations" ON public.crm_messages;
CREATE POLICY "Users can insert messages in own conversations"
  ON public.crm_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM crm_conversations WHERE crm_conversations.id = crm_messages.conversation_id AND crm_conversations.user_id = get_current_consultant_id()));

DROP POLICY IF EXISTS "Users can update own messages" ON public.crm_messages;
CREATE POLICY "Users can update own messages"
  ON public.crm_messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM crm_conversations WHERE crm_conversations.id = crm_messages.conversation_id AND crm_conversations.user_id = get_current_consultant_id()));

-- =============================================
-- WHATSAPP_INSTANCES: TO authenticated
-- =============================================
DROP POLICY IF EXISTS "Users can view own instances" ON public.whatsapp_instances;
CREATE POLICY "Users can view own instances"
  ON public.whatsapp_instances FOR SELECT TO authenticated
  USING ((user_id = get_current_consultant_id()) OR is_super_admin());

DROP POLICY IF EXISTS "Users can insert own instances" ON public.whatsapp_instances;
CREATE POLICY "Users can insert own instances"
  ON public.whatsapp_instances FOR INSERT TO authenticated
  WITH CHECK (user_id = get_current_consultant_id());

DROP POLICY IF EXISTS "Users can update own instances" ON public.whatsapp_instances;
CREATE POLICY "Users can update own instances"
  ON public.whatsapp_instances FOR UPDATE TO authenticated
  USING (user_id = get_current_consultant_id());

DROP POLICY IF EXISTS "Users can delete own instances" ON public.whatsapp_instances;
CREATE POLICY "Users can delete own instances"
  ON public.whatsapp_instances FOR DELETE TO authenticated
  USING (user_id = get_current_consultant_id());

-- =============================================
-- CRM_AUDIT_LOGS: TO authenticated
-- =============================================
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.crm_audit_logs;
CREATE POLICY "Users can view own audit logs"
  ON public.crm_audit_logs FOR SELECT TO authenticated
  USING ((user_id = get_current_consultant_id()) OR is_super_admin());

DROP POLICY IF EXISTS "Users can insert audit logs" ON public.crm_audit_logs;
CREATE POLICY "Users can insert audit logs"
  ON public.crm_audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = get_current_consultant_id());

-- =============================================
-- RANKING_SCORES: TO authenticated
-- =============================================
DROP POLICY IF EXISTS "Consultants can view ranking in their organization" ON public.ranking_scores;
CREATE POLICY "Consultants can view ranking in their organization"
  ON public.ranking_scores FOR SELECT TO authenticated
  USING ((organization_id = get_user_organization_id()) OR is_super_admin());

DROP POLICY IF EXISTS "Consultants can insert their own ranking" ON public.ranking_scores;
CREATE POLICY "Consultants can insert their own ranking"
  ON public.ranking_scores FOR INSERT TO authenticated
  WITH CHECK (consultant_id = get_current_consultant_id());

DROP POLICY IF EXISTS "Consultants can update their own ranking" ON public.ranking_scores;
CREATE POLICY "Consultants can update their own ranking"
  ON public.ranking_scores FOR UPDATE TO authenticated
  USING (consultant_id = get_current_consultant_id());

-- =============================================
-- PIPELINE_STAGES: TO authenticated
-- =============================================
DROP POLICY IF EXISTS "view_own_org_stages" ON public.pipeline_stages;
CREATE POLICY "view_own_org_stages"
  ON public.pipeline_stages FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "insert_own_org_stages" ON public.pipeline_stages;
CREATE POLICY "insert_own_org_stages"
  ON public.pipeline_stages FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "update_own_org_stages" ON public.pipeline_stages;
CREATE POLICY "update_own_org_stages"
  ON public.pipeline_stages FOR UPDATE TO authenticated
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "delete_own_org_stages" ON public.pipeline_stages;
CREATE POLICY "delete_own_org_stages"
  ON public.pipeline_stages FOR DELETE TO authenticated
  USING (organization_id = get_user_organization_id());

-- =============================================
-- EVENTS: TO authenticated
-- =============================================
DROP POLICY IF EXISTS "Consultants can view their events or super admin sees all" ON public.events;
CREATE POLICY "Consultants can view their events or super admin sees all"
  ON public.events FOR SELECT TO authenticated
  USING ((consultant_id = get_current_consultant_id()) OR is_super_admin() OR (organization_id = get_user_organization_id()));

DROP POLICY IF EXISTS "Consultants can create events" ON public.events;
CREATE POLICY "Consultants can create events"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK ((organization_id = get_user_organization_id()) AND ((consultant_id IS NULL) OR (consultant_id = get_current_consultant_id())));

DROP POLICY IF EXISTS "Users can update events in their organization" ON public.events;
CREATE POLICY "Users can update events in their organization"
  ON public.events FOR UPDATE TO authenticated
  USING (organization_id = get_user_organization_id());

-- =============================================
-- EVENT_ATTENDEES: TO authenticated
-- =============================================
DROP POLICY IF EXISTS "Users can manage attendees in their organization" ON public.event_attendees;
CREATE POLICY "Users can manage attendees in their organization"
  ON public.event_attendees FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM events WHERE events.id = event_attendees.event_id AND events.organization_id = get_user_organization_id()));

DROP POLICY IF EXISTS "Users can view attendees in their organization" ON public.event_attendees;
CREATE POLICY "Users can view attendees in their organization"
  ON public.event_attendees FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM events WHERE events.id = event_attendees.event_id AND events.organization_id = get_user_organization_id()));

-- =============================================
-- ORGANIZATIONS: TO authenticated
-- =============================================
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;
CREATE POLICY "Users can view their own organization"
  ON public.organizations FOR SELECT TO authenticated
  USING (id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can update their own organization" ON public.organizations;
CREATE POLICY "Users can update their own organization"
  ON public.organizations FOR UPDATE TO authenticated
  USING (id = get_user_organization_id());

-- =============================================
-- AI_AGENT_CONFIGS: TO authenticated
-- =============================================
DROP POLICY IF EXISTS "Users can manage own AI config" ON public.ai_agent_configs;
CREATE POLICY "Users can manage own AI config"
  ON public.ai_agent_configs FOR ALL TO authenticated
  USING (user_id = get_current_consultant_id());

DROP POLICY IF EXISTS "Super admin can view all AI configs" ON public.ai_agent_configs;
CREATE POLICY "Super admin can view all AI configs"
  ON public.ai_agent_configs FOR SELECT TO authenticated
  USING (is_super_admin());

DROP POLICY IF EXISTS "Super admin can update all AI configs" ON public.ai_agent_configs;
CREATE POLICY "Super admin can update all AI configs"
  ON public.ai_agent_configs FOR UPDATE TO authenticated
  USING (is_super_admin());

-- =============================================
-- AI_CONVERSATION_STATE: TO authenticated
-- =============================================
DROP POLICY IF EXISTS "Users can manage own AI conversation state" ON public.ai_conversation_state;
CREATE POLICY "Users can manage own AI conversation state"
  ON public.ai_conversation_state FOR ALL TO authenticated
  USING (user_id = get_current_consultant_id());

-- =============================================
-- CRM_NOTES: TO authenticated
-- =============================================
DROP POLICY IF EXISTS "Users can manage own notes" ON public.crm_notes;
CREATE POLICY "Users can manage own notes"
  ON public.crm_notes FOR ALL TO authenticated
  USING (user_id = get_current_consultant_id());

-- =============================================
-- CRM_QUICK_REPLIES: TO authenticated
-- =============================================
DROP POLICY IF EXISTS "Users can manage own quick replies" ON public.crm_quick_replies;
CREATE POLICY "Users can manage own quick replies"
  ON public.crm_quick_replies FOR ALL TO authenticated
  USING ((user_id = get_current_consultant_id()) OR is_super_admin());

-- =============================================
-- CRM_SETTINGS: TO authenticated
-- =============================================
DROP POLICY IF EXISTS "Users can view their own CRM settings" ON public.crm_settings;
CREATE POLICY "Users can view their own CRM settings"
  ON public.crm_settings FOR SELECT TO authenticated
  USING (user_id = get_current_consultant_id());

DROP POLICY IF EXISTS "Users can insert their own CRM settings" ON public.crm_settings;
CREATE POLICY "Users can insert their own CRM settings"
  ON public.crm_settings FOR INSERT TO authenticated
  WITH CHECK (user_id = get_current_consultant_id());

DROP POLICY IF EXISTS "Users can update their own CRM settings" ON public.crm_settings;
CREATE POLICY "Users can update their own CRM settings"
  ON public.crm_settings FOR UPDATE TO authenticated
  USING (user_id = get_current_consultant_id());

-- =============================================
-- CRM_TAGS: TO authenticated
-- =============================================
DROP POLICY IF EXISTS "Users can manage own tags" ON public.crm_tags;
CREATE POLICY "Users can manage own tags"
  ON public.crm_tags FOR ALL TO authenticated
  USING ((user_id = get_current_consultant_id()) OR is_super_admin());

-- =============================================
-- CRM_CONVERSATION_TAGS: TO authenticated
-- =============================================
DROP POLICY IF EXISTS "Users can manage tags on own conversations" ON public.crm_conversation_tags;
CREATE POLICY "Users can manage tags on own conversations"
  ON public.crm_conversation_tags FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM crm_conversations WHERE crm_conversations.id = crm_conversation_tags.conversation_id AND crm_conversations.user_id = get_current_consultant_id()));

-- =============================================
-- USER_ROLES: TO authenticated
-- =============================================
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- =============================================
-- QUIZ_QUESTIONS: authenticated-only for consultant policies
-- =============================================
DROP POLICY IF EXISTS "Consultants can view their questions" ON public.quiz_questions;
CREATE POLICY "Consultants can view their questions"
  ON public.quiz_questions FOR SELECT TO authenticated
  USING ((consultant_id = get_current_consultant_id()) OR is_super_admin());

DROP POLICY IF EXISTS "Consultants can create questions" ON public.quiz_questions;
CREATE POLICY "Consultants can create questions"
  ON public.quiz_questions FOR INSERT TO authenticated
  WITH CHECK (consultant_id = get_current_consultant_id());

DROP POLICY IF EXISTS "Consultants can update their questions" ON public.quiz_questions;
CREATE POLICY "Consultants can update their questions"
  ON public.quiz_questions FOR UPDATE TO authenticated
  USING (consultant_id = get_current_consultant_id());

DROP POLICY IF EXISTS "Consultants can delete their questions" ON public.quiz_questions;
CREATE POLICY "Consultants can delete their questions"
  ON public.quiz_questions FOR DELETE TO authenticated
  USING (consultant_id = get_current_consultant_id());
-- Note: "Public can read active questions by consultant" remains public (needed for quiz)
