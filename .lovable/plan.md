

# Plano — Analytics, Quiz separado por slug, CRM list, Pipeline e Ranking instantâneo

Tudo aditivo. Nenhuma rota/slug existente é removida.

---

## 1. Analytics — Funil Consultores não mostrava dados

**Diagnóstico:** Em `AdminAnalytics.tsx` (linha 103‑105), no funil de Consultores aplicamos `lead_source = 'quiz'`. No banco atual a conta tem 9 leads de quiz mas 31 de captura e 63 de WhatsApp — todos do funil Consultores. Resultado: a tela aparece quase vazia.

**Fix:**
- Remover o filtro `lead_source='quiz'` para Consultores também. Analytics passa a contar TODOS os leads do funil (alinhado com o que o usuário vê no Pipeline e CRM).
- Atualizar os textos do header:
  - Consultores: "Estatísticas dos leads do funil de Consultores"
  - Associados: já está correto.
- Os donuts de quiz (renda atual, renda desejada, vendas, proteção veicular) continuam funcionando — aparecem vazios quando o lead não veio do quiz, o que é o comportamento desejado.

## 2. Analytics — Funil Associados

**Fix em `AdminAnalytics.tsx`:**
- Remover o donut "Estado Civil" (`relationshipData`) e "Situação Profissional" (`employmentData`) **apenas** quando `isAssociado === true`.
- Manter os outros (Origem, Localização, Veículo, CNH).
- Para Consultores, manter Estado Civil e Situação Profissional como hoje.

## 3. Quiz — Slug separado por funil + remoção de configs duplicadas

O usuário quer dois quizzes completamente separados, cada um com seu próprio slug. Hoje existe um único `quiz_slug` por consultor + flag `quiz_funnel_type` que escolhe qual funil ele alimenta. Vamos manter compatibilidade total e adicionar:

### 3.1 Migration aditiva
- `ALTER TABLE users ADD COLUMN quiz_slug_associado text UNIQUE;` — slug exclusivo do quiz de Associados.
- `quiz_slug` existente continua sendo o slug do quiz de Consultores (não muda nada para usuários atuais).
- Atualizar `get_consultant_by_slug(p_slug)`: se o slug bater com `quiz_slug` → retorna registro com `quiz_funnel_type='consultor'`; se bater com `quiz_slug_associado` → retorna com `quiz_funnel_type='associado'` injetado dinamicamente. Mesmo retorno, cliente não muda.
- Trigger pequena para gerar `quiz_slug_associado` automaticamente para novos consultores que tenham `'associado'` em `allowed_funnels` (sufixo `-associado`).

### 3.2 `Quiz.tsx` / `QuizContainer.tsx`
- A função `get_consultant_by_slug` decide qual funil. O `QuizContainer` passa a usar o `quiz_funnel_type` que veio do RPC (não mais de uma propriedade global do usuário).
- O gate de "quiz indisponível" usa o flag correto (`quiz_enabled_consultor` ou `quiz_enabled_associado`).
- Lead criado herda o funil correto (`funnel_type` do RPC).
- URL pública continua `/quiz/{slug}` para os dois — o roteador é o mesmo.

### 3.3 `ConsultantSettings.tsx` — aba Quiz
- **Remover** a seção "Funil que o Quiz alimenta" (selector com botões Consultor/Associado).
- **Remover** a seção "Disponibilidade do Quiz" do topo (a que mostra os dois switches juntos).
- Substituir por uma única seção **dependente do funil ativo do sidebar** (`useFunnel().resolvedFunnel`):
  - Se funil ativo = `consultor`: mostra apenas o switch "Ativar quiz de Consultores", o input do `quiz_slug` (consultor) e o link `/quiz/{quiz_slug}`.
  - Se funil ativo = `associado`: mostra apenas o switch "Ativar quiz de Associados", o input do `quiz_slug_associado` e o link `/quiz/{quiz_slug_associado}`.
- Banner curto: "Você está editando o quiz de {Consultores|Associados}. Para configurar o outro, troque o funil no menu lateral."
- Validação de slug duplicado já existente é reusada (apenas troca-se o campo verificado).
- O `QuizQuestionsEditor` continua filtrando perguntas pelo `resolvedFunnel` (já implementado).

### 3.4 Compat
- Usuários só com funil Consultor não veem nenhuma diferença (continuam usando `quiz_slug`).
- Usuários com os dois funis ganham um segundo slug ao acessar a aba pela primeira vez no funil Associados (ou via seed da migration).
- A tabela `capture_page_configs` continua usando `(consultant_id, page_purpose)` — sem alteração.

## 4. CRM — Lista de conversas

**Diagnóstico:** Em `ConversationList.tsx` (linha 425), o botão de 3 pontos tem `opacity-0 group-hover:opacity-100`. Em telas largas só aparece com hover; em telas estreitas o hover desaparece antes do clique chegar (toque no mobile). O horário aparece sempre, mas o usuário descreve que em viewport intermediário fica difícil ver os 3 pontos.

**Fix:**
- Remover `opacity-0 group-hover:opacity-100` — botão de 3 pontos passa a ser sempre visível (mais discreto: `text-muted-foreground hover:text-foreground` para não poluir).
- Garantir `flex-shrink-0` no container do timestamp+menu para não sumir quando o nome é longo.
- Esses dois elementos continuam à direita do nome, sempre na mesma linha.

## 5. Pipeline — "Novos Leads" cortando o último card

