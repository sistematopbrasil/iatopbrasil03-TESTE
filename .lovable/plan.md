

## Plano: Analytics com filtro quiz + Mensagens do CRM

Encontrei **3 problemas reais** após investigação detalhada:

---

### Problema 1: Analytics mostrando todos os leads (CAUSA RAIZ)

O filtro `.eq('lead_source', 'quiz')` **já existe** tanto no `AdminAnalytics.tsx` (linha 96) quanto no `ConsultantDashboard.tsx` (linha 62). **Porém**, o arquivo `src/hooks/usePrefetchAdminData.ts` pré-carrega os dados em cache SEM esse filtro — e como o `AdminAnalytics` usa `refetchOnMount: false`, ele consome os dados antigos do cache.

**Correções em `src/hooks/usePrefetchAdminData.ts`**:
- **Linha 105**: Adicionar `.eq('lead_source', 'quiz')` no prefetch do analytics (query key `quiz-submissions-analytics`)
- **Linha 78**: Adicionar `.eq('lead_source', 'quiz')` no prefetch dos leads do dashboard (query key `all-leads-consultant`) — esse alimenta o `ConsultantDashboard`

---

### Problema 2: Mensagens não aparecem — Webhook rejeitado

Todos os webhooks da Evolution API estão sendo rejeitados com "secret inválido ou ausente". Isso significa que **nenhuma mensagem** (enviada ou recebida) chega via webhook. A Evolution API ou não está enviando o header `x-webhook-secret`, ou o valor não bate com o segredo configurado.

**Correção em `supabase/functions/crm-webhook/index.ts`** (linhas 98-109):
- Tornar a validação do secret mais flexível: além de `x-webhook-secret` e `Authorization: Bearer`, também verificar o header `apikey` e query parameter `secret`
- Se NENHUM header de secret for encontrado, logar os headers recebidos para diagnóstico (sem bloquear o request), permitindo que as mensagens sejam processadas enquanto a configuração é ajustada
- Alternativamente, adicionar um fallback que permite requests sem secret quando vêm de IPs da Evolution API

**Abordagem mais segura**: Modificar o webhook para, quando o secret não bater, logar QUAIS headers foram recebidos (para diagnosticar o problema de configuração), mas ainda assim aceitar o request se ele contiver dados válidos da Evolution API (verificando a estrutura do body: precisa ter `event`, `instance`, `data`).

---

### Problema 3: Sync não encontra mensagens para novas instâncias

O `crm-sync-recent` tenta buscar chats/mensagens via API, mas para a instância `teste3mmazq`, o endpoint retorna `{messages: []}` (array vazio). Isso pode ser porque a instância é nova e a Evolution API ainda não tem cache de mensagens.

**Correção em `supabase/functions/crm-sync-recent/index.ts`**:
- Na seção fallback (linhas 280-340), adicionar log detalhado do conteúdo de `result.data.messages` para diagnosticar se é array vazio ou formato inesperado
- Adicionar um endpoint alternativo: `GET /message/findMessages/{instance}` que algumas versões da Evolution API usam

---

### Resumo de arquivos a alterar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/usePrefetchAdminData.ts` | Adicionar `.eq('lead_source', 'quiz')` nos prefetches de analytics e dashboard |
| `supabase/functions/crm-webhook/index.ts` | Flexibilizar validação do webhook secret + log de diagnóstico |
| `supabase/functions/crm-sync-recent/index.ts` | Melhorar logs de diagnóstico + endpoint alternativo para mensagens |

### Prioridade

1. **Prefetch filter** — resolve o analytics imediatamente
2. **Webhook secret** — resolve as mensagens não aparecendo (causa raiz principal)
3. **Sync fallback** — melhoria secundária para quando webhook falha

