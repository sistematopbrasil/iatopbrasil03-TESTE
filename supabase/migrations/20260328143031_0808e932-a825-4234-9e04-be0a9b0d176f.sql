-- Step 1: Add page_purpose column
ALTER TABLE public.capture_page_configs 
ADD COLUMN page_purpose text NOT NULL DEFAULT 'protection';

-- Step 2: Create unique index on (consultant_id, page_purpose)
CREATE UNIQUE INDEX capture_page_configs_consultant_purpose_idx 
ON public.capture_page_configs (consultant_id, page_purpose);