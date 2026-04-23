

# Diagnóstico geral e plano de correções — separação de funis, Analytics, Ranking, Super Admin, Quiz on/off, Tráfego, Pipeline e Áudio do CRM

Tudo aditivo. Nenhuma rota, slug, função, tabela ou fluxo existente é removido.

---

## 1. Funil afeta tudo — varredura completa

### 1.1 Dashboard do consultor (já filtra por funil) — só falta esconder o link do Quiz quando o funil ativo é Associados E o quiz está desativado para esse funil
- Hoje `ConsultantDashboard.tsx` já lê `useFunnel().resolvedFunnel` e filtra leads/stages corretamente. ✅
- Adição: o card "Link do Quiz" passa a ser exibido apenas quando o quiz estiver habilitado para o funil ativo (regra detalhada em **§4**). O card "Página de Captura" continua visível em ambos os funis.

### 1.2 Analytics (`/admin/analytics`) — hoje mostra dados focados em consultor mesmo quando o usuário está no funil Associados
**Mudanças:**
- Passa a ler `useFunnel().resolvedFunnel` e filtra `quiz_submissions_new` por `funnel_type = resolvedFunnel`.
- Quando o funil ativo é **Consultores**: layout atual permanece (renda, exp. de vendas, exp. com proteção, CNH, veículo etc. — métricas focadas em recrutamento de consultores).
- Quando o funil ativo é **Associados**: substitui o conjunto de gráficos por um foco em captação de associados:
  - "Novos Consultores" → vira **"Novos Associados"** (leads em stage cujo nome contém "associado", "fechad", "convertid", "ganho").
  - Esconde donuts irrelevantes para associados: `sales_experience`, `vehicle_protection_experience`, `current_income`, `desired_income`.
  - Mantém: total/completos/abandonados, leads hoje, tempo médio, **distribuição por temperatura**, **distribuição por estado civil**, **distribuição por veículo**, **distribuição por CNH**, **distribuição por situação profissional** (úteis para perfil de associado).
  - Acrescenta um donut **"Origem do lead"** (`lead_source`: quiz / capture / whatsapp / recruitment) — particularmente útil para associados, já que normalmente não chegam por quiz.
  - Texto do header passa a refletir o funil: "Estatísticas detalhadas dos leads de associados" / "Estatísticas detalhadas das respostas do quiz" conforme `resolvedFunnel`.
- Quando `lead_source = quiz` é raro/zero para associados, o estado vazio é tratado com mensagem amigável ("Sem leads de quiz neste funil — confira a aba CRM").

### 1.3 Ranking (`/admin/ranking`) — hoje os totais somem todos os funis
**Mudanças:**
- O hook `useRankingData` já passa `funnel_type: activeFunnel` para o backend. ✅
- A edge function `ranking-get` já aceita esse filtro e retorna a contagem correta por funil. ✅
- Frente faltante: o título e os labels da página são fixos em "Consultores". Passa a ser dinâmico:
  - `activeFunnel === 'associado'` → "Ranking de Associados", coluna "Novos Cons." vira "Novos Assoc.", subtítulo "Desempenho detalhado dos associados".
  - `activeFunnel === 'consultor'` → comportamento atual.
  - `activeFunnel === 'all'` (super admin) → mostra Tabs Consultores/Associados (já implementado) + título "Ranking Geral".
- Como `ranking_position` já é recalculado por funil pelo backend, o ranking deixa de "ficar igual" ao trocar — o problema atual é só que a UI exibe sempre os mesmos labels e a chave da query antiga sobrevivia no cache. Forçamos invalidação do `unified-ranking` no `setActiveFunnel` (já está) e adicionamos `keepPreviousData: false` para evitar flash com dados do funil anterior.

### 1.4 Super Admin Dashboard (`/admin/super`) — passa a respeitar o `FunnelSwitcher` global
**Mudanças:**
- Hoje a página tem `Tabs` internas (Geral/Consultor/Associado) que ignoram o `FunnelSwitcher` do sidebar. Vamos:
  - Manter as Tabs internas (`Tabs defaultValue="all"`), mas sincronizá-las com o `FunnelSwitcher` global: `activeFunnel === 'all'` → tab "Geral", `'consultor'` → tab "Consultores", `'associado'` → tab "Associados". Trocar a tab também muda o `activeFunnel`. Bidirecional.
  - Padrão para super admin = `'all'` (já é o default do contexto). ✅
