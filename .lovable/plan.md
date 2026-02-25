

## Plano: Botoes do Agente IA no mobile + Scroll horizontal do Pipeline no desktop

### Problema 1: Botoes cortados no Agente IA (mobile)

No print, os botoes "Testar Configuracao" e "Salvar Configuracoes" ficam lado a lado (`flex justify-end gap-3`) e nao cabem na tela pequena. O botao "Testar" fica cortado pela esquerda.

**Correcao em `AdminAIConfig.tsx` (linhas 613-636)**:
- Trocar `flex justify-end gap-3` para `flex flex-col-reverse sm:flex-row justify-end gap-3` -- no mobile os botoes empilham verticalmente (salvar em cima, testar embaixo)
- Adicionar `w-full sm:w-auto` em cada `Button` para que ocupem 100% no mobile

---

### Problema 2: Pipeline nao arrasta no desktop

No desktop, o `.pipeline-scroll` tem `overflow-x: auto` com scrollbar estilizada, mas nao ha como arrastar com o mouse (scroll horizontal so funciona com trackpad/shift+wheel). No mobile funciona porque o touch faz scroll nativo.

**Correcao**: Adicionar scroll por mouse drag no desktop via CSS `cursor: grab` + um pequeno script JS inline. A abordagem mais simples e sem risco para o mobile: adicionar um hook `useHorizontalDragScroll` que escuta `mousedown/mousemove/mouseup` no container `.pipeline-scroll` APENAS em dispositivos com pointer fino (desktop).

**Novo hook `src/hooks/useHorizontalDragScroll.ts`**:
- Usa `useRef` + `useEffect`
- No `mousedown`: registra posicao inicial e `scrollLeft`, seta `isDown = true`
- No `mousemove`: calcula delta e faz `el.scrollLeft = startScrollLeft - deltaX`
- No `mouseup`/`mouseleave`: seta `isDown = false`
- Usa `pointer-events` media query ou simplesmente verifica `e.pointerType === 'mouse'` para nao interferir no touch

**Aplicacao em `AdminPipeline.tsx`**:
- Importar o hook e passar a ref do container `.pipeline-scroll`
- Adicionar `cursor-grab active:cursor-grabbing` no className do container (apenas visual, sem impacto funcional)

---

### Resumo de arquivos

| Arquivo | Mudanca |
|---|---|
| `AdminAIConfig.tsx` | Botoes empilhados no mobile (`flex-col-reverse sm:flex-row`, `w-full sm:w-auto`) |
| `src/hooks/useHorizontalDragScroll.ts` | Novo hook para drag-scroll horizontal com mouse |
| `AdminPipeline.tsx` | Usar o hook no container `.pipeline-scroll` + `cursor-grab` |

