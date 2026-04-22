

# Plano de correções — Funil no Dashboard, Origem por funil, Quiz por funil, e Mensagens do WhatsApp não aparecendo no CRM

Tudo aditivo. Nenhuma rota, slug ou funcionalidade existente será removida. Quatro frentes:

---

## 1. Dashboard do consultor não respeita o toggle de funil

### Diagnóstico
`src/components/consultant/ConsultantDashboard.tsx` busca leads com `consultant_id = currentUser.id` mas **não filtra por `funnel_type`** e **não consome `useFunnel()`**. Trocar o toggle só invalida queries com chaves específicas (`leads`, `pipeline-leads` etc.), mas a query do dashboard usa `['all-leads-consultant', currentUser?.id]` — fora do escopo.

### Correção
- Importar `useFunnel()` em `ConsultantDashboard`.
- Adicionar `resolvedFunnel` na query key: `['all-leads-consultant', currentUser?.id, resolvedFunnel]`.
- Adicionar `.eq('funnel_type', resolvedFunnel)` na consulta a `quiz_submissions_new`.
- Filtrar `pipelineStages` por `funnel_type = resolvedFunnel` para os gráficos de pipeline ficarem coerentes (as stages já têm essa coluna).

Resultado: ao alternar Consultor ↔ Associado no header, métricas, gráficos, leads recentes e pipeline mudam.

---

## 2. Quiz e Página de Captura → identificar funil pela origem

### Diagnóstico atual
- `/c/:slug` → `funnel_type = 'associado'` ✓
- `/r/:slug` → `funnel_type = 'consultor'` ✓
- `/quiz/:slug` → cria lead **sempre como `consultor`** (default da coluna). Mas o consultor pode preferir usar o quiz para captar associados.
- A página `Configurações → Página de Captura` tem hoje o seletor "Finalidade da Página: Proteção Veicular / Recrutamento", que é **somente texto explicativo** — quem define o funil é a rota (`/c/` ou `/r/`).
- `quiz_questions` **não tem coluna `funnel_type`**, logo o consultor não consegue dizer "o quiz desse slug agora alimenta o funil de associados".

### Correção

#### 2.1. Quiz configurável por funil (default = consultor)
- Migration: adicionar coluna `quiz_funnel_type funnel_type NOT NULL DEFAULT 'consultor'` em `public.users`. Evita criar tabela nova; é uma propriedade do consultor.
- `Quiz.tsx` / `QuizContainer.tsx`: passar esse valor para o `insert` em `quiz_submissions_new` no `createLeadWithName` (campo `funnel_type`).
- Função RPC `get_consultant_by_slug` precisa retornar `quiz_funnel_type` (atualizar a função para incluir o campo).
- Por padrão continua `'consultor'`. Nada quebra.

#### 2.2. UI em `ConsultantSettings → Quiz`
- Novo bloco "Funil que o Quiz alimenta" com `Select` (Consultor / Associado), salvo em `users.quiz_funnel_type`.
- Só lista as opções dentro de `allowed_funnels` do consultor (se ele só tem 1, mostra a opção mas desabilitada).
- Texto curto explicando: "Por padrão, o quiz captura para o funil de Consultores. Você pode mudar para Associados se estiver usando o quiz para esse fim."

#### 2.3. Limpar a aba Página de Captura
- Manter o `page_purpose` (`protection`/`recruitment`) — é apenas rótulo informativo. Adicionar texto curto ao lado dele: "A página `/c/{slug}` cria leads no funil de Associados; a página `/r/{slug}` cria leads no funil de Consultores."
- Sem mudanças funcionais; só remove a confusão visual reportada.

---

## 3. Mensagens do WhatsApp não aparecem no CRM

### Diagnóstico

Vários sintomas combinados nos logs e no banco:

1. Os logs recentes da função `crm-webhook` são todos `⛔ Webhook rejeitado: secret inválido ou ausente` — ou seja, a Evolution ESTÁ chamando o webhook, mas sem o header `x-webhook-secret` (ou com valor diferente).
2. Verifiquei `integration_settings`: a tabela está vazia. O secret existe no env do Supabase (`EVOLUTION_WEBHOOK_SECRET`), e `getIntegrationValue` faz fallback para `Deno.env.get` — então o `crm-webhook` **carrega** o secret e passa a exigir validação.
3. Mas em `crm-create-instance`, o webhook é configurado na Evolution com `headers: webhookSecret ? { 'x-webhook-secret': webhookSecret } : undefined`. Se a sua instância Evolution **não suporta `headers` customizados** (algumas builds do Baileys/Evolution v2 ignoram esse campo dentro do objeto `webhook`), os webhooks chegam sem o header e o `crm-webhook` rejeita 401.
4. Resultado: nenhuma mensagem entra. Isso bate exatamente com o que você reportou.
5. As instâncias recém criadas (`teste5moadr` etc.) também não têm `last_webhook_at` populado — confirma que NENHUM webhook está sendo aceito.

