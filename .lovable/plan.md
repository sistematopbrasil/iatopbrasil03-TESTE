

## Plano: Fix Pipeline Flash + Fix Captura (layout e dropdown)

### 1. Pipeline - Remover tela "Nenhum quadro configurado" que aparece brevemente

**Causa**: A query `customStages` carrega depois de `currentUser`. Enquanto carrega, `stages.length === 0` mostra a tela vazia. Precisa incluir o estado de loading dos stages.

**Fix em `PipelineBoard.tsx`**:
- Extrair `isLoading` da query de `customStages` (renomear para `stagesLoading`)
- No bloco de loading (linha 245), incluir `stagesLoading` na condição: `if (isLoading || stagesLoading)`
- Assim, o spinner aparece enquanto stages carregam, e a tela "Nenhum quadro" só aparece se realmente não existem stages

### 2. Captura - Dropdown de país não abre

**Causa**: O container do telefone (linha 499) tem `overflow-hidden` no `rounded-xl`, que corta o dropdown absoluto do `CountrySelector`.

**Fix em `CapturePage.tsx`**:
- Remover `overflow-hidden` do container do telefone (linha 499)
- Mover o `CountrySelector` para fora do container flex, usando posicionamento relativo no wrapper pai (o `div.relative` já existe na linha 491)
- Ou: remover `overflow-hidden` e manter `rounded-xl` com border-radius via CSS sem clip

### 3. Captura - Layout sobreposto e cortado

**Problemas visíveis no print**:
- Step numbers (`-left-2 -top-2 w-7 h-7`) sobrepõem o texto do placeholder
- `pl-13` não é classe padrão do Tailwind (deveria ser `pl-12` ou custom)
- Campos muito colados ao step number

**Fix**:
- Mudar step numbers de `absolute -left-2 -top-2` para `absolute -left-3 -top-3` (ficam mais fora do campo)
- Corrigir padding dos inputs de `pl-13` para `pl-12`
- Garantir que ícones (`left-4`) não conflitem com o step number

### Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/components/crm/PipelineBoard.tsx` | Adicionar `stagesLoading` na condição de loading |
| `src/pages/CapturePage.tsx` | Fix overflow-hidden no phone, ajustar step numbers e paddings |

