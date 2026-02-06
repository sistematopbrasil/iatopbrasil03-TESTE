

# Etapa 3: Seguranca Final + Edge Function do Agente IA

## PARTE 1: Correcoes de Seguranca Pendentes

### 1.1 - Extensao `unaccent` no schema `public` (Warning)

A extensao `unaccent` ainda esta no schema `public`. A migracao anterior pode ter falhado ou nao foi incluida.

**Migracao SQL:**
- Criar schema `extensions` se nao existir
- Mover extensao `unaccent` para `extensions`
- Recriar as funcoes `generate_quiz_slug` e `generate_unique_username` usando `extensions.unaccent()` ao inves de `unaccent()`

### 1.2 - Tabela `organizations` expondo dados sensiveis (Warning)

A policy `Public can read active organizations by slug` permite que qualquer pessoa leia `meta_pixel_id` e `whatsapp_number` de todas as organizacoes ativas.

**Solucao:** Criar uma funcao RPC Security Definer `get_organization_public(p_slug text)` que retorna apenas `id`, `name`, `slug`, `logo_url`. Remover a policy publica. Atualizar o codigo que faz lookup de organizacao por slug para usar a RPC.

### 1.3 - Tabela `quiz_submissions` sem policies (Info)

RLS habilitado mas zero policies = acesso totalmente bloqueado. Isso e seguro mas gera aviso do linter. Como a tabela e legada e nao e mais usada, a melhor solucao e simplesmente ignorar o aviso (e seguro assim).

### 1.4 - `crm_conversations` e `tracking_sessions` (Error/Warning)

As policies SELECT destas tabelas usam `get_current_consultant_id()` que retorna NULL para usuarios anonimos, entao na pratica o acesso anonimo ja e bloqueado. Porem, o scan flagra porque as policies alvejam `public` (que inclui `anon`). A correcao e adicionar `TO authenticated` nas policies SELECT para ser explicito.

**Migracao SQL:**
- Recriar policies SELECT de `crm_conversations` e `tracking_sessions` com `TO authenticated`
- Tambem aplicar `TO authenticated` nas policies de `crm_messages`, `crm_notes`, `crm_tags`, `crm_quick_replies` que seguem o mesmo padrao

---

## PARTE 2: Edge Function do Agente IA

### 2.1 - Funcao `ai-agent-respond`

Nova edge function que sera chamada pelo webhook existente (`crm-webhook`) quando uma mensagem incoming chegar.

**Fluxo:**
1. Webhook recebe mensagem incoming
2. Verifica se o consultor tem `ai_enabled = true`
3. Verifica se existe `ai_agent_configs` para o consultor
4. Verifica `ai_conversation_state` para a conversa (se IA esta ativa, nao pausada, nao desabilitada)
5. Verifica horario comercial (se configurado)
6. Monta o prompt com: persona + skills + products_info + restrictions + historico de mensagens
7. Se a mensagem e audio: transcreve usando Whisper API (OpenAI)
8. Se a mensagem e imagem: usa GPT-4o Vision para descrever
9. Chama a API configurada (OpenAI/Google/Anthropic) com o prompt completo
10. Envia a resposta via Evolution API como mensagem do consultor
11. Salva a mensagem na tabela `crm_messages`
12. Atualiza `ai_conversation_state` (incrementa contadores)

**Detalhes tecnicos:**
- Historico de conversa: busca as ultimas 20 mensagens da conversa para contexto
- API key: descriptografada server-side (edge function)
- Rate limiting: maximo 1 resposta a cada 3 segundos por conversa
- Erro handling: se a API falhar, nao envia nada (falha silenciosa, loga o erro)
- Pausa automatica: se o consultor enviar mensagem manualmente (direction = outgoing e nao e da IA), pausa a IA por `pause_on_human_minutes`

### 2.2 - Modificacao do `crm-webhook/index.ts`

Apos processar a mensagem incoming (linha ~714 do webhook atual), adicionar chamada para a edge function `ai-agent-respond` passando:
- `conversation_id`
- `instance_id`
- `user_id` (consultor)
- `message` (conteudo da mensagem recebida)
- `message_type` (text, audio, image)
- `media_url` (se for midia)

A chamada sera **assincrona** (fire-and-forget via fetch sem await) para nao bloquear o webhook.

### 2.3 - Deteccao de intervencao humana

No webhook, quando uma mensagem outgoing e detectada (fromMe = true):
- Verificar se existe `ai_conversation_state` para a conversa
- Se sim, verificar se a mensagem foi enviada pela IA (marcar mensagens da IA com metadata especial)
- Se nao foi da IA, pausar `ai_conversation_state.paused_until = now() + pause_on_human_minutes`

---

## PARTE 3: Controle da IA no Chat (UI)

### 3.1 - Indicador no ChatWindow

No header do `ChatWindow.tsx`, adicionar um indicador visual quando a IA esta ativa naquela conversa:
- Badge "IA Ativa" (verde) / "IA Pausada" (amarelo) / "IA Desativada" (cinza)
- Botao para pausar/retomar/desativar IA naquela conversa especifica

### 3.2 - Hook `useAIConversationState`

Novo hook para gerenciar o estado da IA por conversa:
- Buscar estado atual
- Pausar temporariamente
- Desativar permanentemente
- Reativar

---

## PARTE 4: Resumo dos Arquivos

| Acao | Arquivo |
|------|---------|
| Migracao SQL | Seguranca: unaccent, organizations RPC, policies TO authenticated |
| Criar | `supabase/functions/ai-agent-respond/index.ts` |
| Modificar | `supabase/functions/crm-webhook/index.ts` - trigger IA apos mensagem incoming |
| Criar | `src/hooks/useAIConversationState.ts` |
| Modificar | `src/components/crm/ChatWindow.tsx` - indicador + controles IA |
| Modificar | `src/lib/organization-service.ts` - usar RPC para organizations |

---

## Detalhes Tecnicos: Estrutura do Prompt

O prompt enviado para a API sera montado assim:

```text
[SISTEMA]
Voce e {agent_name}. {persona}

[OBJETIVO]
{objective}

[CONHECIMENTO]
{skills}

[PRODUTOS/SERVICOS]
{products_info}

[RESTRICOES]
{restrictions}

[INSTRUCOES]
- Responda de forma natural e humanizada
- Use o nome do lead quando possivel
- Nao mencione que voce e uma IA
- Mantenha respostas curtas (WhatsApp)
- Use emojis com moderacao

[HISTORICO DA CONVERSA]
(ultimas 20 mensagens)

[MENSAGEM ATUAL DO LEAD]
{mensagem recebida}
```

## Seguranca da API Key

A API key sera:
1. Recebida do formulario no frontend
2. Enviada ao backend (edge function dedicada) para criptografia
3. Armazenada criptografada no banco com `pgcrypto`
4. Descriptografada APENAS na edge function `ai-agent-respond` (server-side)
5. Nunca exposta no frontend apos salva

Para isso, sera necessaria uma edge function auxiliar `ai-encrypt-key` que recebe a key em texto puro e retorna criptografada.

