
## Aprimoramento Completo do Módulo de Tráfego Meta Ads

### Diagnóstico dos Problemas Atuais

1. **Dados insuficientes**: `sync-all-accounts` usa `last_7d` — precisa ser `last_60d` no primeiro sync e `last_2d` nos seguintes.
2. **Sem sincronização automática**: Não há cron configurado. Precisa de atualização diária automática.
3. **Visualização individual de contas ausente**: Existe só a visão agregada. Falta uma tela de detalhe por conta.
4. **Poucos gráficos e métricas**: Só 1 gráfico de área com spend/cliques. Faltam: frequência, visitas ao perfil, custo por visita, gráficos de distribuição por conta.
5. **Visual simples**: Cards sem hierarquia, sem indicadores de variação, sem tabela de performance por conta.
6. **Filtros limitados**: Sem filtro de conta na visão geral.
7. **Sem unique constraint correto**: A tabela `ad_metrics` não tem constraint para `(ad_account_id, date)` (sem `organization_id`), pois o campo `organization_id` pode variar — isso pode causar duplicatas.

---

### O que será implementado

#### 1. Banco de Dados

**Migração SQL:**
- Adicionar coluna `date_preset_synced` e `days_synced` na tabela `ad_accounts` para controle de histórico
- Verificar/corrigir constraint unique em `ad_metrics` (garantir que `ad_account_id + date` seja único)
- Adicionar cronjob diário usando `pg_cron + pg_net` para chamar `sync-all-accounts` automaticamente às 06:00 BRT (09:00 UTC)

#### 2. Edge Functions Melhoradas

**`sync-all-accounts` (REESCRITA):**
- Primeiro sync de uma conta: busca `last_60d` (histórico inicial)
- Syncs posteriores: busca `last_2d` (otimizado, evita reprocessar tudo)
- Controla qual preset usar via `days_synced` na tabela `ad_accounts`
- Atualiza `last_synced_at` e `days_synced`

**`fetch-meta-ads-data` (APRIMORADO):**
- Adicionar suporte a `time_range` com datas específicas além de `date_preset`
- Melhorar coleta de `actions`: capturar `link_click`, `post_engagement`, `video_view` além de `profile_visit`
- Adicionar paginação para buscar todos os dados da Meta API (campo `next` no cursor)

**NOVA: `get-account-metrics`:**
- Busca métricas de uma conta específica com filtro de data
- Retorna dados agregados + diários para o detalhe da conta

#### 3. Frontend - Visão Geral Aprimorada

**`TrafficDashboard` (REESCRITO):**
- Filtros de período: Hoje, Ontem, 7d, 14d, 30d, 60d, Total (inspirado nos botões do print)
- Filtro de contas: seletor múltiplo "Todas" ou conta específica
- Cards de métricas (10 cards): Total Gasto, Impressões, Cliques, CTR Médio, Alcance Total, CPC Médio, Visitas ao Perfil, Frequência Média, Custo por Visita + Contas Monitoradas
- Indicador "Dados atualizados até: [data]"

**Gráficos (3 gráficos com abas para trocar métrica):**
1. `TrafficEvolutionChart` REESCRITO: Gráfico de área com toggle entre Gasto / Impressões / Cliques / Alcance — com gradiente laranja primário
2. `TrafficSpendByAccountChart` NOVO: Gráfico de barras com gasto por conta (barras horizontais)
3. `TrafficDistributionChart` NOVO: Comparativo de performance entre contas (CTR, CPC)

**Tabela de Performance por Conta** (`TrafficAccountsTable` NOVO):
- Inspirado no print "Performance dos Consultores"
- Colunas: Conta, Gasto, Impressões, Cliques, CTR, Alcance, Visitas, Status, Ações
- Botão "Ver detalhes" (olho) → abre detalhe da conta
- Toggle de monitoramento direto na tabela

#### 4. Detalhe Individual por Conta (NOVO)

**Componente `TrafficAccountDetail`:**
- Header com nome da conta, ID, status, moeda, última sincronização
- Cards de métricas específicas da conta no período
- Gráfico de evolução temporal da conta
- Botão "Sincronizar Conta" individual

**Integração na navegação:**
- Clicar em "Ver" na tabela → abre painel lateral (Sheet) ou muda de aba com o detalhe
- Usar `useState` para `selectedAccountId` — sem nova rota (mais simples e responsivo)

