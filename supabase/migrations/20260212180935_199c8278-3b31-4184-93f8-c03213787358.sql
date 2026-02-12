
CREATE OR REPLACE FUNCTION public.try_acquire_ai_lock(
  p_conversation_id uuid,
  p_contact_phone text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  lock_acquired boolean := false;
  phone_locked boolean := false;
BEGIN
  -- 1. Tentar lock atômico na conversa específica
  UPDATE public.ai_conversation_state
  SET last_ai_message_at = now(), updated_at = now()
  WHERE conversation_id = p_conversation_id
    AND (last_ai_message_at IS NULL OR last_ai_message_at < now() - interval '10 seconds');

  IF FOUND THEN
    lock_acquired := true;
  ELSE
    RETURN false;
  END IF;

  -- 2. Verificar se OUTRO agente já respondeu para o mesmo telefone nos últimos 10s
  IF p_contact_phone IS NOT NULL AND p_contact_phone != '' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.ai_conversation_state acs
      JOIN public.crm_conversations cc ON cc.id = acs.conversation_id
      WHERE cc.contact_phone = p_contact_phone
        AND acs.conversation_id != p_conversation_id
        AND acs.last_ai_message_at > now() - interval '10 seconds'
    ) INTO phone_locked;

    IF phone_locked THEN
      -- Reverter o lock que fizemos
      UPDATE public.ai_conversation_state
      SET last_ai_message_at = NULL, updated_at = now()
      WHERE conversation_id = p_conversation_id;
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$function$;