### Correção (mantendo o secret)

- `crm-webhook` aceitar o secret via **três caminhos** já tenta (`x-webhook-secret`, `Authorization: Bearer`, `apikey`). Vou acrescentar **mais dois fallbacks aceitos pela Evolution**:
  - **Query string** `?secret=...` (Evolution permite anexar query no `webhook.url`).
  - **Header `x-evolution-apikey`** (alguns deploys reescrevem o `apikey`).
- `crm-create-instance` passar o secret também via query string na URL do webhook: `${SUPABASE_URL}/functions/v1/crm-webhook?secret=${secret}`. Isso garante autenticação mesmo se a Evolution descartar o objeto `headers`.
- Reaplicar `webhook/set` em todas as instâncias já existentes (sem recriar): nova edge function `crm-rebind-webhooks` (super admin/admin) ou simplesmente expor um botão "Reconfigurar webhook" em `WhatsAppConnectionSettings`. Mais simples e não invasivo: ao abrir a aba CRM, se a instância está `connected` mas `last_webhook_at` é nulo ou >24h, chamar `crm-repair-connection` que já existe e rodar `webhook/set` ali com a URL nova com `?secret=`.
- **Endurecer e diagnosticar**: quando o `crm-webhook` rejeita, logar **qual fonte foi tentada** (header vs query vs authorization) e qual valor recebido (mascarado: primeiros 4 chars + `***`), pra detectar rapidamente se o problema volta.

### Sincronização do histórico que ficou faltando

- A função `crm-sync-recent` já existe. Após reconfigurar o webhook, disparar uma sincronização das últimas 48h automaticamente para a instância que reconectou (já parte do fluxo de `crm-repair-connection`). Mantém o que já está e só passa a ser disparado também quando detectarmos que webhooks estão silenciosos.

### Resultado
- Webhook volta a ser aceito mesmo se a Evolution descartar o header.
- Mensagens enviadas/recebidas pelo app aparecem no CRM em ordem (lógica de `messages_upsert`/`message_create`/`send_message` já está implementada e funciona).
- Sincronização imediata cobre o intervalo do problema.

---

## 4. Migrations necessárias

```sql
-- Coluna no users para o quiz saber qual funil alimenta
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS quiz_funnel_type public.funnel_type NOT NULL DEFAULT 'consultor';

-- Atualiza RPC get_consultant_by_slug para retornar a nova coluna
CREATE OR REPLACE FUNCTION public.get_consultant_by_slug(p_slug text)
RETURNS TABLE (... colunas atuais ..., quiz_funnel_type public.funnel_type)
... (mantendo SECURITY DEFINER e SET search_path = public)
```

Sem alterações em RLS, sem criar tabelas, sem tocar em `auth/storage/realtime`.

---

## 5. Arquivos editados (resumo técnico)

- `src/components/consultant/ConsultantDashboard.tsx` — usa `useFunnel()`, filtra leads e stages por `resolvedFunnel`.
- `src/pages/Quiz.tsx` / `src/components/quiz/QuizContainer.tsx` — passa `funnel_type = consultant.quiz_funnel_type` no insert.
- `src/components/consultant/ConsultantSettings.tsx` — bloco "Funil do Quiz" + texto de esclarecimento na aba Captura.
- `supabase/functions/crm-webhook/index.ts` — aceita `?secret=` e `x-evolution-apikey`, log diagnóstico mascarado.
- `supabase/functions/crm-create-instance/index.ts` — anexa `?secret=` na URL do webhook (cinto e suspensório com headers).
- `supabase/functions/crm-repair-connection/index.ts` — reaplica `webhook/set` com URL atualizada.
- 1 migration para `quiz_funnel_type` + RPC.

---

## 6. Garantias

- Nenhuma rota alterada (`/quiz/`, `/c/`, `/r/`, `/admin/*` continuam iguais).
- Nenhum slug afetado.
- Compatibilidade preservada: instâncias antigas continuam funcionando (o webhook aceita o secret de várias formas).
- O quiz continua por padrão alimentando funil de **Consultores** — opt-in para Associados via Configurações.
- Dashboards existentes não são quebrados; passam apenas a respeitar o toggle.

Posso executar?

