

# Correcao Definitiva: Lock por Telefone com Advisory Lock

## Causa Raiz (confirmada nos logs)

O `try_acquire_ai_lock` atual falha porque opera em **linhas diferentes** da tabela `ai_conversation_state` (uma por conversa). Quando duas instancias executam simultaneamente:

1. Instancia A faz UPDATE na row da conversa A -> sucesso (linha A)
2. Instancia B faz UPDATE na row da conversa B -> sucesso (linha B diferente)
3. Ambas fazem o SELECT de verificacao por telefone, mas devido ao MVCC do PostgreSQL, nenhuma ve a alteracao da outra (ambas estao em transacoes concorrentes nao commitadas)
4. Resultado: ambas adquirem o lock e ambas respondem

## Solucao: `pg_advisory_xact_lock`

Usar **advisory lock** do PostgreSQL baseado no hash do telefone. Isso serializa todas as execucoes para o mesmo telefone, independente da conversa ou instancia.

```text
pg_advisory_xact_lock(hashtext(p_contact_phone))
```

Este lock:
- E automaticamente liberado no fim da transacao
- Serializa TODAS as chamadas para o mesmo telefone
- Funciona mesmo entre linhas/tabelas diferentes
- Nao tem race condition (e um lock real do kernel do PostgreSQL)

## Alteracoes

### Alteracao 1: Recriar a funcao SQL `try_acquire_ai_lock`

Nova logica:
1. Se o telefone for valido, adquirir `pg_advisory_xact_lock(hashtext(p_contact_phone))` - isso bloqueia qualquer outra chamada concorrente para o mesmo telefone
2. Verificar se QUALQUER conversa com esse telefone teve resposta da IA nos ultimos 10 segundos
3. Se sim, retornar false (outra instancia ja respondeu)
4. Se nao, fazer o UPDATE atomico na conversa especifica e retornar true

### Alteracao 2: Nenhuma mudanca no `ai-agent-respond/index.ts`

O codigo ja chama `supabaseAdmin.rpc('try_acquire_ai_lock', ...)` corretamente. A correcao e apenas na funcao SQL.

## Detalhes Tecnicos da Migracao SQL

```sql
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
    -- Sem telefone: verificar apenas pela conversa
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
```

Esta abordagem garante que, mesmo que 10 instancias tentem responder ao mesmo tempo para o mesmo telefone, apenas UMA passara. As outras ficarao bloqueadas pelo advisory lock e, quando desbloqueadas, verao que o telefone ja foi respondido nos ultimos 10 segundos.

