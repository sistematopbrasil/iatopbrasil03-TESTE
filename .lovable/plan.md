

## Plano: Fix Country Selector Background + OK Button

### Problemas identificados

1. **Fundo transparente nos itens**: Cada botão de país tem `style={{ backgroundColor: 'transparent' }}` nos itens não selecionados, o que em certas situações pode causar transparência visual. Solução: remover o `style` inline dos botões e usar apenas classes CSS com cores sólidas.

2. **Botão OK cortado**: O container do dropdown tem `overflow-hidden` na classe, que corta o botão OK na área inferior. Remover `overflow-hidden` do container principal e manter apenas no scroll da lista.

### Mudanças em `src/pages/CapturePage.tsx`

**Container do dropdown (linha 266)**:
- Remover `overflow-hidden` da classe do container principal

**Botões de país (linhas 289-302)**:
- Remover o `style={{ backgroundColor: ... }}` inline
- Usar classes com cores sólidas: `bg-[#1a1a1a]` para normal, `bg-[#252525]` para selecionado, `hover:bg-[#222222]` para hover

**Botão OK (linhas 322-329)**:
- Adicionar `shrink-0` e `min-w-[44px]` para garantir que não seja comprimido/cortado