**Diagnóstico:** Em `PipelineBoard.tsx` o `Droppable` define a coluna com `h-[calc(100dvh-180px)] md:h-[calc(100%-8px)]`. No desktop, o pai (`AdminPipeline.tsx`) usa `inline-flex` com `style={{ height: '100%' }}` — o `100%` da coluna resolve para a altura visível, mas o ScrollArea dentro do `flex-1` calcula com base num pai cuja altura inclui o header da coluna (~52px). Resultado: a área de scroll fica ~52px maior do que a janela útil, e o último card cai abaixo do viewport.

**Fix em `PipelineBoard.tsx`:**
- Mudar a altura da coluna para `md:h-full` e adicionar `pb-4` no wrapper externo do board.
- O container interno do scroll já tem `flex-1 min-h-0 overflow-hidden` + `ScrollArea h-full`. Aumentar o padding final dos leads para `pb-16` (era `pb-12`) — com isso o último card sempre tem margem mesmo quando o scroll calcula altura por baixo.
- Em `AdminPipeline.tsx`, garantir `min-h-0 h-full` no wrapper do scroll horizontal (já existe `flex-1 min-h-0`), e mudar o `style={{ height: '100%' }}` do `inline-flex` para `style={{ minHeight: '100%', height: '100%' }}` para o flex preencher exatamente a altura disponível.

## 6. Ranking — Aparece zerado e demora para atualizar

**Diagnóstico:** `useRankingData` usa `queryKey: ['unified-ranking', periodStart ?? 'all', periodEnd ?? 'now', activeFunnel]`. O `usePrefetchAdminData` faz prefetch e injeta em `['unified-ranking', 'all', 'now']` — **sem o `activeFunnel`**. Por isso o cache prefetched nunca é encontrado para nenhum funil específico, a query inicial roda do zero (mostra zeros enquanto carrega) e só depois popula.

Além disso, a query principal não usa `placeholderData` — então enquanto roda mostra `ranking?.length || 0` que é `0`.

**Fix:**
- Em `usePrefetchAdminData.ts`: prefetch do ranking para os três funis em paralelo (`consultor`, `associado`, `all`) injetando nas queryKeys corretas: `['unified-ranking', 'all', 'now', 'consultor']`, `['unified-ranking', 'all', 'now', 'associado']`, `['unified-ranking', 'all', 'now', 'all']`.
- Em `useRankingData.ts`: adicionar `placeholderData: (prev) => prev` (mantém dados antigos enquanto refaz) e `refetchOnMount: false` quando já há dados em cache.
- Em `AdminRanking.tsx`: substituir o `showLoading` para usar `isLoading && !ranking?.length && !grouped` — e mostrar skeleton apenas no primeiro fetch real.
- Resultado: ranking aparece imediatamente ao abrir a página (vindo do prefetch ou do último cache), sem flash de zero.

---

## 7. Arquivos editados

**Frontend**
- `src/pages/AdminAnalytics.tsx` — remover filtro `lead_source` e ajustar donuts por funil.
- `src/components/consultant/ConsultantSettings.tsx` — refatorar aba Quiz: um único bloco dependente do funil ativo, com `quiz_slug` ou `quiz_slug_associado`. Remover a seção "Funil que o Quiz alimenta" e "Disponibilidade do Quiz" duplicadas.
- `src/lib/consultant-context.ts` + `src/lib/organization-service.ts` — incluir `quiz_slug_associado` no tipo retornado e no select.
- `src/components/quiz/QuizContainer.tsx` — usar `quiz_funnel_type` retornado pelo RPC (não mais hard-coded do consultor).
- `src/pages/Quiz.tsx` — gate usa o flag correto baseado no `quiz_funnel_type` retornado.
- `src/components/crm/ConversationList.tsx` — botão de 3 pontos sempre visível.
- `src/components/crm/PipelineBoard.tsx` — altura da coluna `md:h-full`, padding interno `pb-16`.
- `src/pages/AdminPipeline.tsx` — `style minHeight 100% height 100%` no inline-flex.
- `src/hooks/usePrefetchAdminData.ts` — prefetch dos 3 funis no ranking.
- `src/hooks/useRankingData.ts` — `placeholderData` + `refetchOnMount` ajustados.
- `src/pages/AdminRanking.tsx` — `showLoading` mais permissivo.

**Migration**
- Adiciona `quiz_slug_associado` (`text UNIQUE`) em `users`.
- Atualiza `get_consultant_by_slug(p_slug)` para resolver pelos dois slugs e devolver o `quiz_funnel_type` correto.
- Trigger `set_quiz_slug_associado_default` que gera o slug do funil Associados (`{slug}-associado`) quando o usuário tem `'associado'` em `allowed_funnels` e ainda não tem o campo.
- Backfill: para todos os usuários ativos com `'associado'` em `allowed_funnels` e `quiz_slug_associado IS NULL`, gera o slug.

**Sem mudanças**
- Routes (`/quiz/:slug`, `/c/:slug`, `/r/:slug`) intactas.
- Tabela `quiz_questions` (já tem `funnel_type`) intacta.
- Tabela `capture_page_configs` intacta.
- Edge functions de ranking, webhooks e captura intactas.

## 8. Garantias

- Usuários só com funil Consultor: nenhuma alteração visível, slug atual continua funcionando.
- Usuários com dois funis: ganham slug separado para o quiz de Associados; podem editar cada quiz isoladamente trocando o funil no sidebar.
- Pipeline scroll: corrigido sem alterar a lógica de drag-and-drop.
- Ranking: dados aparecem instantaneamente ao abrir a página em qualquer funil.
- Após implementação, rodo `tsc --noEmit` e reporto resultado.

Posso executar?

