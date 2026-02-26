

## Plano: Fix Country Selector com Portal

### Problema raiz

O dropdown do seletor de países é renderizado **dentro** do form card que tem `backdrop-blur-2xl` e `bg-white/[0.04]`. Mesmo com `backgroundColor: '#1a1a1a'` inline no dropdown, o `backdrop-filter` do pai afeta todos os filhos, causando a transparência visível no screenshot. O botão OK também fica cortado porque o dropdown abre para baixo e colide com o botão "Quero saber mais!".

### Solução: React Portal

Renderizar o dropdown usando `ReactDOM.createPortal` no `document.body`, posicionando-o absolutamente com base nas coordenadas do botão trigger. Isso remove o dropdown da hierarquia do form card, eliminando a herança de `backdrop-filter`.

### Mudanças em `src/pages/CapturePage.tsx`

1. **Importar** `createPortal` de `react-dom`
2. **No `CountrySelector`**: usar `getBoundingClientRect()` do botão ref para calcular a posição do dropdown
3. **Renderizar o dropdown via portal** no `document.body` com `position: fixed`, usando as coordenadas calculadas
4. **Abrir para cima** se estiver perto do fundo da tela (verificar espaço disponível abaixo)
5. **Manter** todo o estilo sólido existente (`#1a1a1a`, `#252525`, etc.)

