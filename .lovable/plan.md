

## Diagnóstico REAL dos bugs (encontrados no código)

### Bug 1: `chat.id` vs `chat.remoteJid` (CAUSA PRINCIPAL do sync falhando)

No `crm-sync-recent`, linha 239:
```js
const remoteJid = chat.id || chat.remoteJid;
```

Os logs mostram que `chat.id` retorna um **CUID do banco** (`cmm573nlh4xifmf4jab2vidbm`), NÃO um JID WhatsApp. Enquanto `chat.remoteJid` tem o valor correto (`553399437134@s.whatsapp.net`).

Como `chat.id` vem primeiro e existe, o código usa o CUID, faz `.replace('@s.whatsapp.net', '')` que não altera nada, e `normalizePhone("cmm573nlh4xifmf4jab2vidbm")` retorna um hash inválido → filtrado como "número inválido". **Todos os 3 chats são descartados.**

**Fix**: Trocar `chat.id || chat.remoteJid` por `chat.remoteJid || chat.id` em TODOS os lugares do sync, e adicionar validação para só usar valores que contenham `@s.whatsapp.net`.

### Bug 2: Parsing errado do `webhookByEvents` (causa reconfigurações infinitas)

No `crm-check-connection`, linha 159:
```js
const currentWebhookByEvents = currentWebhook?.webhook?.webhook_by_events ?? currentWebhook?.webhook_by_events ?? true;
```

A API retorna `webhookByEvents` (camelCase), mas o código lê `webhook_by_events` (snake_case). Como não encontra, cai no default `true`, e tenta "reconfigar" algo que já está correto.

As 3 tentativas de reconfiguraão falham (DELETE → 404, POST → 400, PUT → 404), potencialmente corrompendo o webhook funcional.

**Fix**: Ler AMBOS os formatos: `webhookByEvents` E `webhook_by_events`.

### Bug 3: Mesmo bug `chat.id || chat.remoteJid` na linha 330

Linha 330 repete o mesmo padrão. Precisa ser corrigido também.

---

## Arquivos a editar

### 1. `supabase/functions/crm-sync-recent/index.ts`
- **Linha 239**: Trocar `chat.id || chat.remoteJid` → usar lógica que prefere o valor que contém `@s.whatsapp.net`
- **Linha 330**: Mesmo fix
- Todas as outras referências a `chat.id || chat.remoteJid`

### 2. `supabase/functions/crm-check-connection/index.ts`
- **Linha 159**: Adicionar `webhookByEvents` (camelCase) ao parsing
- Remover as estratégias de delete/recreate que falham com 404/400 (o webhook já está correto)
- Simplificar para: se config está OK, não mexer

