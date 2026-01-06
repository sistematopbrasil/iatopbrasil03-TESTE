-- 1. Add quiz_submissions_new to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_submissions_new;
ALTER TABLE public.quiz_submissions_new REPLICA IDENTITY FULL;

-- 2. Add is_enabled and order_index columns to crm_quick_replies
ALTER TABLE public.crm_quick_replies 
ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- 3. Update order_index based on current order
UPDATE public.crm_quick_replies 
SET order_index = subquery.rn 
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) - 1 as rn 
  FROM public.crm_quick_replies
) AS subquery 
WHERE public.crm_quick_replies.id = subquery.id;