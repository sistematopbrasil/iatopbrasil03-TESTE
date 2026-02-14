

## Correções nos Cards de Perfil - Visão Geral

### Problema 1: Filtro não funciona nos cards
Na aba "Visão Geral", os cards de perfil recebem `allMetrics` (todas as métricas sem filtro) em vez de `filteredAllMetrics`. Por isso, mudar o filtro de data não altera os dados mostrados nos cards.

**Correção:** Passar as métricas filtradas para o `InstagramProfileCard` no `InstagramDashboard.tsx`.

### Problema 2: Mostrar ganho total do período (não só o último dia)
O card atualmente mostra apenas o `daily_change` do último registro. O correto é somar todos os `daily_change` das métricas filtradas para mostrar o ganho total no período selecionado.

**Correção:** O `InstagramProfileCard` receberá uma nova prop opcional `periodChange` calculada pelo componente pai, que será a soma dos `daily_change` de todas as métricas filtradas. Quando fornecida, exibe esse valor em vez do `daily_change` do último dia.

### Problema 3: Número completo de seguidores
O card usa `formatNumber()` que abrevia (ex: 1.2K). O correto é mostrar o número completo (ex: 1.234).

**Correção:** Substituir `formatNumber(followers)` por `followers.toLocaleString("pt-BR")` no `InstagramProfileCard`.

---

### Detalhes Técnicos

**`InstagramProfileCard.tsx`:**
- Adicionar prop opcional `periodChange?: number`
- Usar `periodChange` (quando fornecido) em vez de `latest?.daily_change` para exibir o ganho
- Trocar `formatNumber(followers)` por `followers.toLocaleString("pt-BR")`

**`InstagramDashboard.tsx`:**
- Trocar `allMetrics?.filter(...)` por `filteredAllMetrics.filter(...)` ao passar métricas para os cards
- Calcular e passar `periodChange` (soma dos `daily_change` filtrados) para cada card

**`InstagramProfilesList.tsx`:**
- Também passar as métricas filtradas e o `periodChange` calculado para os cards
