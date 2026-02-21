
ALTER TABLE public.ad_metrics ADD COLUMN IF NOT EXISTS post_engagement bigint DEFAULT 0;
ALTER TABLE public.ad_metrics ADD COLUMN IF NOT EXISTS conversions bigint DEFAULT 0;