- `SuperAdminCharts` já aceita `funnel?: FunnelType`; `'all'` continua sem filtro (soma).
- Acrescenta na visão por funil: o card "Top 5 Consultores" (no funil Associados o título passa para "Top 5 Captadores").

### 1.5 Outras páginas: confirmadas
- **Pipeline**: já filtra por `resolvedFunnel`. ✅
- **Leads**: confirmar que `AdminLeads.tsx` filtra por funil (é o caso). ✅
- **CRM (conversas)**: respeita funil via `useConversations` (já está). ✅

---

## 2. Quiz desligado por padrão para Associados, configurável em ambos os funis

### Banco — migration aditiva
- Adiciona em `public.users` a coluna `quiz_enabled_consultor boolean NOT NULL DEFAULT true` e `quiz_enabled_associado boolean NOT NULL DEFAULT false`.
  - `quiz_funnel_type` (já existente) continua sendo a referência de qual funil os leads do quiz alimentam (caso o consultor escolha apenas um quiz único, mantendo retrocompatibilidade).
- Atualiza `get_consultant_by_slug` para retornar essas duas colunas + checagem de habilitação no quiz público.

### Comportamento
- Página `/quiz/:slug` continua existindo. Ela passa a verificar:
  - se `quiz_enabled_<funil>` correspondente ao `quiz_funnel_type` do consultor é `true` → renderiza normalmente;
  - se `false` → renderiza um estado "Este quiz está temporariamente indisponível" (não 404, para não quebrar links já distribuídos).
- Em **`ConsultantSettings → aba Quiz`**:
  - Adiciona, no topo, dois switches (um por funil, mostra apenas os funis que o consultor tem em `allowed_funnels`):
    - "Quiz para Consultores" — default `ON`.
    - "Quiz para Associados" — default `OFF`.
  - Texto explicativo curto: "Quando desativado, o link `/quiz/{seu-slug}` mostra mensagem de quiz indisponível e o card do Quiz não aparece no Dashboard daquele funil."
- O seletor "Funil que o Quiz alimenta" (já existente) permanece — controla para qual funil cai o lead quando o quiz é submetido.

### Quiz no painel de Associados — perguntas
- Hoje `quiz_questions` tem `is_default` (perguntas iniciais como nome/telefone/email). Mantemos.
- Quando o consultor ativa "Quiz para Associados", o `QuizQuestionsEditor` exibe **somente as 3 perguntas iniciais por padrão** (as `is_default = true`), e mostra um botão "Adicionar pergunta" para o consultor incluir perguntas personalizadas voltadas a associados. As perguntas customizadas dele continuam compartilhadas (não duplicamos por funil — o consultor edita um único conjunto, vinculado ao seu `consultant_id`).
- Para o funil de **Consultores**, o comportamento permanece: vem com as perguntas atuais (as defaults + customizadas que ele já criou).
- Acrescentamos um aviso no editor explicando: "Estas perguntas são compartilhadas entre todos os funis em que você usa o quiz."

### Dashboard — link do Quiz
- O card "Link do Quiz" no `ConsultantDashboard` só aparece quando `quiz_enabled_<resolvedFunnel> === true`. O card "Página de Captura" continua sempre visível.

---

## 3. Tráfego — Total Gasto incoerente entre 14d/30d/Total

### Diagnóstico (confirmado em DB)
Há um **buraco de 35 dias** nas métricas: existem dados de `2026-04-19..2026-04-23` e `2025-... até 2026-03-13`. Entre `2026-03-14` e `2026-04-18` não há linhas. Isso explica o que você vê:
- **Total** (`preset = total` → sem filtro de data) = **R$ 28.280,05** (soma de todo histórico, ~90 dias antigos + 5 novos).
- **30 dias** (today − 29 = `2026-03-25`): só pega `2026-04-19..04-23` (5 dias) = ~**R$ 1.177,83**.
- **14 dias**: idem, ~**R$ 1.170,06**.

