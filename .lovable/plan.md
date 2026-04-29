## Plano de ajustes

### 1. Erro "Erro ao salvar instância" no funil de associados

**Causa raiz**: na função `crm-create-instance`, quando o nome `<base>-associados` já está reservado na Evolution API (mesmo que o INSERT no banco tenha falhado em uma tentativa anterior, deixando órfão na Evolution), o retry usa `instanceName_xxxx` (com `_`), mas o webhook depois recebe esse nome e a busca por `instance_name` no banco falha — o frontend mostra a mensagem genérica. Os logs do webhook mostram exatamente isso (`⚠️ Instância não encontrada: davidtopbrasil-associados` / `dioleno-associados` / `phablo-associados`), confirmando que a Evolution já tem essas instâncias mas o nosso banco não — provavelmente porque o INSERT falhou (constraint UNIQUE em `instance_name` ou erro de policy) e ficou inconsistente.

**Solução**:
- Antes de chamar `/instance/create` na Evolution, verificar se a instância já existe na Evolution (`GET /instance/fetchInstances?instanceName=<nome>`); se existir mas não estiver no nosso banco, **adotar** essa instância (insert no banco com o nome existente em vez de criar nova).
- Logar o erro real do INSERT no banco e retornar uma mensagem específica (não mais "Erro ao salvar instância" genérico).
- Garantir que o nome alternativo no fallback use `-` (não `_`) para manter padrão consistente: `<base>-associados-2`, `-3`, etc.
- Aumentar o loop de unicidade para checar tanto o banco local quanto a Evolution antes de tentar criar.

### 2. Criação automática de instâncias ao criar/editar consultor

**Estado atual**: `create-consultant` já cria uma instância por funil habilitado (loop em `normalizedAllowed`). **Falta**: `update-consultant-funnel-access` apenas atualiza `allowed_funnels` — não cria instância para o novo funil adicionado.

**Solução**:
- Em `update-consultant-funnel-access`, após o UPDATE bem-sucedido, calcular `addedFunnels = allowed_funnels - currentAllowed` e, para cada funil adicionado, executar o mesmo bloco de criação de instância que existe em `create-consultant` (extrair em helper compartilhado em `_shared/create-whatsapp-instance.ts` para reuso).
- Retornar no response `created_instances: [...]` para o frontend dar feedback ("Instância de associados criada").
- O `EditConsultantFunnelDialog` exibe toast com instâncias criadas.

### 3. Página de recrutamento (/r/:slug)

**Remoções e ajustes em `src/pages/CapturePage.tsx` (bloco `copy` recrutamento, linhas ~700-705)**:
- Remover bloco de "social proof" com `+75.000 / clientes atendidos pelo time Top Brasil / ⭐⭐⭐⭐⭐ / Faça parte do time que já transformou... / Quero ser consultor agora`. Localizar a seção que renderiza esses campos (`socialNumber`, `socialLabel`, `socialDescription`, `socialCta`) **apenas no modo recrutamento** e suprimi-la (manter para captação de associados).
- Adicionar a seção dos 6 ícones de benefícios (`/benefits/benefit-1.png` a `benefit-6.png`) **também no final** da página de recrutamento, depois do formulário (hoje só aparece após o hero). Pode ser uma segunda renderização condicional ou mover para o final.
- Trocar título padrão de **"Quer uma renda extra ou mudar de vida?"** por algo mais persuasivo. Sugestões para escolher na implementação:
  1. **"Construa uma renda sem teto vendendo o que o Brasil mais precisa."**
  2. **"Vire consultor Top Brasil e transforme sua próxima venda em liberdade financeira."**
  3. **"Sua nova carreira começa agora — comissões altas, treinamento completo, time vencedor."**
- Atualizar em 3 lugares: default na coluna `capture_page_configs.title`, default em `getDefaultConfig(true)` no `CapturePage.tsx`, default em `getDefaults('recruitment')` no `ConsultantSettings.tsx`.

### 4. Separação total das configs Consultores × Associados

**Estado atual**: a separação por `page_purpose` ('protection' | 'recruitment') já existe na tabela e no save. **Problema reportado**: ao configurar perguntas da página de recrutamento "/r/" elas não ficam salvas.

**Causa investigada**:
- As **perguntas customizadas da landing page** (`custom_questions` em `capture_page_configs`) são salvas corretamente via `save` do `ConsultantSettings` (já filtra por `page_purpose`).
- Já o `QuizQuestionsEditor` (perguntas do **Quiz** em `quiz_questions`) usa `funnel_type` derivado de `resolvedFunnel` do `FunnelContext`. Quando o super admin / consultor entra na aba "Página de Recrutamento" sem trocar o funil ativo no sidebar para "Consultores", o editor pode estar gravando perguntas no funil errado.

