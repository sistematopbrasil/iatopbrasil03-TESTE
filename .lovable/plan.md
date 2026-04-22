

# Fase C — Implementação aprovada

Implemento o plano exatamente como descrito, com a confirmação:
- **Pipeline em modo "Todos" (super admin)**: força fallback para `default_funnel` e exibe banner "Pipeline mostra apenas o funil X. Use o seletor para trocar."

## Ordem de execução

**1. Fundação (estado global)**
- `src/contexts/FunnelContext.tsx` — provider com `activeFunnel`, `availableFunnels`, `canSeeAll`, `setActiveFunnel`. Inicialização: localStorage → `last_active_funnel` → `default_funnel`. Ao trocar: atualiza estado, grava localStorage, persiste no banco em background, invalida queries.
- `src/App.tsx` — envolver rotas autenticadas com `<FunnelProvider>` (dentro do `QueryClientProvider`).

**2. Componentes visuais reutilizáveis**
- `src/components/admin/FunnelSwitcher.tsx` — pill segmentado, esconde se `availableFunnels.length ≤ 1`. Super admin recebe opção "Todos".
- `src/components/leads/FunnelBadge.tsx` — badge colorido (Consultores: `#EB6608`, Associados: `#3B82F6`).

**3. Layout**
- `src/components/admin/AdminLayout.tsx` — renderizar `<FunnelSwitcher />` no sidebar desktop (acima de `renderUserInfo`) e dentro do `Sheet` mobile.

**4. Páginas e hooks com filtro de funil** (versionar `queryKey` com `activeFunnel`):
- `src/components/crm/PipelineBoard.tsx` + `src/pages/AdminPipeline.tsx` — filtro `funnel_type`. Em "Todos", força `default_funnel` e exibe `<Alert>` no header.
- `src/pages/AdminLeads.tsx` — filtro + coluna "Funil" com `FunnelBadge`.
- `src/hooks/useRankingData.ts` + `src/pages/AdminRanking.tsx` — passa `funnel_type` ao `ranking-get`. Em "Todos", renderiza `<Tabs>` com 2 tabelas separadas.
- `src/hooks/useAIConfig.ts` + `src/pages/AdminAIConfig.tsx` — query por `(user_id, funnel_type)`; se `null`, exibe card "Habilitar IA para este funil" com botão que cria registro vazio com `funnel_type` correto.
- `src/contexts/WhatsAppConnectionContext.tsx` + `src/hooks/useConversations.ts` + `src/pages/AdminCRM.tsx` — busca instância por funil; se ausente, exibe card "Conectar WhatsApp para [Funil]" reutilizando `ConnectionPanel`.
- `src/hooks/usePrefetchAdminData.ts` — incluir `activeFunnel` nos prefetches.

**5. Tag de funil em listas**
- `src/components/crm/LeadCard.tsx` — chip pequeno
- `src/components/crm/LeadProfile.tsx` — header
- `src/components/crm/QuizLeadsList.tsx`, `WhatsAppLeadsList.tsx`, `CaptureLeadsList.tsx` — coluna ou chip

**6. Super Admin — gestão de acesso a funis**
- `src/components/super-admin/CreateConsultantDialog.tsx` — bloco "Acesso a Funis" (2 checkboxes + radio de padrão), envia `allowed_funnels` + `default_funnel` para `create-consultant`.
- `src/components/super-admin/EditConsultantFunnelDialog.tsx` (novo) — mesmo bloco; antes de salvar removendo funil, chama `update-consultant-funnel-access` para mostrar contagem de leads/conversas que ficarão invisíveis em `<AlertDialog>` de confirmação.
- `src/components/super-admin/ConsultantsTable.tsx` — adicionar ação no menu para abrir o diálogo.

**7. Roteamento de leads novos**
- `src/pages/CapturePage.tsx` — passar `funnel_type: 'associado'` no insert quando rota for `/c/:slug`. (`/r/:slug` mantém default `'consultor'`.)
- `src/components/crm/NewContactDialog.tsx` — passar `funnel_type: activeFunnel` no insert (fallback `'consultor'` se "Todos").

## Garantias de não-quebra

| Risco | Mitigação |
|---|---|
| Usuário com 1 funil só | `FunnelSwitcher` retorna `null`; comportamento idêntico ao atual |
| Backfill: todos têm `allowed_funnels=['consultor']` + `default_funnel='consultor'` | Sistema funciona como hoje no primeiro deploy |
| `useAIConfig` save em conta antiga | `onConflict: 'user_id,funnel_type'` — registros existentes têm `funnel_type='consultor'` (Fase A backfill) |
| Realtime CRM escuta funil errado | Channel reinstanciado quando `instance.id` muda (já é o padrão) |
| Pipeline em "Todos" mostraria 2 boards | Banner + fallback para `default_funnel` (decisão confirmada) |
| Rotas `/c/:slug`, `/r/:slug`, `/quiz/:slug` | Nenhuma rota tocada — apenas o payload do insert no `/c/:slug` ganha `funnel_type` explícito |

## O que NÃO muda

Rotas, slugs, RLS, edge functions (Fase B já entregue), schema do banco, `Quiz.tsx`, `AdminSettings`, `AdminInstagram`, `AdminTraffic`, `AdminSuperAdmin` (visão consolidada), `AdminAnalytics` (filtra por `lead_source='quiz'` conforme memória), `AdminDashboard`.

## Entregáveis

**Novos arquivos (4):**
- `src/contexts/FunnelContext.tsx`
- `src/components/admin/FunnelSwitcher.tsx`
- `src/components/leads/FunnelBadge.tsx`
- `src/components/super-admin/EditConsultantFunnelDialog.tsx`

**Arquivos atualizados (~18):** App, AdminLayout, PipelineBoard, AdminPipeline, AdminLeads, AdminRanking, useRankingData, AdminAIConfig, useAIConfig, AdminCRM, WhatsAppConnectionContext, useConversations, usePrefetchAdminData, LeadCard, LeadProfile, QuizLeadsList, WhatsAppLeadsList, CaptureLeadsList, NewContactDialog, CapturePage, CreateConsultantDialog, ConsultantsTable.

Após aprovação, sistema continua 100% funcional para usuários atuais (todos com 1 funil = nenhuma diferença visual). Apenas usuários com 2 funis veem o seletor.

