

## Plano: Corrigir evento do Pixel e garantir isolamento por consultor

### Problema 1: Evento errado
- `CapturePage.tsx` dispara `trackEvent('Lead')` — deveria ser `'CompleteRegistration'`
- `QuizContainer.tsx` também dispara `trackEvent('Lead')` — mesma correção

### Problema 2: Isolamento do Pixel
O isolamento já está **quase correto**: cada página (CapturePage, QuizContainer) usa `consultant?.pixel_id` individualmente. Porém:
- `App.tsx` chama `useMetaPixel()` sem pixelId (não faz nada, mas é código morto — remover para clareza)
- `useGlobalMetaPixel` existe no hook e carrega pixel da `app_settings` — função não usada, mas pode causar conflito se chamada acidentalmente. Remover.

### Mudanças

| Arquivo | Mudança |
|---------|---------|
| `src/pages/CapturePage.tsx` | Trocar `trackEvent('Lead', ...)` → `trackEvent('CompleteRegistration', ...)` |
| `src/components/quiz/QuizContainer.tsx` | Trocar `trackEvent('Lead')` → `trackEvent('CompleteRegistration')` |
| `src/hooks/useMetaPixel.ts` | Remover `useGlobalMetaPixel` (pixel global não deve existir — cada consultor tem o seu) |
| `src/App.tsx` | Remover import e chamada de `useMetaPixel()` (não faz nada e pode confundir) |

### Resultado
- Evento `CompleteRegistration` dispara ao enviar formulário (capture e quiz)
- Pixel é inicializado **apenas** com o `pixel_id` do consultor dono da página
- Nenhum pixel global interfere

