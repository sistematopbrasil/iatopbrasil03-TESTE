

## Plano de Correção: Dados de Tráfego, Logo, PWA e Filtros de Campanhas

### 1. Causa raiz dos dados de tráfego não atualizarem

A tabela `ad_metrics` ainda **não tem** as colunas `link_clicks`, `post_engagement` e `video_views`. A edge function `fetch-meta-ads-data` tenta gravar nessas colunas inexistentes, fazendo com que **todos os upserts falhem silenciosamente**. Os 27 registros existentes (apenas 7 dias, do dia 13 ao 19/fev) são de antes dessas colunas serem adicionadas ao código.

Apesar do `days_synced` estar em 93 (o que significa que o sync "achou" que funcionou), nenhum dado novo foi realmente salvo.

### Solução

**1.1 Migração de banco de dados**

Adicionar 2 novas colunas úteis (substituindo as 3 originais por métricas mais relevantes):
- `post_engagement` (engajamento total com publicações -- curtidas, comentários, compartilhamentos)
- `conversions` (resultados/conversões das campanhas)

Resetar `days_synced = 0` para forçar re-sync completo de 90 dias.

```sql
ALTER TABLE public.ad_metrics ADD COLUMN IF NOT EXISTS post_engagement bigint DEFAULT 0;
ALTER TABLE public.ad_metrics ADD COLUMN IF NOT EXISTS conversions bigint DEFAULT 0;
UPDATE public.ad_accounts SET days_synced = 0;
```

**1.2 Atualizar `fetch-meta-ads-data`**

- Remover gravação de `link_clicks` e `video_views`
- Substituir por `post_engagement` e `conversions` (extraídos do campo `actions` da API Meta)
- A coluna `clicks` já cobre cliques totais (inclui cliques no link)

**1.3 Corrigir `sync-all-accounts`**

- Só atualizar `days_synced` se o sync realmente retornou `synced > 0`

---

### 2. Logo desaparecendo ao trocar de página

O problema é que o componente `AdminLayout` usa `resolvedTheme` do `next-themes` para escolher entre logo claro/escuro. Quando a página muda, o hook `useTheme` momentaneamente retorna `undefined` para `resolvedTheme`, causando um "flash" onde a logo some.

**Solução**: Usar fallback para `resolvedTheme` e adicionar eager loading na tag `<img>` para evitar re-download.

---

### 3. Remover notificações/pop-ups de instalação PWA

Dois componentes exibem banners de instalação:
- `InstallAdminPWA` (dentro do `AdminLayout`)
- `InstallPWA` (componente separado)

**Solução**: Remover a renderização de `InstallAdminPWA` do `AdminLayout`. O componente `InstallPWA` não é importado em nenhum lugar ativo, mas será limpo também.

---

### 4. Filtros na aba de Campanhas

Adicionar barra de filtros com:
- **Ordenar por**: Data de criação (mais recente/mais antiga), Orçamento (maior/menor)
- **Filtrar por status**: Mostrar apenas campanhas ativas

Será adicionado no componente `CampaignsTab`.

---

### 5. Atualizar TrafficMetricCards e hooks

- Remover métricas `linkClicks` e `videoViews` dos cards
- Adicionar `postEngagement` (Engajamento) e `conversions` (Conversões)
- Atualizar `useTrafficMetrics` para calcular as novas métricas
- Atualizar `TrafficEvolutionChart` para remover `link_clicks` das opções de gráfico

---

### Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| Migração SQL | Adicionar colunas `post_engagement` e `conversions`, resetar `days_synced` |
| `supabase/functions/fetch-meta-ads-data/index.ts` | Trocar `link_clicks`/`video_views` por `post_engagement`/`conversions` |
| `supabase/functions/sync-all-accounts/index.ts` | Validar resultado antes de atualizar `days_synced` |
| `src/hooks/useTrafficMetrics.ts` | Trocar métricas por `postEngagement`/`conversions` |
| `src/components/traffic/TrafficMetricCards.tsx` | Trocar cards de linkClicks/videoViews por engajamento/conversões |
| `src/components/traffic/TrafficEvolutionChart.tsx` | Remover `link_clicks` das opções do gráfico |
| `src/components/traffic/TrafficDashboard.tsx` | Atualizar props passadas para MetricCards |
| `src/components/traffic/CampaignsTab.tsx` | Adicionar filtros de ordenação e status |
| `src/components/admin/AdminLayout.tsx` | Remover `InstallAdminPWA`, corrigir flash da logo |

