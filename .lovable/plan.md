

## Plano: Fix Pixel em clique + Otimizar carregamento da landing page

### Problema 1: Meta Pixel não dispara no clique do botão

O `trackEvent('Lead')` é chamado na linha 574, mas logo em seguida (linhas 577-586) o `window.location.href` redireciona para WhatsApp/URL. O browser cancela a request do Pixel porque o redirect acontece antes dela completar.

**Solução:** Usar `navigator.sendBeacon` ou adicionar delay antes do redirect para garantir que o evento seja enviado. O `fbq` não usa sendBeacon nativamente, então a solução é aguardar ~300ms após o `trackEvent` antes de redirecionar.

### Problema 2: Página lenta (tela de loading)

A landing page mostra um spinner `Loader2` enquanto carrega. Existem 2 queries sequenciais ao banco (`get_consultant_by_slug` + `capture_page_configs`). 

**Solução:**
- Remover o spinner e mostrar a página com os defaults imediatamente (skeleton-free)
- Carregar os dados em background e atualizar a UI quando prontos (sem flash)
- Usar `Promise.all` para paralelizar as 2 queries
- Não mostrar `loading` state nenhum — a página renderiza com defaults e atualiza suavemente

### Mudanças em `src/pages/CapturePage.tsx`

1. **Mudar `loading` inicial para `false`** — renderizar imediatamente com defaults
2. **Paralelizar queries** com `Promise.all` (consultant + config em paralelo — na verdade config depende do consultant_id, mas podemos reorganizar)
3. **Adicionar delay antes do redirect** para garantir que o Pixel dispare:
   ```ts
   trackEvent('Lead', ...);
   await new Promise(r => setTimeout(r, 300));
   window.location.href = url;
   ```
4. **Remover spinner de loading** — substituir por renderização imediata

### Mudanças em `src/hooks/useMetaPixel.ts`

Nenhuma mudança necessária — o hook está correto, o problema é o timing do redirect.

### Arquivo afetado

| Arquivo | Mudança |
|---------|---------|
| `src/pages/CapturePage.tsx` | Remover loading spinner, paralelizar queries, delay antes de redirect para Pixel funcionar |

