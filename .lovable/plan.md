

## Plano: 4 Correções

### 1. Email não conta como campo válido na Captura

**Bug**: Na linha 440 de `CapturePage.tsx`, a regex usa `\\s` (double-escaped) dentro de um regex literal. Em regex literal JS, `\\s` significa literal backslash + 's', não a classe whitespace. A regex correta é `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` com single backslash.

**Arquivo**: `src/pages/CapturePage.tsx` — corrigir `isFieldValid` para usar `\s` em vez de `\\s`, e `\.` em vez de `\\.`.

### 2. Imagem hero da Captura cortada / pequena

O `sizeMap` em `HeroImage` (linhas 163-168) usa classes fixas:
- `large`: `w-60 h-60` (fixo 240px quadrado)
- `full`: `w-full h-auto max-h-64` (max 256px de altura — muito baixo)

**Mudanças**:
- `large`: Remover altura fixa, usar `w-full max-w-md h-auto` para mostrar a imagem grande sem cortar
- `full`: Remover `max-h-64`, usar `w-full h-auto` para largura total sem limitar altura
- Adicionar `object-contain` em vez de `object-cover` para evitar cortes

**Arquivo**: `src/pages/CapturePage.tsx` — ajustar `sizeMap` e classes da imagem.

### 3. Perfil do lead sem botão de fechar no mobile (CRM)

O `Sheet` no `ChatWindow.tsx` (linha 501) usa `w-full sm:w-[400px]`, cobrindo toda a tela no mobile. O `SheetPrimitive.Close` no `sheet.tsx` está com classe `hidden`. 

**Mudança**: No `ChatWindow.tsx`, adicionar um botão de fechar explícito no `SheetHeader` do perfil, ao lado do título "Perfil do Lead".

**Arquivo**: `src/components/crm/ChatWindow.tsx` — adicionar botão X ou ArrowLeft no SheetHeader.

### 4. CRM mostra "desconectado" antes do QR Code em nova conta

Em `WhatsAppConnectionContext.tsx` (linhas 327-332), quando `status === 'disconnected'` e `last_connected_at` é nulo, ele chama `connectInstance()` mas só faz isso **depois** de `setIsLoading(false)` (no finally). Nesse intervalo, o `AdminCRM` avalia `showDisconnectedOverlay` como `true` porque `isConnected=false`, `isConnecting=false`, e `isLoading=false`.

**Mudança**: Antes de chamar `connectInstance()` no caso de conta nova, setar `isConnecting=true` **antes** de `setIsLoading(false)`, para que o overlay de desconexão nunca apareça. Mover o `setIsLoading(false)` para depois do início da conexão, ou setar `isConnecting` antes.

**Arquivo**: `src/contexts/WhatsAppConnectionContext.tsx` — no bloco da linha 327-332, setar `setIsConnecting(true)` antes de `setIsLoading(false)`.

