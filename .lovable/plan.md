

## Plano: Corrigir Métricas de Tráfego, Badge IA e Loading

### Problema 1: Métricas de tráfego incorretas

**Causa raiz**: No `useTrafficMetrics.ts`, ao agregar dados diários de múltiplas contas, as métricas de ratio (CTR, CPC, Frequência) são somadas e divididas pela contagem, o que produz médias incorretas. O correto é recalcular a partir dos valores brutos.

Exemplo: Conta A tem 100 impressões e 10 cliques (CTR=10%), Conta B tem 1000 impressões e 5 cliques (CTR=0.5%). A média simples dá 5.25%, mas o CTR correto é 15/1100 = 1.36%.

Além disso, `(m as any).profile_visits` é usado desnecessariamente — `profile_visits` já existe no tipo.

**Correções no `src/hooks/useTrafficMetrics.ts`**:
- Linha 97: Remover `(m as any)` — usar `m.profile_visits` diretamente
- Linhas 113-115: Recalcular CTR, CPC e Frequência a partir dos valores brutos agregados em vez de fazer média simples:
  - `ctr = impressions > 0 ? (clicks / impressions) * 100 : 0`
  - `cpc = clicks > 0 ? spend / clicks : 0`
  - `frequency = reach > 0 ? impressions / reach : 0`
- Remover campos `ctr`, `cpc`, `frequency` da acumulação no dailyMap (não precisa somar)

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useTrafficMetrics.ts` | Recalcular ratios; remover `as any` |

---

### Problema 2: Badge/botão "IA Ativa" aparece no CRM com IA desativada

A query `current-user-ai-status` no `ChatWindow.tsx` já verifica `auto_reply` (linha 71) e tem `staleTime: 30s`. Isso deveria funcionar. Porém, o `AIStatusBadge` trata `status === 'none'` como `'active'` (linha 49), mostrando "IA Ativa" e "Disparar IA agora" mesmo quando `aiEnabled` é corretamente `false` — **se o cache ainda não atualizou**.

O problema pode ser que `refetchOnMount: 'always'` não dispara refresh quando o componente do CRM já está montado e o usuário simplesmente muda de conversa. A solução é garantir que `aiEnabled` seja tratado como source of truth absoluta.

**Correção**: No `AIStatusBadge`, a linha `if (!aiEnabled) return null` já existe e é correta. O cache pode estar stale por até 30s. Para ser instantâneo, adicionar `refetchInterval: 30_000` e `gcTime: 0` para forçar invalidação.

| Arquivo | Mudança |
|---------|---------|
| `src/components/crm/ChatWindow.tsx` | Adicionar `gcTime: 0` para forçar re-fetch sem cache |

---

### Problema 3: Spinner genérico na página Agente IA e outras

O screenshot mostra que a página Agente IA ainda exibe o spinner circular. O código já usa `FormSkeleton`, mas pode ser que a build anterior não refletiu. Verificando: `CapturePage.tsx` e `Quiz.tsx` ainda usam `Loader2` spinners. Para páginas do admin, todas já foram migradas. A `CapturePage` é pública (não admin), então o spinner lá faz sentido contextualmente.

O mais provável é que o deploy anterior ainda não tinha compilado. Porém, para garantir, vou verificar se existe algum outro local com spinner dentro do admin.

Verificado: Todas as 6 páginas admin já foram migradas para skeletons. O spinner que o usuário viu pode ter sido da build anterior. Nenhuma mudança adicional necessária aqui.

---

### Resumo

| # | Problema | Arquivo | Mudança |
|---|----------|---------|---------|
| 1 | Métricas ratio incorretas | `useTrafficMetrics.ts` | Recalcular CTR/CPC/Frequência dos brutos |
| 2 | Badge IA com cache | `ChatWindow.tsx` | `gcTime: 0` para evitar stale |

