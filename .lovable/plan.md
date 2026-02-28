

## Correções Mobile no CRM

### 1. `src/components/crm/MessageItem.tsx` — Imagens e vídeos saindo do bloco
- Imagens usam `style={{ maxWidth: '300px' }}` fixo que ultrapassa o container `max-w-[70%]` em telas pequenas
- Vídeos usam `style={{ maxWidth: '400px' }}` — mesmo problema
- **Fix**: Trocar os `style` fixos por `className="max-w-full w-full"` para que respeitem o container pai. Manter `max-h` via classe.

### 2. `src/components/crm/MessageList.tsx` — Scroll horizontal indesejado
- O container de mensagens pode permitir scroll lateral quando mídia ultrapassa
- **Fix**: Adicionar `overflow-x-hidden` ao container de scroll

### 3. `src/components/ui/sheet.tsx` — Remover botão X do Sheet no mobile
- O `SheetContent` tem um `SheetPrimitive.Close` com ícone X sempre visível
- **Fix**: Esconder o botão X com `hidden` (o usuário fecha arrastando ou tocando fora)

### Arquivos a editar
- `src/components/crm/MessageItem.tsx` (linhas 43-48, 59-63)
- `src/components/crm/MessageList.tsx` (linha 89)
- `src/components/ui/sheet.tsx` (linha 63)

