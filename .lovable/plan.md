

# Diagnóstico do estado atual — antes de qualquer alteração

Este é um relatório read-only. Nenhuma alteração foi feita. Após sua aprovação eu sigo para a parte que ficou pendente.

---

## 1. O que está 100% concluído e funcionando

### 1.1. Toggle de funil corrigido (`FunnelContext.tsx` + `FunnelSwitcher.tsx`)
- O `FunnelProvider` agora reinicializa em login/logout via `supabase.auth.onAuthStateChange`.
- O `localStorage` é validado contra o `user.id` atual (chave `top-brasil:active-funnel-owner`). Se o valor pertence a outro usuário, é descartado.
- Regra blindada em 3 camadas:
  - se `availableFunnels.length === 1`, força esse único funil.
  - se `'all'` foi escolhido mas o usuário não é super admin OU só tem 1 funil, faz fallback para o default.
  - `setActiveFunnel` rejeita valores fora de `availableFunnels`.
- `FunnelSwitcher` esconde o pill quando `availableFunnels.length <= 1`, independente do role.
- **Resultado:** conta com só "associado" não vê mais toggle nenhum. Conta com os dois vê o toggle. Super admin com os dois vê `Consultor | Associado | Todos`.

### 1.2. Edição de funis na aba `/admin/consultants`
- `ConsultantsManagement.tsx` carrega `select('*')`, então `allowed_funnels` e `default_funnel` já vêm.
- Coluna **"Funis"** com badges clicáveis `C` / `A` (default em destaque, removido riscado) — abre o `EditConsultantFunnelDialog`.
- Item no menu de ações: **"Editar funis de acesso"** (ícone `Layers`).
- Dialog reutilizado é o mesmo do dashboard super admin — uma única fonte de verdade.

### 1.3. Painel super admin com visões separadas (`AdminSuperAdmin.tsx` + `SuperAdminCharts.tsx`)
- Três abas: **Geral / Funil de Consultores / Funil de Associados**.
- `loadMetrics(orgId, funnel?)` filtra `consultores` (via `contains allowed_funnels`), `leads`, `convertidos`, `quentes` por funil.
- `SuperAdminCharts` aceita prop `funnel?` e filtra os 3 gráficos (leads/dia, top consultores, distribuição de temperatura) por funil.
- Aba "Geral" mantém visão consolidada (sem filtro), preservando o comportamento legado.

### 1.4. Migration de funis do super admin
- `topbrasil@gmail.com` recebeu `allowed_funnels = {consultor, associado}`. Toggle aparece e funciona.

### 1.5. Edge function `ranking-get` + hook `useRankingData`
- Já retornam `groupedTotals` por funil. Funcional para o painel super admin consumir agregação por funil.

---

## 2. O que ficou pela metade (interrompido pelo token)

A fase 6 do plano (Tráfego Meta Ads) **não foi tocada**. Os arquivos seguem exatamente como antes da intervenção:

| Item | Arquivo | Estado |
|---|---|---|
| Filtro `organization_id` em ad_accounts | `src/hooks/useAdAccounts.ts` | ❌ não filtra (`select('*')` sem `.eq('organization_id', ...)`) |
| Filtro `organization_id` em ad_metrics | `src/hooks/useTrafficMetrics.ts` | ❌ não filtra |
| Sync history 90 dias | `supabase/functions/sync-history/index.ts` | ❌ ainda em `last_30d` |
| Backfill 90d + incremental por org | `supabase/functions/sync-all-accounts/index.ts` | ⚠️ já faz `last_90d` no primeiro sync e `last_3d` depois, mas não filtra por organização da requisição (sincroniza TODAS as monitoradas globalmente em qualquer chamada) |
| Paginação Meta API | `supabase/functions/list-meta-ad-accounts/index.ts` | ❌ pega só a 1ª página (`limit=100`, sem seguir `paging.next`) |

---

## 3. Origem dos problemas de tráfego — pré-existentes vs. introduzidos

Confirmado por leitura dos arquivos atuais e do histórico do projeto:

| Problema | Pré-existente? | Justificativa |
|---|---|---|
| `useAdAccounts` sem filtro `organization_id` | **Pré-existente** | A própria assinatura recebe `organizationId` apenas para `enabled`, nunca foi usado no `select`. Padrão antigo do módulo. |
| `useTrafficMetrics` sem filtro `organization_id` | **Pré-existente** | Mesmo padrão — o módulo de tráfego confiava em `is_super_admin()` na RLS para filtrar globalmente, sem isolar por org. |
| `sync-history` em `last_30d` | **Pré-existente** | Função criada com 30 dias como default; nunca foi alterada para 90. |
| `list-meta-ad-accounts` sem paginação | **Pré-existente** | Implementação mínima com `limit=100`; nunca implementou follow do `paging.next`. |
| `sync-all-accounts` ignorando organização da requisição | **Pré-existente** | Função sempre operou globalmente sobre `is_monitored=true`. |

**Nenhum desses problemas foi introduzido pelas fases A/B/C/D.** As fases A–D mexeram em criptografia, edição de funis, toggle de funnel e visualização do super admin — não tocaram em `ad_accounts`, `ad_metrics`, `sync-*`, `list-meta-ad-accounts`, `useAdAccounts` ou `useTrafficMetrics`. Validei abrindo cada um dos 5 arquivos de tráfego: o conteúdo é o original.

---

## 4. O que falta executar (fase 6 do plano original)

Mantém escopo aditivo, sem quebrar rota, slug ou funcionalidade:

1. **`useAdAccounts.ts`** — adicionar `.eq('organization_id', organizationId)` no `select` e em `toggleMonitoring` (verificar dono antes de update).
2. **`useTrafficMetrics.ts`** — adicionar `.eq('organization_id', organizationId)` no `select`.
3. **`sync-history/index.ts`** — trocar `last_30d` por `last_90d`; aceitar `organization_id` no body para filtrar contas; remover linhas duplicadas de organization_id ao listar.
4. **`sync-all-accounts/index.ts`** — aceitar `organization_id` no body (opcional); quando presente, filtrar `eq("organization_id", org)` antes de iterar; manter comportamento global quando ausente (compat).
5. **`list-meta-ad-accounts/index.ts`** — implementar loop de paginação seguindo `data.paging.next` até esgotar.
6. **`AdminTraffic.tsx`** — passar `organization_id` no `invoke('sync-all-accounts')` automático e no `syncHistory` para isolar por org.

Sem mudanças de schema, sem mudanças de rota, sem migrations adicionais. Apenas 6 arquivos editados.

---

## 5. Garantias

- Nenhuma rota é alterada.
- Nenhum slug é alterado.
- Nenhuma chave/segredo é modificada.
- Compatibilidade preservada: `sync-all-accounts` e `sync-history` continuam funcionando sem `organization_id` no body (modo global legado preservado para o cron, se houver).
- Sem alteração em `fetch-meta-ads-data`, `validate-meta-token`, `sync-ad-accounts` ou nas tabelas `ad_accounts`/`ad_metrics`.
- Nenhum dado é apagado ou regravado.

Posso executar a fase 6 quando você aprovar.