Causa raiz em `sync-all-accounts/index.ts`: a sincronização inicial faz `last_90d`, mas a partir daí passa a fazer apenas `last_3d`. Se a conta ficou sem atualização por mais de 3 dias (qualquer pausa do cron, conta nova com dados antigos da Meta etc.), todo o intervalo entre o `days_synced` salvo e os últimos 3 dias **nunca é coberto**.

### Correção
- **Edge function `sync-all-accounts`**: troca a heurística:
  - Se `last_synced_at` for mais antigo que `7 dias` ou `is null` → roda `last_30d` em vez de `last_3d` (cobre buracos de até 1 mês entre execuções).
  - Sempre dispara também `today` (já faz). ✅
  - Mantém `last_90d` no primeiro sync. ✅
- **Reposição do histórico que está em buraco**: criar uma edge function nova `sync-fill-gap` (admin-only) que:
  1. Detecta para cada conta monitorada o intervalo faltante examinando `MIN/MAX(date)` em `ad_metrics` e os "gaps" maiores que 1 dia dentro dos últimos 90 dias.
  2. Chama `fetch-meta-ads-data` com `time_range={"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}` para cada gap (precisamos estender `fetch-meta-ads-data` para aceitar `time_range` além de `date_preset`).
  3. Retorna um relatório `{account, days_filled}`.
- **`fetch-meta-ads-data`**: hoje só aceita `date_preset`. Vamos aceitar opcionalmente `time_range: { since, until }` no body. Se vier, monta a URL com `time_range=...` em vez de `date_preset=...` (o resto da função permanece igual).
- **UI**: na aba Tráfego (componente onde está o seletor de período), adiciona um botão pequeno "Reparar histórico" (visível apenas para super admin) que dispara `sync-fill-gap` para a `organization_id` atual. Toast com o relatório.
- Além disso, executamos `sync-fill-gap` agora, na fase de implementação, para a organização afetada — assim os números de 14d/30d ficam corretos imediatamente.

---

## 4. Pipeline — card de lead aparecendo cortado em alguns quadros

**Diagnóstico:** o `Droppable` define `h-[calc(100dvh-180px)]` no mobile e `h-[calc(100%-8px)]` no desktop, e o `ScrollArea` interno tem `h-full p-2`. O problema é que o último item da lista cola no rodapé do quadro porque não há `padding-bottom` no container interno e o `ScrollArea` do Radix corta o ítem se ele for o último e o conteúdo encostar no fim.

**Correção:**
- Em `PipelineBoard.tsx`, adicionar `pb-4` no `<div className="space-y-2">` interno do `ScrollArea` para garantir respiro no fim da lista.
- Ajustar `ScrollArea` para `className="h-full"` e mover `p-2` para o div interno como `p-2 pb-6`, garantindo que o último card sempre tenha 24px de espaço abaixo.
- Adicionar `min-h-0` explícito no contêiner pai do `ScrollArea` (já está em `flex-1 overflow-hidden`, mas `min-h-0` garante o cálculo correto em flex columns).

---

## 5. CRM — áudio enviado fica só com horário, sem player

### Diagnóstico (confirmado em DB)
Mensagens de áudio enviadas hoje (`2026-04-23`) têm `type = 'audio'` mas `media_url IS NULL`. As de fevereiro têm `media_url` preenchido. O componente `MessageItem` exige `message.type === 'audio' && message.media_url` para renderizar o `AudioPlayer`. Sem URL, só o footer (horário) aparece.

**Causa raiz:** `crm-send-message` faz `upsert` em `(instance_id, message_id)`. O webhook `crm-webhook` recebe `MESSAGES_UPSERT` da Evolution para a mesma mensagem (a Evolution ecoa o que ela mesma enviou) com `media_url = null` (porque a Evolution só dá o `.enc` da WhatsApp na metadata, não baixa para nós) — e o upsert do webhook **sobrescreve o `media_url`** que nós tínhamos acabado de salvar com a URL do nosso bucket `crm-media`.

