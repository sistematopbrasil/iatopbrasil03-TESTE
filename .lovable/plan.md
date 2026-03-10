

## Plano: Corrigir Métricas, Esconder IA Desativada e Melhorar Loading

---

### Problema 1: Métricas incorretas no Dashboard do Consultor

**Causa raiz**: O `ConsultantDashboard` (linha 62) filtra apenas leads com `lead_source = 'quiz'`, mas o dashboard deveria mostrar TODOS os leads do consultor (quiz, captura, WhatsApp, manual). Isso faz com que métricas como "Total de Leads", "Leads Hoje" etc. não reflitam a realidade.

**Correção**: Remover `.eq('lead_source', 'quiz')` da query de leads no `ConsultantDashboard`. O prefetch em `usePrefetchAdminData.ts` (linha 76-93) já foi corrigido para trazer todos os leads — mas o dashboard ainda filtra por quiz na query própria.

| Arquivo | Mudança |
|---------|---------|
| `src/components/consultant/ConsultantDashboard.tsx` | Remover `.eq('lead_source', 'quiz')` da linha 62 |

---

### Problema 2: Botão "Agente IA" e "Disparar IA" aparecem com IA desativada

**Causa raiz**: O `AIStatusBadge` (linha 46) retorna `null` quando `aiEnabled` é `false`, o que está correto. Porém, no `ChatWindow.tsx`, a query `current-user-ai-status` tem `staleTime: 5 * 60 * 1000` (5 minutos) — se o cache antigo diz `ai_enabled: true`, o badge aparece mesmo após desativar. Além disso, o badge mostra opções "Disparar IA" mesmo quando `effectiveStatus === 'none'` (sem estado de IA na conversa) — trata como `'active'` na linha 49.

**Correções**:
1. Reduzir `staleTime` da query `current-user-ai-status` para 30 segundos
2. No `AIStatusBadge`, quando `effectiveStatus` é `none` e IA global está ativada, ainda trata como `active` — isso está correto SOMENTE se `aiEnabled` realmente veio como `true`. O problema real é o cache stale.
3. Invalidar a query `current-user-ai-status` quando o usuário navega para o CRM

| Arquivo | Mudança |
|---------|---------|
| `src/components/crm/ChatWindow.tsx` | Reduzir staleTime de 5min para 30s; adicionar `refetchOnMount: true` |

---

### Problema 3: Páginas lentas com loading spinner genérico

**Causa raiz**: Múltiplas páginas (Dashboard, Settings, AI Config, Ranking, Consultants, Events) mostram apenas um `Loader2` spinner simples enquanto carregam. Não há skeleton screens que deem feedback visual da estrutura da página.

**Correção**: Criar um componente `PageSkeleton` reutilizável com variantes para cada tipo de página (dashboard, table, kanban, config). Substituir os spinners `Loader2` por skeletons contextuais.

**Páginas a atualizar**:

| Página | Loading atual | Loading novo |
|--------|--------------|--------------|
| `AdminDashboard.tsx` | Spinner | Skeleton com cards + gráficos |
| `AdminSettings.tsx` | Spinner | Skeleton com formulário |
| `AdminAIConfig.tsx` | Spinner | Skeleton com toggle + textarea |
| `AdminRanking.tsx` | Spinner | Skeleton com tabela |
| `ConsultantsManagement.tsx` | Spinner | Skeleton com tabela |
| `AdminEvents.tsx` | Spinner | Skeleton com cards de eventos |

**Componente novo**: `src/components/ui/page-skeleton.tsx` — exporta variantes:
- `DashboardSkeleton`: Grid 2x4 de cards + 2 gráficos placeholder
- `TableSkeleton`: Header + 6 rows de skeleton
- `FormSkeleton`: Labels + inputs + botão
- `CardGridSkeleton`: Grid de cards

---

### Resumo

| # | Problema | Arquivo(s) | Mudança |
|---|----------|-----------|---------|
| 1 | Métricas erradas | `ConsultantDashboard.tsx` | Remover filtro `lead_source='quiz'` |
| 2 | Badge IA com cache stale | `ChatWindow.tsx` | staleTime 30s + refetchOnMount |
| 3 | Loading genérico | 7 arquivos | Criar `PageSkeleton` + substituir spinners |

