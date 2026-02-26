

## Plano: 4 Correções

### 1. Redirect URL relativo na página de captura
**Problema**: Quando o usuário configura `instagram.com` como URL de redirecionamento, o browser interpreta como caminho relativo (`/c/instagram.com`). Falta o prefixo `https://`.

**Fix em `src/pages/CapturePage.tsx`** (linha ~118):
- Criar uma função `ensureAbsoluteUrl(url)` que adiciona `https://` se a URL não começar com `http://` ou `https://`
- Aplicar na `href` do link de redirecionamento (linha 118)

### 2. Dashboard não atualiza leads em tempo real
**Problema**: `AdminDashboard.tsx` (linha 28) invalida `['all-leads-consultant']`, mas a query real em `ConsultantDashboard.tsx` (linha 55) usa `['all-leads-consultant', currentUser.id]`. As keys não batem.

**Fix em `src/pages/AdminDashboard.tsx`**:
- Alterar a invalidação para usar `queryKey: ['all-leads-consultant']` com `exact: false` para invalidar todas as queries que começam com esse prefixo
- Alternativa mais simples: já funciona sem `exact` por padrão no React Query v5 - o problema é que o `currentUser` pode não estar disponível quando o channel é criado. Verificar e adicionar `currentUser?.id` como dependência

### 3. Página do Agente IA lenta para carregar
**Problema**: A query `['ai-agent-config']` não é prefetchada no `usePrefetchAdminData`.

**Fix em `src/hooks/usePrefetchAdminData.ts`**:
- Adicionar prefetch da config do AI Agent: buscar `ai_agent_configs` por `user_id` e salvar no cache com key `['ai-agent-config']`

### 4. Agente IA deve vir desativado por padrão
**Problema**: O `DEFAULT_CONFIG` em `useAIConfig.ts` (linha 49) tem `auto_reply: true`.

**Fix em `src/hooks/useAIConfig.ts`**:
- Alterar `auto_reply: true` para `auto_reply: false` no `DEFAULT_CONFIG` (linha 49)

### Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/pages/CapturePage.tsx` | Adicionar `ensureAbsoluteUrl()` no href do redirect |
| `src/pages/AdminDashboard.tsx` | Corrigir query key da invalidação realtime |
| `src/hooks/usePrefetchAdminData.ts` | Adicionar prefetch do AI config |
| `src/hooks/useAIConfig.ts` | Mudar `auto_reply` default para `false` |

