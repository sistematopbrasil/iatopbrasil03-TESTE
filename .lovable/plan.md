

## Plano: Filtro quiz no dashboard + Envio mais rápido

### 1. Analytics só com leads do quiz
**Arquivo**: `src/components/consultant/ConsultantDashboard.tsx` (linha 61)

A query atual busca todos os leads do consultor sem filtrar por `lead_source`. Precisa adicionar `.eq('lead_source', 'quiz')` após o `.eq('consultant_id', currentUser.id)`.

### 2. Envio de mensagens mais rápido
**Arquivo**: `src/hooks/useMessages.ts` (linha 265)

Existe um `setTimeout(() => loadMessages(), 1500)` que adiciona 1.5s de delay desnecessário após envio. A mensagem já aparece via optimistic update e o polling/realtime confirma depois. Remover essa linha.

### Resumo

| Arquivo | Mudança |
|---------|---------|
| `ConsultantDashboard.tsx` | Adicionar `.eq('lead_source', 'quiz')` na query (linha 61) |
| `useMessages.ts` | Remover `setTimeout(() => loadMessages(), 1500)` (linha 265) |