### Correção
- Em `crm-webhook/index.ts`, no handler de `MESSAGES_UPSERT`/`message_create` para mensagens **outgoing** (`fromMe = true`):
  - Antes do upsert, fazer um `select` por `(instance_id, message_id)` e, se a linha já existir com `media_url IS NOT NULL` e a payload do webhook tiver `media_url IS NULL`, **preservar** o `media_url` original (não sobrescrever com null).
  - Na prática: ao construir o objeto a salvar no upsert, usar `media_url: webhookMediaUrl ?? existing?.media_url ?? null` e o mesmo padrão para `media_filename`, `media_mimetype`, `media_size`.
- Em `crm-send-message`, marcar explicitamente a mensagem com `metadata.sent_via = 'app'` para diagnóstico futuro.
- Como há áudios já quebrados no banco do dia de hoje, executamos um `UPDATE` direto restaurando `media_url` para os áudios outgoing dos últimos 7 dias quando houver upload em `crm-media` correspondente. Esse update é via migration de manutenção que faz: `UPDATE crm_messages SET media_url = ... WHERE id IN (951900a4..., 5b83b6d9...)` baseado nos 2 IDs afetados encontrados; é uma operação pontual e segura.

---

## 6. Resumo dos arquivos editados

**Frontend**
- `src/components/consultant/ConsultantDashboard.tsx` — esconde card do Quiz quando `quiz_enabled_<funil>` é falso.
- `src/components/consultant/ConsultantSettings.tsx` — switches "Quiz para Consultores" / "Quiz para Associados", aviso no editor.
- `src/components/consultant/QuizQuestionsEditor.tsx` — aviso de compartilhamento, comportamento default mostrar `is_default` quando o consultor ativa o quiz pela primeira vez.
- `src/pages/AdminAnalytics.tsx` — leitura do `useFunnel`, conjunto de gráficos por funil, donut "Origem do lead", título dinâmico.
- `src/pages/AdminRanking.tsx` — títulos/labels dinâmicos por funil; manter Tabs no `'all'`.
- `src/pages/AdminSuperAdmin.tsx` — sincroniza `Tabs` interna com `FunnelSwitcher` global (ambos os sentidos).
- `src/pages/Quiz.tsx` — checagem `quiz_enabled_<funil>` antes de renderizar.
- `src/components/crm/PipelineBoard.tsx` — `pb-4`/`pb-6` e `min-h-0` para que o último card não fique cortado.
- `src/components/traffic/TrafficSettings.tsx` (ou onde fica o painel de tráfego) — botão "Reparar histórico" (super admin).

**Edge functions**
- `supabase/functions/crm-webhook/index.ts` — preservar `media_url`/`media_filename`/`media_mimetype`/`media_size` existentes em outgoing.
- `supabase/functions/crm-send-message/index.ts` — `metadata.sent_via = 'app'` para auditoria.
- `supabase/functions/sync-all-accounts/index.ts` — heurística `last_30d` quando `last_synced_at > 7 dias`.
- `supabase/functions/fetch-meta-ads-data/index.ts` — aceitar `time_range: { since, until }`.
- `supabase/functions/sync-fill-gap/index.ts` — **nova**: detecta gaps e preenche por ranges.

**Migrations**
1. `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS quiz_enabled_consultor boolean NOT NULL DEFAULT true;`
2. `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS quiz_enabled_associado boolean NOT NULL DEFAULT false;`
3. Atualizar `get_consultant_by_slug` para retornar essas colunas.
4. Update pontual restaurando `media_url` dos áudios outgoing quebrados (lookup do storage `crm-media`).

---

## 7. Garantias

- **Nenhuma rota nova ou removida**. `/quiz/`, `/c/`, `/r/`, `/admin/*` continuam idênticos.
- Nenhum slug muda; quando o quiz é desativado, a URL `/quiz/{slug}` apenas mostra "indisponível".
- Backwards compat: `quiz_enabled_consultor` default `true` → consultores existentes não veem mudança alguma. `quiz_enabled_associado` default `false` → contas só de associados não veem o quiz a menos que ativem.
- A correção do áudio é defensiva: o webhook só preserva o `media_url` se o existente NÃO for null e o novo for null. Não há risco de impedir atualização legítima.
- O reparo de histórico de tráfego não muda o esquema da tabela `ad_metrics` — apenas insere/atualiza linhas que já estariam lá se a sincronização tivesse rodado direito.
- Após a implementação, rodo `tsc --noEmit` e reporto o resultado.

Posso executar?

