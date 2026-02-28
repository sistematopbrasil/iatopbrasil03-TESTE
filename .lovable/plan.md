

## Diagnóstico

O problema é que `getConversations()` no `crm-service.ts` **não filtra por `instance_id`**. Quando você desconecta um número e conecta outro, uma nova instância é criada, mas as conversas antigas (vinculadas à instância anterior) continuam aparecendo porque o RLS só filtra por `user_id`.

O `ConversationList` recebe `instanceId` como prop mas **nunca o passa** para `useConversations`, que por sua vez nunca o passa para `crmService.getConversations()`.

## Correções

### 1. `src/lib/crm-service.ts` — Adicionar filtro `instance_id` em `getConversations`
- Adicionar parâmetro `instance_id` ao objeto `filters`
- Quando fornecido, adicionar `.eq('instance_id', filters.instance_id)` na query

### 2. `src/hooks/useConversations.ts` — Aceitar e propagar `instanceId`
- Adicionar `instanceId?: string` ao `UseConversationsOptions`
- Incluir no `getFilters()` como `instance_id`
- Incluir na `queryKey` para cache correto

### 3. `src/components/crm/ConversationList.tsx` — Passar `instanceId` para `useConversations`
- Passar `{ instanceId }` como opção do hook (já recebe `instanceId` como prop)

### 4. Limpeza opcional — Oferecer exclusão de conversas órfãs
- Ao reconectar, o sistema poderia detectar conversas de instâncias antigas e avisar o usuário, mas isso é secundário. O filtro por `instance_id` resolve o problema imediato.

