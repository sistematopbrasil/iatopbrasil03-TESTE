

## Plano: Corrigir conversas importadas em conta nova + Analytics filtrando apenas quiz

### Problema 1: Conta nova puxa conversas antigas do WhatsApp

**Causa raiz**: Quando o WhatsApp é conectado pela primeira vez em uma conta nova, o `useConversations` dispara auto-sync a cada 15 segundos (via `crm-sync-recent`). A edge function busca **todos os chats** da Evolution API (que retém os chats do número, independente da conta) e cria conversas + leads para todos eles.

**Solução**: Adicionar um mecanismo para pular o auto-sync na primeira conexão de uma instância nova. Quando a instância nunca conectou antes (`last_connected_at` é nulo), o sync deve ser bloqueado até que a instância esteja conectada há pelo menos alguns segundos.

**Implementação**:
- **`WhatsAppConnectionContext.tsx`**: Ao detectar instância nova (nunca conectou), setar um flag `isFirstConnection` no contexto. Após a conexão ser estabelecida, marcar `last_connected_at` no banco.
- **`useConversations.ts`**: Receber o flag `isFirstConnection` e pular o auto-sync quando for `true`. Assim, a conta nova começa vazia.
- **`crm-sync-recent/index.ts`**: Adicionar check — se a instância tem `last_connected_at` muito recente (< 30 segundos), pular o sync para evitar importar chats antigos na primeira conexão. Isso dá tempo para o usuário ver a tela limpa.

### Problema 2: Dashboard do consultor mostra todos os leads (não só quiz)

**Causa raiz**: O `AdminAnalytics.tsx` já filtra corretamente por `lead_source = 'quiz'` (linha 96). Porém, o `ConsultantDashboard.tsx` (linha 58-62) busca **todos os leads** do consultor sem filtrar por `lead_source`. Quando o sync cria leads WhatsApp automaticamente, eles aparecem no dashboard do consultor.

O usuário provavelmente está se referindo ao dashboard do consultor como "analytics", ou está vendo os leads do WhatsApp criados pelo sync aparecendo no painel.

**Solução**: O dashboard do consultor deve separar claramente os leads ou, no mínimo, o que ele chama de "analytics" deve mostrar apenas leads do quiz. Como o dashboard mostra stats gerais (total leads, temperatura, etc.), faz sentido manter todos os leads lá, mas as **métricas do quiz** (funil, gráficos) devem ser filtradas.

**Implementação**:
- **`ConsultantDashboard.tsx`**: Não alterar a query principal (o dashboard mostra todos os leads do consultor, o que é correto para visão geral). Mas se o usuário quer que a aba de Analytics (AdminAnalytics) mostre apenas quiz, isso já está correto.
- A causa real é que o **sync está criando leads indevidos** (problema 1). Resolvendo o problema 1, o problema 2 se resolve automaticamente — a conta nova não terá leads do WhatsApp importados incorretamente.

### Resumo das mudanças

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/crm-sync-recent/index.ts` | Pular sync se instância conectou há < 60 segundos (`last_connected_at` recente) |
| `src/hooks/useConversations.ts` | Não fazer auto-sync se instância nunca conectou antes |
| `src/contexts/WhatsAppConnectionContext.tsx` | Expor flag `isNewConnection` para que o CRM saiba quando é primeira vez |

