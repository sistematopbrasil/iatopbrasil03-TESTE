

## Plano: 4 Correções — Pipeline, Velocidade de Mensagens, Conversas Antigas e UI do CRM

---

### Problema 1: Pipeline não mostra todos os leads

**Causa raiz**: O prefetch em `usePrefetchAdminData.ts` (linha 79) agora filtra `.eq('lead_source', 'quiz')` e salva no cache com key `['pipeline-leads', userId]`. O `PipelineBoard` usa a **mesma query key** e tem `staleTime: 30s`, então consome o cache filtrado sem refazer a query.

**Correção**: Remover `.eq('lead_source', 'quiz')` da query do prefetch de pipeline leads (linha 76-93). O filtro quiz só deve existir na query de analytics, não na de pipeline. O pipeline deve mostrar TODOS os leads.

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/usePrefetchAdminData.ts` | Remover `.eq('lead_source', 'quiz')` da linha 79 (leadsQuery do pipeline) |

---

### Problema 2: Mensagens demoram para aparecer

**Causa raiz**: O polling no `useMessages.ts` roda a cada **3 segundos** (linha 56), mas busca mensagens do banco (que depende do sync/webhook inserir primeiro). O Realtime está configurado mas pode ter latência. Além disso, após enviar uma mensagem, o sistema depende do polling para confirmar.

**Correção**: Reduzir o polling para **1.5s** para o chat ativo, e após enviar uma mensagem, forçar um refresh imediato após 500ms e 1500ms.

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useMessages.ts` | Polling de 3s → 1.5s; após `sendMessage` com sucesso, agendar 2 refreshes rápidos (500ms e 1500ms) |

---

### Problema 3: Conversas antigas sendo importadas

**Causa raiz**: O `crm-sync-recent` busca todos os chats da Evolution API sem filtro de data. Para uma nova conexão, isso puxa o histórico inteiro.

**Correção**: Na função `crm-sync-recent`, ao buscar mensagens, filtrar apenas mensagens dos **últimos 7 dias** (ou desde a data de criação da instância no banco). Adicionar um parâmetro `since` no body do request que é passado pelo frontend.

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/crm-sync-recent/index.ts` | Adicionar filtro temporal: buscar `created_at` da instância no banco e ignorar mensagens anteriores a essa data |

---

### Problema 4: UI cortada — badge de mensagens e scrollbar do CRM

**Causa raiz** (visível no screenshot): O badge de unread count na conversation list está sendo cortado pelo overflow do container, e o scrollbar pode estar conflitando com o layout.

**Correção**: 
- No `ConversationList.tsx`, o badge de unread (linha 483-487) está dentro de um flex container que pode cortar. Adicionar `overflow-visible` ao container pai ou ajustar o padding.
- A `ScrollArea` (linha 342) precisa de um `overflow-visible` no viewport para que badges não sejam cortados.

| Arquivo | Mudança |
|---------|---------|
| `src/components/crm/ConversationList.tsx` | Ajustar overflow no container das conversas para não cortar badges |

---

### Resumo

| # | Problema | Arquivo | Mudança |
|---|----------|---------|---------|
| 1 | Pipeline vazio | `usePrefetchAdminData.ts` | Remover `.eq('lead_source', 'quiz')` do prefetch de pipeline |
| 2 | Mensagens lentas | `useMessages.ts` | Polling 1.5s + refresh imediato pós-envio |
| 3 | Conversas antigas | `crm-sync-recent/index.ts` | Filtrar mensagens por data da instância |
| 4 | UI cortada | `ConversationList.tsx` | Ajustar overflow para badges visíveis |

