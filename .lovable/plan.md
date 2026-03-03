

## Plano: Mensagens mais rápidas + Analytics só com leads do quiz

### 1. Envio de mensagens mais rápido

**Causa**: O `useMessages.ts` tem dois problemas de latência:
- Polling de segurança roda a cada **3000ms** (linha 48), o que é muito frequente e consome recursos, mas o `startPolling` é chamado com `5000` que nunca é usado porque o `setInterval` interno usa `3000`.
- Após enviar com sucesso, há um `setTimeout(() => loadMessages(), 1500)` — atraso desnecessário de 1.5s.

**Mudanças no `src/hooks/useMessages.ts`**:
- Remover o `setTimeout` de 1500ms após envio bem-sucedido — a mensagem já aparece via optimistic update e o realtime/polling vai confirmar.
- O `isSending` já é setado `false` no finally, então a UI já responde rápido. O principal é remover esse delay desnecessário.

### 2. Analytics mostrando apenas leads do quiz

**Causa**: O `AdminAnalytics.tsx` já filtra `lead_source = 'quiz'` (linha 96) — está correto. Porém, o `ConsultantDashboard.tsx` (linhas 58-62) busca **todos os leads** sem filtro de `lead_source`. O usuário provavelmente está vendo o dashboard do consultor e chamando de "analytics".

**Mudança no `src/components/consultant/ConsultantDashboard.tsx`**:
- Adicionar `.eq('lead_source', 'quiz')` na query de leads (linha 61), para que o dashboard do consultor mostre apenas leads do quiz, consistente com o AdminAnalytics.

### Resumo

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useMessages.ts` | Remover `setTimeout` de 1500ms após envio |
| `src/components/consultant/ConsultantDashboard.tsx` | Adicionar filtro `lead_source = 'quiz'` na query |

