-- PASSO 1: Identificar e mesclar conversas duplicadas que resultariam do normalize
-- Criar tabela temporária com mapeamento de qual conversa manter
WITH normalized_phones AS (
  SELECT 
    id,
    instance_id,
    contact_phone,
    public.normalize_br_phone(contact_phone) as normalized_phone,
    lead_id,
    created_at,
    last_message_at
  FROM crm_conversations
  WHERE contact_phone IS NOT NULL
),
duplicates AS (
  SELECT 
    instance_id, 
    normalized_phone,
    -- Manter a conversa mais recente (ou que tem lead_id)
    (ARRAY_AGG(id ORDER BY 
      CASE WHEN lead_id IS NOT NULL THEN 0 ELSE 1 END, 
      last_message_at DESC NULLS LAST,
      created_at DESC
    ))[1] as keep_id,
    ARRAY_AGG(id ORDER BY 
      CASE WHEN lead_id IS NOT NULL THEN 0 ELSE 1 END, 
      last_message_at DESC NULLS LAST,
      created_at DESC
    ) as all_ids
  FROM normalized_phones
  WHERE normalized_phone IS NOT NULL AND normalized_phone != ''
  GROUP BY instance_id, normalized_phone
  HAVING count(*) > 1
)
-- Atualizar mensagens para apontar para a conversa que será mantida
UPDATE crm_messages m
SET conversation_id = d.keep_id
FROM duplicates d
WHERE m.conversation_id = ANY(d.all_ids)
  AND m.conversation_id != d.keep_id;

-- PASSO 2: Deletar conversas duplicadas (as que não foram mantidas)
WITH normalized_phones AS (
  SELECT 
    id,
    instance_id,
    contact_phone,
    public.normalize_br_phone(contact_phone) as normalized_phone,
    lead_id,
    created_at,
    last_message_at
  FROM crm_conversations
  WHERE contact_phone IS NOT NULL
),
duplicates AS (
  SELECT 
    instance_id, 
    normalized_phone,
    (ARRAY_AGG(id ORDER BY 
      CASE WHEN lead_id IS NOT NULL THEN 0 ELSE 1 END, 
      last_message_at DESC NULLS LAST,
      created_at DESC
    ))[1] as keep_id,
    ARRAY_AGG(id ORDER BY 
      CASE WHEN lead_id IS NOT NULL THEN 0 ELSE 1 END, 
      last_message_at DESC NULLS LAST,
      created_at DESC
    ) as all_ids
  FROM normalized_phones
  WHERE normalized_phone IS NOT NULL AND normalized_phone != ''
  GROUP BY instance_id, normalized_phone
  HAVING count(*) > 1
),
ids_to_delete AS (
  SELECT unnest(all_ids[2:]) as id
  FROM duplicates
)
DELETE FROM crm_conversations c
USING ids_to_delete d
WHERE c.id = d.id;

-- PASSO 3: Agora normalizar telefones nas conversas restantes
UPDATE public.crm_conversations 
SET contact_phone = public.normalize_br_phone(contact_phone)
WHERE contact_phone IS NOT NULL 
  AND contact_phone != '' 
  AND length(regexp_replace(contact_phone, '\D', '', 'g')) >= 10
  AND contact_phone != public.normalize_br_phone(contact_phone);

-- PASSO 4: Vincular conversas órfãs aos leads existentes (após normalização)
UPDATE public.crm_conversations c
SET lead_id = lp.id
FROM (
  SELECT id, phone, organization_id
  FROM public.quiz_submissions_new
  WHERE phone IS NOT NULL AND phone != ''
) lp
WHERE c.lead_id IS NULL
  AND c.contact_phone IS NOT NULL
  AND c.contact_phone = lp.phone
  AND c.organization_id = lp.organization_id;

-- PASSO 5: Trigger para normalizar telefone em conversas FUTURAS
CREATE OR REPLACE FUNCTION public.trigger_normalize_phone_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cleaned text;
BEGIN
  IF NEW.contact_phone IS NOT NULL AND NEW.contact_phone != '' THEN
    cleaned := regexp_replace(NEW.contact_phone, '\D', '', 'g');
    IF length(cleaned) >= 10 THEN
      NEW.contact_phone := public.normalize_br_phone(NEW.contact_phone);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS normalize_phone_conversation_trigger ON public.crm_conversations;
CREATE TRIGGER normalize_phone_conversation_trigger
  BEFORE INSERT OR UPDATE OF contact_phone ON public.crm_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_normalize_phone_conversation();