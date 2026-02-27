

## Diagnóstico Real (baseado nos logs)

Identifiquei **dois problemas concretos** que se complementam para impedir as mensagens de aparecerem:

### Problema 1: `webhook_by_events` NUNCA persiste como `false`

Os logs do `crm-check-connection` mostram que **a cada 15 segundos** o sistema reconfigura o webhook:
```text
🔧 Reconfigurando webhook... { missingEvents: [], currentWebhookByEvents: true }
✅ Webhook reconfigurado com webhook_by_events: false
```
Mas na próxima verificação, `currentWebhookByEvents` volta a ser `true`. A Evolution API **não está persistindo** essa configuração. Quando `webhook_by_events = true`, a Evolution envia mensagens para `{url}/MESSAGES_UPSERT` em vez de `{url}` - o que resulta em 404, pois a Edge Function só escuta no path base. Eventos de conexão chegam (provavelmente vão sempre pro path base), mas **mensagens individuais nunca chegam**.

### Problema 2: Sync encontra apenas números inválidos

O `crm-sync-recent` encontra 3 chats, mas todos têm números de 6-7 dígitos (`573442`, `573449`, `5749442`). São provavelmente status broadcasts ou JIDs internos do WhatsApp, não conversas reais. Resultado: 0 conversas, 0 mensagens sincronizadas.

### Solução Definitiva (3 partes)

#### Parte 1: Forçar `webhook_by_events: false` via endpoint correto
O `/webhook/set` não está persistindo. Vamos usar o endpoint `/instance/update` que configura o webhook a nível de instância (mais persistente em algumas versões da Evolution API). Também vamos tentar deletar o webhook e recriar (`DELETE /webhook/delete` + `POST /webhook/set`).

Em `crm-check-connection/index.ts`:
- Antes de reconfigar com `/webhook/set`, tentar `DELETE /webhook/delete/{instance}` e depois recriar
- Se ainda não persistir, usar `PUT /instance/update/{instance}` com a configuração de webhook embarcada

Em `crm-create-instance/index.ts`:
- Mesma abordagem: deletar + recriar webhook após criar instância

#### Parte 2: Fazer o sync funcionar como fallback real
O sync não encontra conversas reais porque `findChats` retorna apenas JIDs internos. Precisamos:

1. **Logar o raw data** de findChats para debug (JSON.stringify dos primeiros 3 itens)
2. **Adicionar endpoint alternativo**: usar `/message/findMessages/{instance}` com body `{}` para buscar todas as mensagens recentes, extrair os remoteJids únicos delas, e criar conversas a partir disso
3. **Fallback por contatos existentes**: buscar leads/conversas já existentes no banco e sincronizar mensagens diretamente por `remoteJid` para cada um

Em `crm-sync-recent/index.ts`:
- Após findChats retornar apenas números inválidos, tentar buscar mensagens recentes diretamente via `/chat/findMessages/{instance}` ou `/message/findMessages/{instance}` com body vazio/geral
- Extrair remoteJids válidos das mensagens retornadas
- Criar conversas e sincronizar mensagens normalmente

#### Parte 3: Log de diagnóstico detalhado
Adicionar logs temporários com o conteúdo raw das respostas da Evolution API para poder diagnosticar rapidamente se algo mudar.

### Arquivos a editar
1. `supabase/functions/crm-check-connection/index.ts` - delete+recreate webhook, fallback para instance/update
2. `supabase/functions/crm-create-instance/index.ts` - mesma lógica de delete+recreate
3. `supabase/functions/crm-sync-recent/index.ts` - fallback para buscar mensagens diretamente quando findChats retorna lixo

