

## Plano: Fix Pipeline Flash + Country Selector

### 1. Pipeline - Flash "Nenhum quadro configurado"

**Causa real**: A query `currentUser` não rastreia `isLoading`. Quando `currentUser` está carregando, as queries de stages e leads estão **desabilitadas** (`enabled: false`), então `stagesLoading` e `isLoading` são `false`. O código cai direto no `stages.length === 0`.

**Fix em `PipelineBoard.tsx`**:
- Extrair `isLoading: userLoading` da query `current-user-pipeline` (linha 57)
- Na condição de loading (linha 245): `if (userLoading || isLoading || stagesLoading)`

### 2. Country Selector - Dropdown transparente e sem scroll

**Problemas**:
- O dropdown tem `bg-[#1a1a1a]` mas pode estar cortado pelo container pai
- Não tem `max-height` nem `overflow-y: auto` para scroll quando há muitos países
- Não tem campo de busca nem opção de digitar DDI manual

**Fix em `CapturePage.tsx` (CountrySelector, linhas 193-225)**:
- Adicionar `max-h-[300px] overflow-y-auto` no dropdown para permitir scroll
- Adicionar campo de busca no topo do dropdown (input text para filtrar por nome ou DDI)
- Adicionar opção "Outro" no final da lista que permite digitar DDI manualmente
- Garantir `z-50` e `bg-[#1a1a1a]` sólido (já está, mas verificar se não é sobrescrito)

### Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/components/crm/PipelineBoard.tsx` | Adicionar `userLoading` na condição de loading |
| `src/pages/CapturePage.tsx` | Scroll no dropdown, campo de busca, opção DDI manual |

