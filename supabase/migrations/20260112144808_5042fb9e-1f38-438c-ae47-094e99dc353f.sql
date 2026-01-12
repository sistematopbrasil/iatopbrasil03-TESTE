-- 1. Mover leads do WhatsApp antigos (completion_percentage = 0) de "Primeiro Contato" para "Novos Leads"
UPDATE public.quiz_submissions_new qsn
SET pipeline_stage_id = novos.id,
    updated_at = now()
FROM public.pipeline_stages primeiro,
     public.pipeline_stages novos
WHERE qsn.pipeline_stage_id = primeiro.id
  AND primeiro.name = 'Primeiro Contato'
  AND novos.organization_id = qsn.organization_id
  AND novos.order_index = 0
  AND qsn.completion_percentage = 0;

-- 2. Vincular conversas antigas sem lead_id aos leads existentes pelo telefone
UPDATE public.crm_conversations cc
SET lead_id = qsn.id,
    updated_at = now()
FROM public.quiz_submissions_new qsn
WHERE cc.lead_id IS NULL
  AND cc.organization_id = qsn.organization_id
  AND public.normalize_br_phone(cc.contact_phone) = public.normalize_br_phone(qsn.phone);

-- 3. Criar leads para conversas que ainda não têm lead vinculado
INSERT INTO public.quiz_submissions_new (
  organization_id,
  consultant_id,
  name,
  phone,
  completion_percentage,
  pipeline_stage_id,
  stage,
  created_at,
  updated_at
)
SELECT DISTINCT ON (cc.id)
  cc.organization_id,
  cc.user_id,
  COALESCE(cc.contact_name, 'Contato WhatsApp'),
  public.normalize_br_phone(cc.contact_phone),
  0,
  ps.id,
  'novo'::lead_stage,
  cc.created_at,
  now()
FROM public.crm_conversations cc
JOIN public.pipeline_stages ps 
  ON ps.organization_id = cc.organization_id 
  AND ps.order_index = 0
WHERE cc.lead_id IS NULL;

-- 4. Vincular as conversas recém-criadas aos leads
UPDATE public.crm_conversations cc
SET lead_id = qsn.id,
    updated_at = now()
FROM public.quiz_submissions_new qsn
WHERE cc.lead_id IS NULL
  AND cc.organization_id = qsn.organization_id
  AND public.normalize_br_phone(cc.contact_phone) = public.normalize_br_phone(qsn.phone);