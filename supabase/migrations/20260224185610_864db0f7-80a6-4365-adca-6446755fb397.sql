-- Add basic policies for legacy quiz_submissions table (RLS enabled but no policies = blocked access)
CREATE POLICY "Public can insert quiz submissions"
ON public.quiz_submissions
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public can update recent quiz submissions"
ON public.quiz_submissions
FOR UPDATE
USING (created_at > (now() - interval '2 hours'));

CREATE POLICY "Authenticated users can view quiz submissions"
ON public.quiz_submissions
FOR SELECT
USING (true);