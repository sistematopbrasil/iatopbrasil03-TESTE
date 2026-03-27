

## Plano: Remover botão fixo mobile da Landing Page

### Problema
Na landing page (template `landing`), há um botão CTA fixo no rodapé visível apenas no mobile (`sm:hidden`, linhas 864-874 do `CapturePage.tsx`). O usuário não gostou e quer removê-lo.

### Sobre o preview desatualizado
O preview no painel de settings pode estar usando dados do banco (`existingConfig`) ao invés do estado local do formulário (`captureForm`). Vou verificar e corrigir se necessário — mas é possível que o preview esteja correto e apenas precise de um reload/re-save para refletir as últimas mudanças.

### Mudança

#### `src/pages/CapturePage.tsx`
- **Remover** o bloco "Mobile sticky CTA" (linhas 864-874) — o `<div className="fixed bottom-0 ...">` com o `<button>` dentro dele.

| Arquivo | Mudança |
|---------|---------|
| `src/pages/CapturePage.tsx` | Remover bloco do botão fixo mobile (linhas 864-874) |

