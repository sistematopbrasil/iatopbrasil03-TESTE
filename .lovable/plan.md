

## Plano: Fix Country Selector + Ranking Loading Speed

### 1. Country Selector - Background transparente, poucos países, sem DDI manual funcional

**Problemas no screenshot:**
- Background do dropdown ainda transparente (o `bg-[#1a1a1a]` pode estar sendo sobreposto ou o container pai ainda tem `overflow-hidden`)
- Poucos países na lista (apenas 9)
- Precisa de mais países e a opção de DDI manual precisa funcionar melhor

**Fix em `CapturePage.tsx`:**
- Expandir lista de COUNTRIES para ~30 países (incluir todos da América Latina, Europa principais, Ásia principais, África principais)
- Garantir background sólido no dropdown: `bg-[#1a1a1a]` com `backdrop-blur-none` explícito para evitar herança de transparência
- Verificar se algum container pai (o campo de telefone) ainda tem `overflow-hidden` que corta o dropdown
- Melhorar a opção de DDI manual: ao não encontrar país na busca, mostrar automaticamente o campo de DDI customizado (sem precisar clicar "Outro DDI")
- Adicionar `overscroll-contain` no scroll do dropdown

### 2. Ranking - Demora para carregar

**Causa**: O prefetch em `usePrefetchAdminData` salva o cache com query key `['unified-ranking', null, periodEndStr]` onde `periodEndStr` é calculado no momento do prefetch. Mas `AdminRanking` calcula seu próprio `periodEnd` via `useMemo` com timestamp diferente. As keys não batem, então o prefetch é ignorado.

**Fix em `useRankingData.ts` + `AdminRanking.tsx` + `usePrefetchAdminData.ts`:**
- Padronizar query key: quando `period === 'all'`, usar key fixa `['unified-ranking', 'all', 'now']` (sem timestamp dinâmico)
- No `useRankingData`, quando `periodEnd` é null, usar `'now'` na queryKey (já faz isso) mas resolver o `periodEnd` real só dentro do `queryFn`
- No `usePrefetchAdminData`, salvar com a mesma key `['unified-ranking', 'all', 'now']`
- No `AdminRanking`, quando period é "all", passar `periodStart: null, periodEnd: null` (para bater com a key do prefetch)
- Aumentar `staleTime` do ranking para 30s (dados não mudam tão rápido)

### Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/pages/CapturePage.tsx` | Expandir países, fix background sólido, DDI manual automático |
| `src/pages/AdminRanking.tsx` | Passar `periodEnd: null` quando period é "all" |
| `src/hooks/useRankingData.ts` | Aumentar staleTime para 30s |
| `src/hooks/usePrefetchAdminData.ts` | Usar query key `['unified-ranking', 'all', 'now']` no prefetch |

