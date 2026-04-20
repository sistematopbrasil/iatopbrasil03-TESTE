

# Fase B aprovada — implementação

## 1. Migration única (banco)

Adiciona à tabela `users`:
- `allowed_funnels funnel_type[] NOT NULL DEFAULT ARRAY['consultor']::funnel_type[]`
- `default_funnel funnel_type NOT NULL DEFAULT 'consultor'`
- `last_active_funnel funnel_type` (nullable)
- CHECK constraint: `default_funnel = ANY(allowed_funnels)`
- Backfill defensivo (UPDATE redundante onde já houver default)

Cria 2 funções `SECURITY DEFINER`:
- `user_has_funnel_access(p_user_id uuid, p_funnel funnel_type) → boolean`
- `get_my_funnel_access() → TABLE(allowed funnel_type[], default_f funnel_type, last_active funnel_type)`

## 2. Edge functions atualizadas (retrocompatíveis — todas com defaults)

| Função | Mudança |
|---|---|
| `create-consultant` | Aceita `allowed_funnels` + `default_funnel` (Zod, defaults `['consultor']`/`'consultor'`); persiste nas colunas novas |
| `crm-create-instance` | Aceita `funnel_type` (default `'consultor'`); valida `user_has_funnel_access`; respeita UNIQUE `(user_id, funnel_type)` |
| `ai-agent-respond` | Lê `funnel_type` da `whatsapp_instances` da conversa; busca `ai_agent_configs WHERE user_id = X AND funnel_type = Y`; **se não existir, não responde** (decisão 3 do usuário); filtra `pipeline_stage_prompts` por funil também |
| `ai-agent-test` | Aceita `funnel_type` (default `'consultor'`) |
| `ranking-get` | Aceita query param `funnel_type` opcional. Comportamento: super_admin sem filtro → `{ consultor: [...], associado: [...] }` separado; usuário comum sem filtro → usa `last_active_funnel || default_funnel`; com filtro → aplica direto |
| `followup-check` | Junta `whatsapp_instances` e filtra `followup_rules` pelo mesmo `funnel_type` da conversa — regras de um funil não disparam no outro |
| `crm-webhook` | Propaga `funnel_type` da `whatsapp_instances` ao criar conversa/lead via webhook |

## 3. Edge function nova

`update-consultant-funnel-access`:
- Apenas `super_admin` (validação por JWT + lookup de role)
- Body: `{ user_id, allowed_funnels, default_funnel }`
- Validações Zod: `allowed_funnels.length ≥ 1`, `default_funnel ∈ allowed_funnels`
- Retorna contagem de leads/conversas por funil que ficarão "invisíveis" se um funil for removido (sem deletar nada)

## 4. Arquivo TypeScript novo

`src/lib/funnel-types.ts`:
```typescript
export type FunnelType = 'consultor' | 'associado';
export const FUNNEL_LABELS: Record<FunnelType, string> = {
  consultor: 'Consultores',
  associado: 'Associados',
};
```

`src/integrations/supabase/types.ts` se atualiza sozinho após a migration.

## 5. O que NÃO muda

- Rotas (`/c/:slug`, `/r/:slug`, `/quiz/:slug`) — intocadas
- Frontend (Fase C) — zero alteração agora
- RLS atual — preservada (filtros adicionais ficam para Fase C)
- Tabela `quiz_submissions` legada — sem mudanças
- Chamadas existentes às edge functions sem `funnel_type` continuam funcionando (default `'consultor'`)

## 6. Garantias de não-quebra

| Risco | Mitigação |
|---|---|
| Frontend antigo chama function sem `funnel_type` | Default `'consultor'` em todos os parsers |
| Webhook recebe mensagem antes da Fase C | `whatsapp_instances.funnel_type` (NOT NULL DEFAULT) garante valor consistente |
| `ai-agent-respond` para de responder em funil novo sem config | Comportamento esperado (decisão 3) — usuário "habilita" manualmente na Fase C |
| Ranking de super_admin muda formato | Só muda quando `funnel_type` é omitido — chamadas atuais já passam parâmetros conhecidos; verifico cada caller antes de quebrar |

## 7. Entregáveis desta fase

- 1 migration SQL
- 7 edge functions atualizadas
- 1 edge function nova (`update-consultant-funnel-access`)
- 1 arquivo TypeScript novo (`src/lib/funnel-types.ts`)
- Deploy automático de todas as functions tocadas

Após a aprovação, sistema continua 100% funcional. Fase C (frontend: toggle, filtros, UI de acesso) entra em seguida quando você liberar.

