

## Modulo de Trafego Meta Ads - Fase 1: Estrutura + Dashboard + Contas

Este plano cobre a primeira fase: criar toda a base de dados, a pagina principal com metricas, importacao de contas Meta e sincronizacao de dados. A IA fica como toggle desativavel (estrutura pronta mas escondida quando off).

---

### Fases do Projeto Completo

- **Fase 1 (este plano):** Tabelas, edge functions de sync, pagina de dashboard com metricas, gerenciamento de contas Meta, toggle de IA
- **Fase 2 (futuro):** Gestao de campanhas (criar, pausar, editar), listagem de campanhas ativas
- **Fase 3 (futuro):** Agente IA com tool-calling, chat com streaming, analises automaticas

---

### O que sera implementado agora

#### 1. Banco de Dados - Novas Tabelas

**`ad_accounts`** - Contas de anuncio Meta monitoradas
- Campos: ad_account_id, name, status, is_monitored, meta_status, timezone, currency, page_id, page_name, instagram_user_id, instagram_username, last_synced_at, organization_id
- RLS: Apenas super admin (usando `is_super_admin()` ja existente)

**`ad_metrics`** - Metricas diarias por conta
- Campos: ad_account_id, date, impressions, clicks, spend, cpc, ctr, reach, frequency, profile_visits, cost_per_visit, organization_id
- Constraint UNIQUE(ad_account_id, date, organization_id)
- RLS: Apenas super admin

**`traffic_settings`** - Configuracoes do modulo (toggle de IA, etc)
- Campos: organization_id, ai_enabled (boolean, default false), meta_token_configured (boolean)
- RLS: Apenas super admin

Nota: Nao sera criada tabela `clients` nesta fase (associacao consultor-conta sera feita na Fase 2 quando consultores tiverem acesso).

#### 2. Segredos Meta API

Sera solicitado ao usuario configurar 3 segredos:
- `META_ACCESS_TOKEN`
- `META_APP_ID`
- `META_APP_SECRET`

#### 3. Edge Functions (6 funcoes nesta fase)

**`list-meta-ad-accounts`** - Lista contas disponiveis no token Meta
- Chama Meta Graph API /me/adaccounts
- Retorna lista de contas com nome, status, timezone, currency

**`sync-ad-accounts`** - Importa contas do Meta para a tabela ad_accounts
- Recebe lista de ad_account_ids selecionados
- Insere/atualiza na tabela ad_accounts
- Busca page_id e instagram conectados

**`validate-meta-token`** - Valida se o token Meta esta ativo
- Chama /me endpoint da Meta API
- Retorna status do token

**`fetch-meta-ads-data`** - Busca metricas diarias de UMA conta
- Chama Meta API /act_{id}/insights com breakdowns por dia
- Campos: impressions, clicks, spend, reach, frequency, actions (profile_visits)
- Salva na tabela ad_metrics

**`sync-all-accounts`** - Sincroniza TODAS as contas monitoradas
- Busca ad_accounts com is_monitored=true
- Chama fetch-meta-ads-data para cada uma em sequencia
- Atualiza last_synced_at

**`sync-history`** - Sincroniza historico de 30 dias
- Mesmo que fetch-meta-ads-data mas com date_preset=last_30d

#### 4. Navegacao

Adicionar item "Trafego" no menu do Super Admin (icone `Megaphone` do lucide) apos "Instagram":
- Rota: `/admin/traffic`

#### 5. Pagina Principal - AdminTraffic

Uma pagina unica com abas (Tabs):

**Aba "Visao Geral":**
- Cards de metricas agregadas: Total Gasto, Impressoes, Cliques, CTR Medio, Alcance, CPC Medio
- Filtro por periodo (reutilizar DatePeriodFilter do Instagram)
- Grafico de evolucao temporal (spend, impressions, clicks por dia) usando Recharts
- Indicador de ultima sincronizacao
- Botao "Sincronizar Agora"

**Aba "Contas":**
- Lista de contas monitoradas com metricas resumidas
- Botao "Importar Contas" que chama list-meta-ad-accounts e mostra dialog para selecionar
- Toggle de monitoramento por conta
- Status de cada conta (ativa, pausada, erro)

**Aba "Configuracoes":**
- Status do token Meta (validado/invalido)
- Toggle de IA (ativado/desativado) - quando desativado, esconde qualquer referencia a IA
- Info sobre sincronizacao automatica

#### 6. Toggle de IA

- Armazenado na tabela `traffic_settings` como `ai_enabled`
- Quando `false`: nao mostra abas de IA, chat, analises, nem botoes relacionados
- Quando `true`: mostra aba "Assistente IA" (implementacao na Fase 3)
- Default: `false` (desativado)

---

### Detalhes Tecnicos

**Novos arquivos:**
- `src/pages/AdminTraffic.tsx` - Pagina principal com abas
- `src/components/traffic/TrafficDashboard.tsx` - Aba Visao Geral
- `src/components/traffic/TrafficAccounts.tsx` - Aba Contas
- `src/components/traffic/TrafficSettings.tsx` - Aba Configuracoes
- `src/components/traffic/TrafficMetricCards.tsx` - Cards de metricas
- `src/components/traffic/TrafficEvolutionChart.tsx` - Grafico temporal
- `src/components/traffic/ImportAccountsDialog.tsx` - Dialog de importacao
- `src/hooks/useTrafficMetrics.ts` - Hook para buscar metricas agregadas
- `src/hooks/useAdAccounts.ts` - Hook para gerenciar contas
- `supabase/functions/list-meta-ad-accounts/index.ts`
- `supabase/functions/sync-ad-accounts/index.ts`
- `supabase/functions/validate-meta-token/index.ts`
- `supabase/functions/fetch-meta-ads-data/index.ts`
- `supabase/functions/sync-all-accounts/index.ts`
- `supabase/functions/sync-history/index.ts`

**Arquivos editados:**
- `src/App.tsx` - Adicionar rota /admin/traffic
- `src/components/admin/AdminLayout.tsx` - Adicionar item "Trafego" no menu super admin
- `src/components/RoleBasedRedirect.tsx` - Adicionar /admin/traffic como rota de super admin
- `supabase/config.toml` - Adicionar 6 novas functions com verify_jwt = false

**Padroes seguidos:**
- Mesmo layout AdminLayout do resto do sistema
- DatePeriodFilter reutilizado do modulo Instagram
- Recharts para graficos (mesmo do projeto)
- React Query para cache e data fetching
- RLS com `is_super_admin()` ja existente
- Edge functions com CORS headers padrao
- Todas as datas em timezone America/Sao_Paulo

