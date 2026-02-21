

## Plano: Correcao do Sync, Logo, Frequencia e Limpeza de Metricas

### 1. CAUSA RAIZ do sync falhando (CRITICO)

Testei a edge function diretamente e confirmei: a Meta API retorna **78 registros**, mas **0 sao salvos** no banco.

O motivo: a tabela `ad_metrics` tem uma constraint UNIQUE em `(ad_account_id, date, organization_id)`, mas o codigo usa `onConflict: "ad_account_id,date"` (sem `organization_id`). Essa incompatibilidade faz TODOS os upserts falharem silenciosamente.

**Correcao**: Mudar a linha 90 de `fetch-meta-ads-data/index.ts`:
```
// De:
onConflict: "ad_account_id,date"
// Para:
onConflict: "ad_account_id,date,organization_id"
```

---

### 2. Logo sumindo ao trocar de pagina

O problema NAO e o `resolvedTheme` (o fallback ja esta la). O problema e que `DesktopSidebar` e `MobileMenuContent` sao definidos como funcoes-componente DENTRO do `AdminLayout`. Isso faz o React recriar (unmount + mount) esses componentes a cada navegacao, causando flash da imagem.

**Correcao**: Converter `DesktopSidebar` e `MobileMenuContent` de componentes internos para JSX inline direto no return do `AdminLayout`. Isso evita a recriacao e a logo permanece estavel.

---

### 3. Frequencia menor que 1

O calculo atual faz media simples dos valores de frequencia de cada registro. Se uma conta tem dias sem dados, a media fica distorcida. A correcao e calcular a frequencia como `total_impressions / total_reach` (definicao real da Meta), que sempre sera >= 1 quando ha dados.

**Correcao em `useTrafficMetrics.ts`**:
```
// De:
const avgFrequency = metrics.length > 0
  ? metrics.reduce((s, m) => s + Number(m.frequency || 0), 0) / metrics.length
  : 0;
// Para:
const avgFrequency = totalReach > 0 ? totalImpressions / totalReach : 0;
```

---

### 4. Remover metricas de Engajamento e Conversoes

O usuario pediu para remover essas duas metricas. Vou remover de:
- `TrafficMetricCards.tsx`: remover os cards "Engajamento" e "Conversoes"
- `TrafficEvolutionChart.tsx`: remover dos botoes de metrica do grafico
- `TrafficDashboard.tsx`: remover props `totalPostEngagement` e `totalConversions`
- `TrafficAccountsTable.tsx`: remover colunas da interface (simplificar)
- `useTrafficMetrics.ts`: remover os calculos (manter no banco para uso futuro)

As metricas restantes serao: Gasto, Impressoes, Cliques, CTR, Alcance, CPC, Visitas ao Perfil, Frequencia (8 cards organizados em grid responsivo).

---

### 5. Organizacao e responsividade

- Grid dos cards: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4` (8 cards ficam bem distribuidos)
- Tabela de contas: manter colunas essenciais (Conta, Gasto, Impressoes, Cliques, CTR, Status, Monitor, Acoes)
- Grafico de evolucao: remover opcoes de Engajamento e Conversoes dos botoes

---

### Arquivos afetados

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/fetch-meta-ads-data/index.ts` | Corrigir `onConflict` para incluir `organization_id` |
| `src/components/admin/AdminLayout.tsx` | Inline DesktopSidebar/MobileMenuContent (evitar re-mount) |
| `src/hooks/useTrafficMetrics.ts` | Corrigir calculo de frequencia, remover post_engagement/conversions da interface |
| `src/components/traffic/TrafficMetricCards.tsx` | Remover cards de Engajamento e Conversoes |
| `src/components/traffic/TrafficEvolutionChart.tsx` | Remover opcoes de Engajamento e Conversoes |
| `src/components/traffic/TrafficDashboard.tsx` | Remover props de Engajamento e Conversoes |
| `src/components/traffic/TrafficAccountsTable.tsx` | Remover colunas de Engajamento e Conversoes |

### Resultado esperado

Apos o deploy, ao clicar "Sincronizar", os 78+ registros serao salvos no banco com sucesso, e os dados de 90 dias aparecerao nos graficos e cards. A logo ficara fixa sem piscar, e a frequencia mostrara valores corretos (>= 1).