#### 5. Abas Reorganizadas no `AdminTraffic`

```
[Visão Geral] [Contas] [Configurações]
```

- "Visão Geral": Dashboard com filtros, cards, 3 gráficos + tabela de performance
- "Contas": Lista de contas + importar + toggle monitoramento + detalhe individual ao clicar
- "Configurações": Token status + toggle IA + info de sincronização automática

#### 6. Sincronização Automática via pg_cron

SQL para criar cronjob:
```sql
SELECT cron.schedule(
  'traffic-daily-sync',
  '0 9 * * *',  -- 06:00 BRT = 09:00 UTC
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/sync-all-accounts',
    headers := '{"Authorization": "Bearer ' || current_setting('app.service_key') || '", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

Alternativa mais simples e já comprovada no projeto Instagram: usar `pg_net` com `supabase_url` e `service_role_key` configurados via `app.settings` — mesmo padrão dos cronjobs do módulo Instagram já funcionando.

#### 7. Ajuste Visual Geral

- Cards com borda esquerda colorida (primário) no card de destaque (Total Gasto)
- Gradiente laranja nos gráficos principais (igual ao tema do sistema)
- Skeleton loading mais refinado nos cards
- Tabela com hover states e linhas alternadas sutis
- Badges de status coloridos: verde (ativa), amarelo (pausada), vermelho (erro)
- Responsivo: cards em 2 colunas no mobile, 5 no desktop

---

### Arquivos que serão criados/editados

**Novos arquivos:**
- `src/components/traffic/TrafficAccountDetail.tsx` — Detalhe de conta individual
- `src/components/traffic/TrafficAccountsTable.tsx` — Tabela performance por conta
- `src/components/traffic/TrafficSpendChart.tsx` — Gráfico de gasto por conta (barras)
- `src/components/traffic/TrafficPeriodFilter.tsx` — Filtro de período estilo botões (Hoje/7d/14d/30d/60d)
- `supabase/migrations/XXXXXX_traffic_cron.sql` — Cronjob diário automático

**Arquivos editados:**
- `supabase/functions/sync-all-accounts/index.ts` — Lógica de 60d na primeira sync, 2d nas seguintes
- `supabase/functions/fetch-meta-ads-data/index.ts` — Melhorar coleta de actions, adicionar paginação
- `src/hooks/useTrafficMetrics.ts` — Adicionar filtro por conta, mais agregações
- `src/hooks/useAdAccounts.ts` — Expor `syncSingleAccount`
- `src/components/traffic/TrafficDashboard.tsx` — Reescrita completa com novos filtros, gráficos e tabela
- `src/components/traffic/TrafficEvolutionChart.tsx` — Toggle de métricas, visual aprimorado
- `src/components/traffic/TrafficMetricCards.tsx` — 10 cards, indicadores, visual melhorado
- `src/components/traffic/TrafficAccounts.tsx` — Integrar detalhe individual, ligar à tabela
- `src/components/traffic/TrafficSettings.tsx` — Mostrar info do cronjob automático
- `src/pages/AdminTraffic.tsx` — Reorganizar abas, passar `selectedAccount`

---

### Detalhes Técnicos Importantes

**Por que `last_60d` no primeiro sync:**
A Meta API aceita `date_preset=last_60d` que retorna os últimos 60 dias de dados com `time_increment=1` (um registro por dia). Isso preenche o histórico inicial de uma vez.

**Controle de sync inteligente:**
- `ad_accounts.days_synced` (int): 0 = nunca sincronizado → usa `last_60d`; > 0 → usa `last_2d` (evita reprocessar 60 dias toda vez)
- A função `sync-all-accounts` verifica este campo e escolhe o preset correto automaticamente

**Filtro de contas na visão geral:**
- `useTrafficMetrics` recebe `accountId?: string` além de `organizationId` e `period`
- Se `accountId` for passado, filtra a query por `ad_account_id = accountId`
- O componente mostra seletor dropdown com "Todas as contas" + lista de contas monitoradas

**Cronjob automático:**
- Usar mesmo padrão do módulo Instagram (`pg_cron + pg_net`) já testado e funcionando no projeto
- A migração SQL adicionará o cronjob usando as funções `net.http_post` e os settings já configurados
