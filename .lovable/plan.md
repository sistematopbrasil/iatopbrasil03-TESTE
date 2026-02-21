

## Plano Completo: Correcoes de Trafego, Logo, PWA e Campanhas

Este plano cobre TODAS as correcoes pendentes de uma vez. Nada foi implementado ainda alem da coluna `days_synced`.

---

### 1. Migracao de banco de dados

A tabela `ad_metrics` nao tem as colunas que a edge function tenta gravar, causando falha silenciosa em todos os upserts. Alem disso, `days_synced` esta em 93 (falso), impedindo re-sync completo.

```sql
ALTER TABLE public.ad_metrics ADD COLUMN IF NOT EXISTS post_engagement bigint DEFAULT 0;
ALTER TABLE public.ad_metrics ADD COLUMN IF NOT EXISTS conversions bigint DEFAULT 0;
UPDATE public.ad_accounts SET days_synced = 0;
```

- `post_engagement`: engajamento com publicacoes (curtidas, comentarios, compartilhamentos)
- `conversions`: resultados/conversoes das campanhas
- Nao adicionar `link_clicks` nem `video_views` (usuario nao quer essas metricas)

---

### 2. Atualizar edge function `fetch-meta-ads-data`

Trocar a gravacao de `link_clicks`, `post_engagement` e `video_views` pelas novas colunas:

- `post_engagement`: extrair de `actions` com tipos `post_engagement`, `post`
- `conversions`: extrair de `actions` com tipos `offsite_conversion.fb_pixel_purchase`, `onsite_conversion.messaging_conversation_started_7d`, `lead`, `complete_registration`
- Remover `link_clicks` e `video_views` do upsert

---

### 3. Corrigir edge function `sync-all-accounts`

So atualizar `days_synced` se o fetch retornou `synced > 0`:

```text
Antes:  sempre atualiza days_synced apos cada conta
Depois: if (data.synced > 0) { atualizar days_synced }
```

---

### 4. Corrigir logo piscando no AdminLayout

- Adicionar fallback para `resolvedTheme` quando `undefined`: usar `'light'` como padrao
- Adicionar `loading="eager"` na tag `<img>` da logo para evitar re-download

---

### 5. Remover notificacoes PWA

- Remover `<InstallAdminPWA />` da linha 279 do `AdminLayout.tsx`
- Remover o import na linha 16

---

### 6. Atualizar metricas no frontend

**useTrafficMetrics.ts:**
- Remover `totalLinkClicks` e `totalVideoViews`
- Adicionar `totalPostEngagement` e `totalConversions`
- Atualizar agregacoes diarias e por conta

**TrafficMetricCards.tsx:**
- Trocar card "Cliques no Link" por "Engajamento"
- Trocar card "Views de Video" por "Conversoes"
- Atualizar props e interface

**TrafficDashboard.tsx:**
- Atualizar props passadas para `TrafficMetricCards` (trocar `totalLinkClicks`/`totalVideoViews` por novas metricas)

**TrafficEvolutionChart.tsx:**
- Remover `link_clicks` das opcoes de metrica no grafico

---

### 7. Filtros na aba de Campanhas (CampaignsTab)

Adicionar barra de filtros acima da lista:

- **Ordenar por**: Status (padrao atual), Data de criacao (recente/antiga), Orcamento (maior/menor)
- **Filtrar por status**: Checkbox ou toggle "Apenas ativas"

---

### Arquivos afetados

| Arquivo | Mudanca |
|---|---|
| Migracao SQL | Adicionar `post_engagement` + `conversions`, resetar `days_synced` |
| `supabase/functions/fetch-meta-ads-data/index.ts` | Trocar colunas gravadas |
| `supabase/functions/sync-all-accounts/index.ts` | Validar resultado antes de atualizar `days_synced` |
| `src/hooks/useTrafficMetrics.ts` | Trocar metricas |
| `src/components/traffic/TrafficMetricCards.tsx` | Trocar cards |
| `src/components/traffic/TrafficEvolutionChart.tsx` | Remover `link_clicks` do grafico |
| `src/components/traffic/TrafficDashboard.tsx` | Atualizar props |
| `src/components/traffic/CampaignsTab.tsx` | Adicionar filtros |
| `src/components/admin/AdminLayout.tsx` | Remover PWA banner + corrigir logo |
| `src/integrations/supabase/types.ts` | Atualizado automaticamente apos migracao |

