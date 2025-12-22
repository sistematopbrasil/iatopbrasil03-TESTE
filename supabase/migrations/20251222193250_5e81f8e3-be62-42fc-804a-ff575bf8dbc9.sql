-- Add extra_answers column to store dynamic quiz question answers
ALTER TABLE public.quiz_submissions_new 
ADD COLUMN IF NOT EXISTS extra_answers JSONB DEFAULT '{}'::jsonb;

-- Add comment explaining the column
COMMENT ON COLUMN public.quiz_submissions_new.extra_answers IS 'Stores answers to dynamic questions added by consultants. Format: {"question_id": {"question": "text", "answer": "value"}}';