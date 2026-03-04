

## Plano: Corrigir CRM — Mensagens, Conversas Antigas e QR Code

Vou ser 100% transparente: **encontrei a causa raiz real** nos logs do backend. O problema principal NÃO é o código do webhook em si — é a **configuração do webhook na Evolution API** que está quebrada.

---

### Diagnóstico Real (o que os logs mostram)

1. **O webhook `/set` falha com erro 400** a cada 15 segundos:
```text
Set webhook response: 400
{"message":[["instance requires property \"webhook\""]]}
```
O código envia as propriedades em formato "flat" (`url`, `webhook_by_events`, `events`), mas a Evolution API v2 exige tudo dentro de um objeto `webhook` aninhado.

2. **O webhook ESTÁ configurado** (foi feito na criação da instância), MAS com `webhookBase64: false` e faltando os eventos `MESSAGES_SET` e `MESSAGE_ACK`. A URL e os eventos principais (MESSAGES_UPSERT, SEND_MESSAGE) estão corretos.

3. **ZERO eventos de mensagem chegam no webhook** — apenas `qrcode.updated` e `connection.update`. Apesar dos eventos estarem configurados, a Evolution API não está disparando MESSAGES_UPSERT para esta instância.

4. **A instância está conectada** (state: open no check-connection), então o WhatsApp ESTÁ funcionando — o problema é só o webhook não entregar mensagens.

---

### Correções

#### 1. Corrigir formato do webhook/set em TODOS os lugares (CAUSA RAIZ PRINCIPAL)

**Arquivos**: `crm-repair-connection/index.ts`, `crm-check-connection/index.ts`, `crm-create-instance/index.ts`

O endpoint `/webhook/set/{instance}` na Evolution API v2 espera o payload assim:
```json
{
  "webhook": {
    "enabled": true,
    "url": "...",
    "webhookByEvents": false,
    "webhookBase64": true,
    "events": [...]
  }
}
```

Mas o código atual envia:
```json
{
  "url": "...",
  "webhook_by_events": true,
  "events": [...]
}
```

**Mudanças**:
- Em `crm-repair-connection`: linhas 266-284 e 329-355 — envolver todas as propriedades do webhook dentro de `{ webhook: { ... } }` com `webhookByEvents: false` e `webhookBase64: true`
- Em `crm-check-connection`: linhas 159-176 — mesmo formato aninhado
- Em `crm-create-instance`: linhas 139-162 — mesmo formato para webhook/set (a criação já usa o formato correto no body da instância)
- Adicionar `MESSAGES_SET` e `MESSAGE_ACK` a todos os conjuntos de eventos
- Setar `webhookByEvents: false` para garantir que TODOS os eventos vão para a mesma URL

#### 2. Corrigir o sync para usar `last_connected_at` (conversas antigas)

**Arquivo**: `crm-sync-recent/index.ts`

- Linha 561: Trocar `instance.created_at` por `instance.last_connected_at` para filtrar mensagens
- Se `last_connected_at` for null, usar a data atual (instância nunca conectou = não sincronizar nada antigo)
- Adicionar log do timestamp usado para filtro

#### 3. Corrigir webhook para aceitar remoteJid no formato @lid

**Arquivo**: `crm-webhook/index.ts`

- Linha 351-361: Além de `@s.whatsapp.net`, também aceitar `@lid` format
- Para @lid: tentar resolver o número real via Evolution API endpoint `/chat/findContacts` ou logar e pular
- Na prática: como @lid não contém o número do telefone, ignorar essas mensagens no webhook (o sync resolve via API)

#### 4. Corrigir fluxo de QR Code para novas contas

**Arquivo**: `src/contexts/WhatsAppConnectionContext.tsx`

- Linha 330-337: O auto-connect para novas contas chama `connectInstance()` que usa `crm-repair-connection` → que falha no webhook/set → mas o QR funciona
- O problema de "tela de reconexão" acontece porque `isConnecting` fica `false` brevemente entre `loadInstance` detectar `disconnected` e `connectInstance` setar `isConnecting = true`
- **Fix**: Setar `isConnecting = true` ANTES de chamar `connectInstance()` (já faz isso na linha 334, verificar se não há gap)

**Arquivo**: `src/components/crm/DisconnectedOverlay.tsx`

- Quando `instance.last_connected_at` é null (nunca conectou), o overlay principal não deveria mostrar "WhatsApp Desconectado / Reconectar" — deveria mostrar "Conectar WhatsApp" ou ir direto para a tela de QR
- Adicionar verificação: se `instance` existe mas `last_connected_at` é null, auto-iniciar conexão em vez de mostrar overlay de "reconexão"

#### 5. Parar o flood de webhook/set a cada 15s no health check

**Arquivo**: `crm-check-connection/index.ts`

- Linhas 154-188: O health check tenta reconfigurar o webhook SEMPRE que `missingEvents.length > 0` OU `!hasSecretHeader`. Mas o /set falha com 400, e isso repete a cada 15s
- **Fix**: Adicionar um cache/flag para não tentar reconfigurar se já falhou recentemente (ou simplesmente não reconfigurar no health check — deixar para o repair-connection)

---

### Resumo de Arquivos

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `supabase/functions/crm-repair-connection/index.ts` | Formato aninhado `{ webhook: {...} }` no /set |
| 2 | `supabase/functions/crm-check-connection/index.ts` | Mesmo formato + parar flood de 400 |
| 3 | `supabase/functions/crm-create-instance/index.ts` | Mesmo formato no /set para instâncias existentes |
| 4 | `supabase/functions/crm-sync-recent/index.ts` | `last_connected_at` em vez de `created_at` |
| 5 | `supabase/functions/crm-webhook/index.ts` | Aceitar @lid (log e skip) |
| 6 | `src/contexts/WhatsAppConnectionContext.tsx` | Eliminar flash de "reconexão" |
| 7 | `src/components/crm/DisconnectedOverlay.tsx` | Texto correto para primeira conexão |

### Prioridade
1. **Formato do webhook/set** — resolve mensagens não aparecerem (causa raiz #1)
2. **last_connected_at** — resolve conversas antigas
3. **DisconnectedOverlay** — resolve UX do QR
4. **Health check flood** — para erros desnecessários

