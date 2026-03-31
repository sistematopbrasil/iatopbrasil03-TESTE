

## Plano: Corrigir evento duplicado do Meta Pixel

### Causa raiz
`fbq('init', pixelId)` é chamado dentro de um `useEffect` que pode executar múltiplas vezes (re-renders do React). Cada `init` registra uma instância do pixel, e quando `trackEvent` dispara, o evento é enviado para **todas** as instâncias — duplicando.

### Solução
Manter um **Set global** de pixel IDs já inicializados, e só chamar `fbq('init')` se o pixel ainda não foi inicializado.

### Mudança

| Arquivo | Ação |
|---------|------|
| `src/hooks/useMetaPixel.ts` | Adicionar `Set` global para rastrear pixels já inicializados; pular `init` se já existe |

### Código resumido
```ts
const initializedPixels = new Set<string>();

// Dentro do useEffect:
if (!initializedPixels.has(pixelId)) {
  initializedPixels.add(pixelId);
  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');
}
```

Isso garante que cada pixel é inicializado **uma única vez**, independente de quantas vezes o componente re-renderiza.

