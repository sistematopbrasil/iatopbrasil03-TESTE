CREATE OR REPLACE FUNCTION public.try_acquire_ai_lock(
  p_conversation_id uuid, 
  p_contact_phone text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  phone_recently_locked boolean := false;
BEGIN
  -- 1. Advisory lock por telefone (serializa todas as chamadas para o mesmo numero)
  IF p_contact_phone IS NOT NULL AND p_contact_phone != '' THEN
    PERFORM pg_advisory_xact_lock(hashtext(p_contact_phone));
  ELSE
    PERFORM pg_advisory_xact_lock(hashtext(p_conversation_id::text));
  END IF;

  -- 2. Verificar se QUALQUER conversa com este telefone ja teve resposta nos ultimos 10s
  IF p_contact_phone IS NOT NULL AND p_contact_phone != '' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.ai_conversation_state acs
      JOIN public.crm_conversations cc ON cc.id = acs.conversation_id
      WHERE cc.contact_phone = p_contact_phone
        AND acs.last_ai_message_at > now() - interval '10 seconds'
    ) INTO phone_recently_locked;

    IF phone_recently_locked THEN
      RETURN false;
    END IF;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.ai_conversation_state
      WHERE conversation_id = p_conversation_id
        AND last_ai_message_at > now() - interval '10 seconds'
    ) INTO phone_recently_locked;

    IF phone_recently_locked THEN
      RETURN false;
    END IF;
  END IF;

  -- 3. Adquirir o lock: atualizar timestamp
  UPDATE public.ai_conversation_state
  SET last_ai_message_at = now(), updated_at = now()
  WHERE conversation_id = p_conversation_id;

  RETURN true;
END;
$$;