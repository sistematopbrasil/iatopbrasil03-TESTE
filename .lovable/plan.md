

## Melhorias: Números Completos, Pré-carregamento, Responsividade Mobile e Retenção de Dados

### 1. Números Completos (sem abreviações K/M)

Atualmente, funções `formatNumber` em dois locais usam abreviações como "1.1K", "51.9K". Todas serão alteradas para mostrar o número completo com separador de milhar (ex: 1.100, 51.900).

**Arquivos afetados:**

| Arquivo | O que muda |
|---|---|
| `src/lib/instagram-utils.ts` | `formatNumber()` removera abreviações K/M, usara `toLocaleString("pt-BR")` sempre |
| `src/components/traffic/TrafficMetricCards.tsx` | `formatNumber()` local removera K/M, usara `toLocaleString("pt-BR")` |
| `src/components/traffic/TrafficAccountsTable.tsx` | `formatNumber()` local removera K/M, usara `toLocaleString("pt-BR")` |

Isso afeta automaticamente todos os componentes Instagram (Dashboard, ProfileCard, Analytics, ProfileDetail, AddProfileModal) e Traffic (MetricCards, AccountsTable) pois todos importam essas funções.

Os eixos Y dos gráficos (TrafficEvolutionChart e TrafficSpendChart) manterão abreviações K/M pois no eixo do gráfico números completos ficariam ilegíveis.

---

### 2. Pré-carregamento de Todas as Páginas

O hook `usePrefetchAdminData` já existe e pré-carrega Ranking, Settings, Pipeline, Analytics e CRM. Faltam: **Instagram** e **Tráfego**.

**Arquivo:** `src/hooks/usePrefetchAdminData.ts`

Adições:
- **Prefetch Instagram**: perfis (`insta_profiles`) e métricas (`insta_follower_metrics`)
- **Prefetch Tráfego**: contas de anúncios (`ad_accounts`) e métricas (`ad_metrics` dos últimos 7 dias como default)
- **Prefetch Traffic Settings**: `traffic_settings` para `aiEnabled`

---

### 3. Responsividade Mobile Completa

Revisão de todos os componentes para garantir que funcionem perfeitamente em telas de 320px a 414px.

**Arquivos a revisar e ajustar:**

| Arquivo | Ajuste |
|---|---|
| `src/components/traffic/TrafficDashboard.tsx` | Filter bar empilhado vertical no mobile, botões com `w-full` |
| `src/components/traffic/TrafficMetricCards.tsx` | Grid `grid-cols-2` no mobile com texto `text-sm` para números grandes, truncar labels |
| `src/components/traffic/TrafficEvolutionChart.tsx` | Botões de métrica em scroll horizontal no mobile, altura reduzida do gráfico |
| `src/components/traffic/TrafficSpendChart.tsx` | Mesma abordagem do EvolutionChart |
| `src/components/traffic/TrafficAccountsTable.tsx` | Manter overflow-x-auto (ja tem), garantir min-width adequado |
| `src/components/traffic/CampaignsTab.tsx` | Verificar layout mobile (ja usa tabs internas no mobile) |
| `src/components/instagram/InstagramDashboard.tsx` | Grid de cards `grid-cols-1 sm:grid-cols-2`, botões empilhados |
| `src/components/instagram/InstagramAnalytics.tsx` | Tabela responsiva |
| `src/components/instagram/InstagramProfileDetail.tsx` | Cards de métricas em `grid-cols-2` no mobile |
| `src/pages/AdminTraffic.tsx` | TabsList com scroll horizontal se necessário |

---

### 4. Retenção Acumulativa de Dados de Tráfego

O sistema atual já usa upsert com `onConflict: "ad_account_id,date"`, o que significa que dados existentes não são apagados -- apenas atualizados. O problema é que após o primeiro sync de 90 dias, os syncs subsequentes só puxam `last_3d`, nunca re-buscando dados antigos.

**Isso já funciona como o usuário quer**: os dados dos 90 dias iniciais ficam no banco permanentemente. Cada dia que passa, o sync de 3 dias adiciona 1 novo dia. Após 60 dias, haverá 150 dias de registros.

**Único ajuste necessário**: o filtro "Total" na UI precisa realmente buscar TODOS os dados sem limite de data. Verificar se `useTrafficMetrics` quando `preset === "total"` não aplica filtro de data (já parece correto no código atual).

---

### Detalhes Técnicos

**`formatNumber` unificado (Instagram):**
```typescript
export function formatNumber(num: number): string {
  return num.toLocaleString("pt-BR");
}
```

**`formatNumber` unificado (Traffic):**
```typescript
function formatNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}
```

**Prefetch Instagram adicionado ao hook:**
- Query key `["insta-profiles"]` para perfis
- Query key `["insta-metrics", "all"]` para métricas

**Prefetch Tráfego adicionado ao hook:**
- Query key para `ad_accounts` do org
- Query key para `ad_metrics` do org

**Responsividade -- padrões aplicados:**
- Botões de filtro de métrica: `overflow-x-auto flex-nowrap` no mobile
- Cards de métricas: `text-base` em vez de `text-lg` no mobile para números grandes (ex: 1.234.567)
- Gráficos: altura reduzida de 280px para 220px no mobile
- Tabelas: `overflow-x-auto` com `min-w` definido
- Tabs: `overflow-x-auto` quando muitas abas

