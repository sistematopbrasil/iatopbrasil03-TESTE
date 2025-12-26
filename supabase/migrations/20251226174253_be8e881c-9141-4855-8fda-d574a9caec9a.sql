-- 1. Garantir que INSERT público funcione no quiz
DROP POLICY IF EXISTS "Public can insert submissions" ON public.quiz_submissions_new;
CREATE POLICY "Public can insert submissions" 
ON public.quiz_submissions_new 
FOR INSERT 
TO public 
WITH CHECK (true);

-- 2. Criar os triggers que estão faltando
DROP TRIGGER IF EXISTS trg_ranking_sync_on_update ON public.quiz_submissions_new;
DROP TRIGGER IF EXISTS trg_ranking_sync_on_delete ON public.quiz_submissions_new;

CREATE TRIGGER trg_ranking_sync_on_update
AFTER UPDATE OF pipeline_stage_id ON public.quiz_submissions_new
FOR EACH ROW
EXECUTE FUNCTION public.sync_ranking_consultants_recruited();

CREATE TRIGGER trg_ranking_sync_on_delete
AFTER DELETE ON public.quiz_submissions_new
FOR EACH ROW
EXECUTE FUNCTION public.sync_ranking_consultants_recruited();

-- 3. Permitir que todos consultores vejam pontuações de sua organização
DROP POLICY IF EXISTS "Consultants can view their ranking" ON public.ranking_scores;
CREATE POLICY "Consultants can view ranking in their organization" 
ON public.ranking_scores 
FOR SELECT 
USING (
  organization_id = get_user_organization_id() 
  OR is_super_admin()
);