-- Adicionar políticas de INSERT e UPDATE para ranking_scores
-- Isso permitirá que os consultores salvem seus pontos ao mover leads

-- Política para INSERT
CREATE POLICY "Consultants can insert their own ranking"
ON public.ranking_scores
FOR INSERT
WITH CHECK (consultant_id = get_current_consultant_id());

-- Política para UPDATE
CREATE POLICY "Consultants can update their own ranking"
ON public.ranking_scores
FOR UPDATE
USING (consultant_id = get_current_consultant_id());