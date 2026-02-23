ALTER TABLE public.traffic_ai_conversations 
ADD CONSTRAINT traffic_ai_conversations_org_account_unique 
UNIQUE (organization_id, ad_account_id);