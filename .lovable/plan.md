

## Correção de Bugs e Melhorias no Módulo de Tráfego

### Problemas Identificados

**1. Erro na sincronização (CAUSA RAIZ ENCONTRADA)**
A Meta Graph API **nao aceita** `last_2d` nem `last_60d` como valores de `date_preset`. Os valores validos sao: `today`, `yesterday`, `last_3d`, `last_7d`, `last_14d`, `last_28d`, `last_30d`, `last_90d`, `maximum`, etc.

O sistema esta usando `last_60d` no primeiro sync e `last_2d` nos syncs seguintes -- ambos invalidos, causando erro 400 da API Meta.

**2. Lista de campanhas nao rola (scroll cortado)**
O componente `CampaignsTab` usa `ScrollArea` com `max-height` que corta o conteudo. Quando a lista tem muitas campanhas (50 no caso), nao e possivel rolar. O layout precisa permitir scroll natural.

**3. CampaignCard cortado ao expandir**
O card expansivel dentro do `ScrollArea` fica cortado porque o `ScrollArea` nao recalcula a altura ao expandir. Precisa usar scroll nativo.

**4. Consultor nao aparece apos criacao**
O `CreateConsultantDialog` invalida `['all-consultants']` e `['unified-ranking']`, mas a `ConsultantsTable` usa `useRankingData` com query key `['unified-ranking', periodStart, periodEnd]`. A invalidacao precisa usar `queryKey` parcial que cubra todas as variantes.

**5. Tooltip do grafico "Performance por Conta" ilegivel**
O tooltip mostra duas linhas: o valor formatado + o `fullName` da conta. O formato esta confuso -- o `formatter` retorna `[valor, nome]` mas o Recharts renderiza isso de forma pouco clara. Precisa de um `CustomTooltip`.

---

### Solucoes Propostas

#### 1. Corrigir date_preset na sincronizacao

**Arquivos:** `sync-all-accounts/index.ts`, `fetch-meta-ads-data/index.ts`

- Primeiro sync: usar `last_90d` (valor valido mais longo, 90 dias de historico)
- Syncs seguintes: usar `last_3d` (valor minimo valido para manter atualizado)
- Corrigir tambem o `syncSingleAccount` em `useAdAccounts.ts` que usa `last_2d` -> trocar para `last_3d`

#### 2. Corrigir scroll da lista de campanhas

**Arquivo:** `CampaignsTab.tsx`

- Remover `ScrollArea` com `max-height` fixo
- Usar `overflow-y-auto` nativo com `max-h-[calc(100vh-280px)]` no container da lista
- Garantir que o `CollapsibleContent` do `CampaignCard` funcione dentro do scroll

#### 3. Consultor aparecer imediatamente

**Arquivo:** `CreateConsultantDialog.tsx`

- A invalidacao `queryKey: ['unified-ranking']` sem os parametros `periodStart` e `periodEnd` ja deveria funcionar como partial match no TanStack Query.
- Problema: a query key e `['unified-ranking', 'all', 'now']` e a invalidacao `['unified-ranking']` deveria casar parcialmente. Vou adicionar tambem `queryClient.invalidateQueries({ queryKey: ['super-admin-metrics'] })` e garantir `refetchType: 'all'`.

#### 4. Tooltip legivel no grafico Performance por Conta

**Arquivo:** `TrafficSpendChart.tsx`

- Substituir o `formatter` do Tooltip por um componente `CustomTooltip` completo
- Mostrar: nome da conta em destaque + valor formatado da metrica selecionada
- Usar cores de fundo e texto compativeis com o tema escuro

#### 5. Verificar tooltips em outros graficos

**Arquivo:** `TrafficEvolutionChart.tsx`

- Tooltip ja usa `formatter` simples que funciona bem, mas vou garantir que o `labelFormatter` mostre a data corretamente

---

### Detalhes Tecnicos

**Valores validos de `date_preset` da Meta API:**
```text
today, yesterday, this_month, last_month, this_quarter, maximum, 
data_maximum, last_3d, last_7d, last_14d, last_28d, last_30d, 
last_90d, last_week_mon_sun, last_week_sun_sat, last_quarter, 
last_year, this_week_mon_today, this_week_sun_today, this_year
```

**Mudancas no Smart Sync:**
- `days_synced === 0` (primeiro sync) -> `last_90d` (maximo pratico com dados diarios)
- `days_synced > 0` (syncs seguintes) -> `last_3d` (garante cobertura de 2-3 dias com overlap)

**Arquivos que serao editados:**
| Arquivo | Mudanca |
|---|---|
| `supabase/functions/sync-all-accounts/index.ts` | `last_60d` -> `last_90d`, `last_2d` -> `last_3d` |
| `supabase/functions/fetch-meta-ads-data/index.ts` | Fallback de `last_2d` -> `last_3d` |
| `src/hooks/useAdAccounts.ts` | `syncSingleAccount` usar `last_3d` em vez de `last_2d` |
| `src/components/traffic/CampaignsTab.tsx` | Corrigir scroll da lista de campanhas |
| `src/components/traffic/TrafficSpendChart.tsx` | Custom tooltip legivel |
| `src/components/super-admin/CreateConsultantDialog.tsx` | Melhorar invalidacao de cache |

