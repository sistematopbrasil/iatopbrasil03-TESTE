
# Correções críticas do CRM

Plano para resolver os 4 problemas reportados nos testes:

1. Erro `duplicate key ... whatsapp_instances_user_id_organization_id_key` ao criar instância de Associados.
2. Após conectar o WhatsApp, conversas e contatos antigos do número aparecem no CRM.
3. Quando um humano responde pelo CRM, o agente IA continua disparando.
4. Mensagens recebidas às vezes não aparecem no CRM (mensagem perdida).

---

## 1. Liberar 2 instâncias por consultor (Consultor + Associado)

**Causa**: a tabela `whatsapp_instances` ainda tem uma constraint legacy `UNIQUE (user_id, organization_id)` herdada do modelo antigo (1 instância por consultor). Hoje a regra correta já existe em `UNIQUE (user_id, funnel_type)`, então a antiga só atrapalha — bloqueia a 2ª instância (a de Associados).

**Ação**:
- Migration que faz `ALTER TABLE public.whatsapp_instances DROP CONSTRAINT IF EXISTS whatsapp_instances_user_id_organization_id_key;`
- Manter `whatsapp_instances_user_funnel_unique (user_id, funnel_type)` que já garante "1 instância por funil por consultor".
- Ajustar `crm-create-instance` para retornar o erro real do banco em vez do genérico "Erro ao salvar instância", para falhas futuras serem visíveis.

Isso destrava criação manual no botão "Iniciar Conexão" do funil de Associados e também a criação automática feita por `update-consultant-funnel-access` (super admin marcando os 2 funis).

---

## 2. Não puxar conversas/contatos antigos após conectar

**Causa**: hoje, depois da conexão, o front chama `crm-sync-recent`, que faz `findChats` e cria conversas/contatos a partir de TODO o histórico do número. O filtro temporal só vale para `messages`, não para `chats` — então contatos antigos aparecem mesmo sem mensagem nova.

**Ação**:
- Remover a chamada automática a `crm-sync-recent` após a conexão (no `WhatsAppConnectionSettings` / `useConversations`).
- No próprio `crm-sync-recent`, passar a só processar chats cuja `lastMessage.messageTimestamp >= instance.last_connected_at`. Se nenhum, não criar conversa nem contato.
- No `crm-webhook`, ao processar `messages_upsert`, ignorar a mensagem se `messageTimestamp < instance.last_connected_at` (já existe parcialmente no sync; replicar no webhook para ser consistente). Isso garante: só conversas e mensagens **a partir do momento da conexão** entram no CRM.

Resultado: ao conectar um número que já tem histórico, o CRM começa "limpo" e só popula com novas conversas reais.

---

## 3. Pausar agente IA quando humano responde pelo CRM (30 min)

**Causa**: `crm-send-message` salva a mensagem com `metadata.sent_via = 'app'`, mas não toca em `ai_conversation_state`. Resultado: o agente continua ativo mesmo após resposta manual.

**Ação no `crm-send-message`**:
- Após enviar com sucesso e a mensagem **não** vier marcada como `sent_by_ai`, fazer upsert em `ai_conversation_state` definindo:
  - `paused_until = now() + 30 min`
  - `paused_by = 'human_takeover'`
  - `is_active = true` (não desativa permanentemente — só pausa)
- Se já existir uma row, fazer UPDATE; senão INSERT (mesma lógica do `useAIConversationState.pause`).

**Ação no `ai-agent-respond`**:
- Antes de gerar resposta, conferir `ai_conversation_state.paused_until > now()` e abortar silenciosamente. (Esse check já deve existir; reforçar.)

Assim, qualquer mensagem enviada pelo painel do CRM — texto, áudio, mídia — pausa a IA por 30 min naquela conversa, sem precisar tocar nos botões.

---

## 4. Mensagens recebidas que não aparecem no CRM

**Causas prováveis** identificadas no `crm-webhook`:
- O download de mídia é **síncrono e bloqueante** dentro do handler. Quando a Evolution dispara várias mensagens em sequência, um download lento pode estourar o tempo do worker e a mensagem seguinte é perdida.
- Mensagens com `remoteJid` em formato `@lid` são puladas inteiramente (linha 382). Se o contato só envia via `@lid`, ele some.
- Não há fallback: se o webhook falhou por qualquer motivo (rede, timeout), a mensagem nunca é recuperada.

**Ação**:

a) **Webhook não-bloqueante para mídia**: salvar a mensagem (texto/placeholder) IMEDIATAMENTE no `crm_messages` e disparar o download de mídia em background (`EdgeRuntime.waitUntil`). Quando o download termina, faz UPDATE da mesma row com `media_url`. Assim nenhuma mensagem é perdida por causa de mídia lenta.

b) **Resiliência por upsert**: já temos `onConflict: 'instance_id,message_id'`. Garantir que esse mesmo upsert é usado em todos os caminhos (inclusive `messages_set` em batch).

c) **Fallback periódico (rede de segurança)**: criar um cron leve (a cada 2 min) `crm-sync-missing` que, para cada instância conectada, chama `findMessages` apenas das **últimas 5 minutos** e faz upsert das que ainda não estão no banco. Isso fecha o gap quando o webhook por algum motivo não chegou. Custo baixo, não puxa histórico (filtro temporal estrito).

d) **Suporte a `@lid`**: usar o helper `whatsapp-lid-support` já existente no projeto (memória `mem://architecture/whatsapp-lid-support`) para resolver `@lid` via `remoteJidAlt` em vez de descartar.

---

## Detalhes técnicos

```text
Migrations:
  - drop constraint whatsapp_instances_user_id_organization_id_key
  - (opcional) índice sobre crm_messages(instance_id, timestamp desc) p/ fallback rápido

Edge Functions tocadas:
  - crm-create-instance        → mensagem de erro real
  - crm-webhook                → filtro temporal por last_connected_at,
                                 mídia em waitUntil, suporte @lid
  - crm-send-message           → pausa IA 30min se sent_via=app e !sent_by_ai
  - crm-sync-recent            → filtrar chats por last_connected_at antes de criar conversa
  - crm-sync-missing (NOVO)    → cron a cada 2min, últimos 5min, upsert idempotente
  - ai-agent-respond           → respeitar paused_until

Frontend:
  - WhatsAppConnectionSettings / useConversations: remover sync automático
    pós-conexão. Continuamos com realtime + cron de segurança.
```

Sem mudanças de rota, sem alteração visual. Só edge functions, 1 migration e 1 cron novo.
