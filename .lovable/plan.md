

## Plano: Aplicar as 3 correções (agora de verdade)

As correções anteriores **não foram salvas**. Confirmei lendo os arquivos — todos estão com o código antigo. Vou aplicar as mesmas 3 correções:

---

### 1. Filtro quiz no prefetch (usePrefetchAdminData.ts)

- **Linha 76-79**: Adicionar `.eq('lead_source', 'quiz')` no `leadsQuery` (pipeline leads / dashboard)
- **Linha 101-105**: Adicionar `.eq('lead_source', 'quiz')` no `analyticsQuery`

### 2. Webhook flexível (crm-webhook/index.ts)

- **Linhas 98-109**: Ao invés de rejeitar quando o secret não bate, verificar se o body tem estrutura válida da Evolution API (`event`, `instance`, `data`) e permitir o request com log de diagnóstico

### 3. Sync diagnóstico (crm-sync-recent/index.ts)

- Adicionar logs detalhados quando mensagens retornam vazias
- Adicionar suporte a `remoteJidAlt` para formato `@lid` do WhatsApp

---

### Arquivos a alterar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/usePrefetchAdminData.ts` | `.eq('lead_source', 'quiz')` em 2 queries |
| `supabase/functions/crm-webhook/index.ts` | Aceitar webhook sem secret se body válido |
| `supabase/functions/crm-sync-recent/index.ts` | Logs + suporte @lid |

