

# Plano: Adicionar suporte a Dual-Funnel (Consultor + Associado) sem quebrar produção

## Princípios não-negociáveis

1. **Nenhuma rota, slug ou função existente muda** — `/c/:slug`, `/r/:slug`, `/quiz/:slug`, todas as edge functions e queries continuam funcionando.
2. **Dados existentes ficam marcados como `'consultor'` via DEFAULT + backfill** — semântica preservada.
3. **Mudanças são puramente aditivas** — só adicionamos colunas/tabelas, nunca removemos ou renomeamos.
4. **Backfill automático** garante zero NULL em produção antes de qualquer código novo ler a coluna.

---

## 1. O que CRIAR do zero

### 1.1 Enum `funnel_type`
```sql
CREATE TYPE public.funnel_type AS ENUM ('consultor', 'associado');
```
Tipo central que classifica leads, estágios, rankings, IAs e instâncias.

### 1.2 Função helper `get_default_pipeline_stage_for_funnel(org_id, funnel)`
Retorna o primeiro estágio do funil específico — substitui chamadas de `get_default_pipeline_stage_id` quando o contexto tiver funil. A função antiga continua existindo para compatibilidade.

### 1.3 Trigger atualizada `assign_initial_pipeline_stage`
Passa a considerar `NEW.funnel_type` ao buscar o primeiro estágio. Se `funnel_type = 'consultor'` (default), comportamento idêntico ao atual.

### 1.4 Seed automático de pipeline "associado"
Migration que, para cada `organization_id` existente, insere os 5 estágios do funil de associados:

| order_index | name | color |
|---|---|---|
| 0 | Novos Leads | #3B82F6 |
| 1 | Primeiro Contato | #F59E0B |
| 2 | Proposta Enviada | #8B5CF6 |
| 3 | Novos Associados | #10B981 |
| 4 | Descartados | #EF4444 |

Marcados com `funnel_type = 'associado'`. Os estágios atuais ficam com `funnel_type = 'consultor'`.

---

## 2. O que ALTERAR (somente ADD COLUMN, nunca DROP)

### 2.1 Tabelas que ganham `funnel_type funnel_type NOT NULL DEFAULT 'consultor'`

| Tabela | Justificativa |
|---|---|
| `quiz_submissions_new` | Identifica para qual funil o lead entrou |
| `pipeline_stages` | Cada estágio pertence a um funil específico |
| `ai_agent_configs` | Permite 1 IA por funil (persona dedicada) |
| `whatsapp_instances` | Permite 1 número WhatsApp por funil |
| `capture_page_configs` | Reforça `page_purpose` existente, alinha nomenclatura |
| `followup_rules` | Regras de follow-up podem diferir entre funis |
| `pipeline_stage_prompts` | Prompts da IA por estágio também herdam o funil |

### 2.2 `ranking_scores` — coluna + nova UNIQUE
- Adicionar `funnel_type` com default `'consultor'`
- Atualizar UNIQUE constraint de `(organization_id, consultant_id, period_start, period_end)` para incluir `funnel_type` → permite o mesmo consultor pontuar nos 2 rankings sem colidir
- Conversão = "Novos Associados" no funil associado vale o mesmo que "Consultor" no funil consultor

### 2.3 `ai_agent_configs` — UNIQUE em `(user_id, funnel_type)`
Hoje é UNIQUE em `user_id`. Vira `(user_id, funnel_type)` — consultor pode ter 2 personas de IA, uma por funil.

### 2.4 `whatsapp_instances` — UNIQUE em `(user_id, funnel_type)`
Mesma lógica: opcionalmente 2 instâncias por consultor.

---

## 3. Backfill (executado dentro da mesma migration)

```text
1. ADD COLUMN funnel_type ... DEFAULT 'consultor'  ← preenche tudo automático
2. UPDATE explícito redundante em cada tabela (segurança)
3. INSERT dos 5 stages 'associado' para cada org existente
4. ALTER UNIQUE constraints
```

Tudo numa única migration transacional. Se qualquer passo falhar, rollback completo — produção não vê estado intermediário.

---

## 4. O que NÃO mexer

- Triggers `update_temperature_on_pipeline_move`, `calculate_lead_score`, `sync_ranking_consultants_recruited` — todos continuam funcionando porque leem `pipeline_stage_id`/temperatura e não dependem do tipo de funil
- Funções `get_consultant_by_slug`, `get_organization_public`, `generate_quiz_slug` — intocadas
- Tabela legada `quiz_submissions` — fica como está (já restrita ao super_admin)
- Edge functions atuais — não precisam alterar nada para continuarem funcionando (DEFAULT cuida)

---

## 5. Garantias de não-quebra (mapa de risco)

| Risco | Mitigação |
|---|---|
| Código antigo insere lead sem `funnel_type` | DEFAULT `'consultor'` cobre |
| Query de pipeline atual retorna estágios "associado" misturados | Frontend filtra por `funnel_type` ao listar; SEM filtro retorna tudo (compatível) |
| Ranking soma pontos errado | Nova UNIQUE + `funnel_type` no GROUP BY isolam totais |
| IA dispara para funil errado | Resolver IA por `(user_id, funnel_type)` da conversa; fallback para `'consultor'` se inexistente |
| Webhook CRM não sabe o funil | Funil herda de `whatsapp_instance.funnel_type` da instância que recebeu a mensagem |

---

## 6. Diagrama do fluxo após mudança

```text
                    ┌─ funnel_type='consultor' (atual, default)
quiz_submissions_new┤
                    └─ funnel_type='associado' (novo)
                              │
                              ▼
                    pipeline_stages (filtrados por funnel_type)
                              │
                              ▼
                    ranking_scores (separados por funnel_type)
                              │
                              ▼
                    ai_agent_configs (1 por funil)
                              │
                              ▼
                    whatsapp_instances (1 por funil, opcional)
```

---

## 7. Ordem de execução recomendada

**Fase A — Banco (1 migration única, segura):**
1. Criar enum `funnel_type`
2. Adicionar coluna em todas as 7 tabelas com DEFAULT
3. Backfill explícito (UPDATE redundante)
4. Atualizar UNIQUE constraints
5. Criar helper `get_default_pipeline_stage_for_funnel`
6. Atualizar trigger `assign_initial_pipeline_stage`
7. Seed dos 5 stages "associado" por organização

**Fase B — Backend (depois, quando UI estiver pronta):**
- Edge functions começam a setar `funnel_type` ao inserir leads conforme rota (`/c/:slug` → `'associado'`, `/r/:slug` e `/quiz/:slug` → `'consultor'`)
- `ranking-get` agrupa por `funnel_type`
- `ai-agent-respond` resolve config pela combinação `(user_id, funnel_type da conversa)`

**Fase C — Frontend:**
- Toggle global "Modo: Consultor / Associado" no AdminLayout (Context + localStorage)
- Pipeline, Ranking, Leads, IA Config, CRM filtram pelo modo ativo

---

## 8. O que entregar agora (somente Fase A)

Uma única migration SQL que:
- Cria o enum
- Adiciona colunas com defaults
- Faz backfill defensivo
- Atualiza UNIQUE constraints (`ai_agent_configs`, `whatsapp_instances`, `ranking_scores`)
- Atualiza a trigger `assign_initial_pipeline_stage` para considerar funil
- Cria função helper `get_default_pipeline_stage_for_funnel`
- Faz seed dos 5 estágios de associado para todas as orgs existentes

Após aprovação dessa migration, **nada quebra** — sistema continua 100% funcional como hoje, mas pronto para receber as Fases B e C quando você decidir.