**Solução**:
- No `QuizQuestionsEditor`, **não** depender de `useFunnel().resolvedFunnel`. Receber `funnelType` por prop diretamente do componente pai (`ConsultantSettings`), que já sabe o `pagePurpose` (recruitment → consultor / protection → associado).
- Adicionar um cabeçalho visual nas duas seções de configuração ("📝 Perguntas do Quiz — Funil de Consultores (recrutamento)" vs "Funil de Associados (proteção)") para deixar explícito qual funil está sendo editado, independente do sidebar.
- Garantir que a `queryKey` do React Query inclua o `funnel_type` correto para evitar cache cruzado.
- Validar que as `custom_questions` da landing são persistidas e relidas corretamente: o `useEffect` que recarrega o form quando `pagePurpose` muda já existe; reforçar com `queryClient.invalidateQueries(['capture-config'])` após o save (já existe).
- Adicionar um indicador "Salvo" no editor de perguntas customizadas e garantir que o botão "Salvar" da landing salve `custom_questions` sempre (verificar que campos vazios não sobrescrevem).

### 5. Reset de pontuação do ranking (refazer corretamente)

**Problema**: a função `archive_and_reset_ranking` apaga linhas de `ranking_scores`, mas o ranking exibido (`useRankingData` → edge `ranking-get`) é calculado **em tempo real a partir de `quiz_submissions_new`**. Logo, o reset atual **não tem efeito visível**.

**Solução baseada em "marco de competição"** (sem deletar leads):
- Migration nova: criar tabela `ranking_competitions` com colunas `id`, `organization_id`, `label`, `started_at`, `ended_at` (nullable), `is_current` (bool, único por org). Row policy: super_admin manage.
- Ao "Resetar ranking" (super admin):
  1. Fechar a competição atual (set `ended_at = now()`, `is_current = false`).
  2. Arquivar snapshot agregado (já existente): preserva o `archive_and_reset_ranking` para histórico, mas **agora calculando via leads agregados do período** em vez de `ranking_scores`.
  3. Criar nova competição `is_current = true` com `started_at = now()` e o `label` informado.
- Modificar `ranking-get` para, quando `periodStart` não vier explicitamente, buscar o `started_at` da competição corrente da organização e usar como `periodStart`. Assim o ranking visual zera automaticamente após o reset, mas o histórico de leads continua intacto no banco.
- O Card "Ver detalhes" da competição arquivada continua funcionando (lê de `ranking_history`).
- Manter a opção do super admin escolher um período manual (filtros de data já existentes no AdminRanking) — o `periodStart` manual sobrepõe o da competição.

### 6. Erro "Failed to send a request to the Edge Function" ao trocar email/senha

Ainda pendente do turno anterior. Após o ajuste de CORS, se o erro persistir no preview (ambiente do Lovable proxia fetches), validar:
- A função `update-consultant-credentials` está deployada (rodar `supabase--deploy_edge_functions`).
- Testar via `supabase--curl_edge_functions` para confirmar que o endpoint responde 200 fora do preview.
- Se ainda falhar no preview, é limitação conhecida; no Published URL funciona. Adicionar uma nota no dialog: "Caso a operação falhe no preview, teste no link publicado."

---

## Detalhes técnicos por arquivo

**Backend (edge functions)**
- `supabase/functions/_shared/create-whatsapp-instance.ts` — **novo** helper compartilhado.
- `supabase/functions/create-consultant/index.ts` — refatorar loop de instâncias para usar o helper.
- `supabase/functions/update-consultant-funnel-access/index.ts` — chamar helper para funis adicionados; retornar `created_instances`.
- `supabase/functions/crm-create-instance/index.ts` — checar Evolution antes de criar (adopt orphans), corrigir nome alternativo, retornar erro real do INSERT.
- `supabase/functions/ranking-get/index.ts` — fallback `periodStart` para `current_competition.started_at`.

**Migrations**
- Nova tabela `ranking_competitions` + RLS + função para abrir/fechar competição.
- Trigger/seed: criar uma competição inicial `is_current = true` para cada organização existente, com `started_at = (SELECT min(created_at) FROM quiz_submissions_new WHERE organization_id = ...)` ou `now()`.
- Atualizar `archive_and_reset_ranking` para fazer rotação da competição.

**Frontend**
- `src/pages/CapturePage.tsx` — remover social proof do recrutamento, adicionar 6 ícones no final, novo título padrão.
- `src/components/consultant/ConsultantSettings.tsx` — passar `funnelType` explícito para `QuizQuestionsEditor`, atualizar default do título de recrutamento.
- `src/components/consultant/QuizQuestionsEditor.tsx` — aceitar prop `funnelType` opcional (override do contexto), header visual claro do funil editado.
- `src/components/super-admin/RankingResetCard.tsx` — copy ajustada ("Iniciar nova competição" em vez de só arquivar).
- `src/components/super-admin/EditConsultantFunnelDialog.tsx` — exibir toast com instâncias criadas após salvar funis.

---

## Resumo do que muda para o usuário

- Funil de associados passa a criar instância sem erro (recupera órfãos da Evolution).
- Adicionar/remover funil de um consultor já existente cria automaticamente as instâncias necessárias.
- Página `/r/:slug` (recrutamento) com título mais persuasivo, sem o bloco "+75.000" e com os 6 ícones no final.
- Configurações de Consultores e Associados totalmente isoladas: editar uma nunca afeta a outra.
- Botão "Resetar ranking" passa a zerar de fato o placar visível (sem perder leads), mantendo histórico das competições anteriores.
