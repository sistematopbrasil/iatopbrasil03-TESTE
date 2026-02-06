
# Etapa 5: Correcoes de Seguranca + Polimento Final

## PARTE 1: Correcoes de Seguranca (3 issues do scan)

Os 2 erros e 1 warning restantes sao causados pelas policies SELECT que usam `TO public` (que inclui `anon`). Mesmo que as funcoes `get_current_consultant_id()` e `get_user_organization_id()` retornem NULL para anon (bloqueando acesso na pratica), o scanner flagra porque a policy *permite* que o role `anon` tente avaliar.

### Migracao SQL:

**1. `quiz_submissions_new` (Error - dados pessoais expostos)**
- Recriar policy SELECT com `TO authenticated`

**2. `ranking_scores` (Warning - metricas de performance)**
- Recriar policy SELECT com `TO authenticated`

**3. `tracking_sessions` (Error - IPs e user agents)**
- A policy SELECT ja e `TO authenticated`. O scanner flagra porque INSERT e UPDATE sao `TO public` (necessario para tracking anonimo do quiz). Nao ha risco real pois INSERT/UPDATE nao permitem leitura. Marcar como ignorado no scan.

### Tambem corrigir (preventivo):
- `quiz_submissions_new` DELETE policy: adicionar `TO authenticated`
- `quiz_submissions_new` UPDATE org policy: adicionar `TO authenticated`
- `ranking_scores` INSERT e UPDATE: adicionar `TO authenticated`

---

## PARTE 2: Bug Fixes Identificados

### 2.1 - `ai-agent-respond` nao tem `crm-webhook` no config.toml
O `crm-webhook` nao esta listado no `config.toml`, o que pode causar problemas de deploy. Verificar e adicionar se necessario.

### 2.2 - Webhook chama AI com anon key mas funcao usa service role
O webhook dispara `ai-agent-respond` com `SUPABASE_ANON_KEY`, mas a funcao usa `SUPABASE_SERVICE_ROLE_KEY` internamente para ler dados. Como `verify_jwt = false`, isso funciona - a anon key serve apenas para rotear a requisicao. Sem bug real, mas validar que o deploy esta correto.

### 2.3 - Upsert no `ai_conversation_state` pode falhar com RLS
A funcao `ai-agent-respond` usa `supabaseAdmin` (service role) que bypassa RLS, entao o upsert funciona. Mas o webhook tambem faz upsert com `supabaseAdmin` na deteccao de intervencao humana - confirmar que tambem usa service role. (Verificado: sim, usa `supabaseAdmin`.)

---

## PARTE 3: Melhorias de UX

### 3.1 - Mensagem de boas-vindas automatica
A `greeting_message` e configuravel no AdminAIConfig mas nao e usada em nenhum lugar. Implementar logica: quando uma conversa e criada pela primeira vez (primeira mensagem incoming), se houver `greeting_message` configurada, enviar como primeira resposta da IA antes da resposta contextual.

### 3.2 - Indicador de status da IA na lista de conversas
Atualmente o badge de IA so aparece no header do chat aberto. Adicionar um indicador sutil (icone de bot pequeno) na lista de conversas (`ConversationList.tsx`) quando a IA esta ativa naquela conversa.

### 3.3 - Contadores de uso na pagina de config
Mostrar estatisticas basicas na pagina AdminAIConfig: total de mensagens enviadas pela IA, total de tokens usados (somando de `ai_conversation_state`).

---

## PARTE 4: Resumo dos Arquivos

| Acao | Arquivo |
|------|---------|
| Migracao SQL | Policies TO authenticated para quiz_submissions_new, ranking_scores |
| Ignorar scan | tracking_sessions (INSERT/UPDATE publico necessario para quiz) |
| Ignorar scan | quiz_submissions (legado, ja ignorado) |
| Verificar | supabase/config.toml - garantir crm-webhook listado |
| Opcional | Greeting message logic em ai-agent-respond |
| Opcional | Bot icon em ConversationList |
| Opcional | Stats cards em AdminAIConfig |

---

## Prioridade

1. **Migracao de seguranca** (corrige os 2 erros + 1 warning)
2. **Ignorar tracking_sessions no scan** (nao e risco real)
3. **Greeting message** (melhoria rapida)
4. **Stats de uso** (informativo para consultor)
