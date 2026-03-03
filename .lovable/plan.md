

## Plano de Implementação — 6 Itens

### 1. Melhorar tela de carregamento do Pipeline
O loading atual mostra um spinner no canto inferior esquerdo. Vamos centralizar com skeleton columns que simulam os quadros do pipeline.

**Arquivo**: `src/components/crm/PipelineBoard.tsx` (linhas 245-254)
- Substituir o loading simples por um skeleton que renderiza 5 colunas fantasma com cards placeholder
- Usar componente `Skeleton` existente para manter consistência visual
- As colunas terão a mesma largura (260px mobile / 300px desktop) e headers com skeleton

### 2. Analytics — filtrar apenas leads do quiz
A query atual busca TODOS os leads da organização. Precisa filtrar por `lead_source = 'quiz'`.

**Arquivo**: `src/pages/AdminAnalytics.tsx` (linhas 87-116)
- Adicionar `.eq('lead_source', 'quiz')` na query `quiz-submissions-analytics`
- Atualizar descrição do header para deixar claro que são dados do quiz
- Ajustar query key para incluir o filtro (evitar cache compartilhado)

### 3. Botão "Ativar IA" em todas as conversas do CRM
Quando `auto_reply` está ativado nas configurações, mostrar um botão para ativar/iniciar a IA em qualquer conversa (inclusive as que não têm estado de IA). Ao ativar, a IA envia uma mensagem imediatamente baseada no contexto da conversa.

**Arquivos**:
- `src/components/crm/AIStatusBadge.tsx`: Modificar para que quando `aiEnabled=true` e `status='none'`, exibir um botão "Ativar IA" em vez de retornar `null`
- `src/hooks/useAIConversationState.ts`: Adicionar mutation `activate` que cria o estado ativo e invoca a edge function `ai-agent-respond` para gerar primeira mensagem
- `supabase/functions/ai-agent-respond/index.ts`: Adicionar suporte a um parâmetro `force_respond: true` que pula checagens de "mensagem incoming" e gera resposta com base no histórico existente ou greeting message

### 4. Configurações de Pipeline com IA — prompts por quadro
Quando `auto_pipeline` está ativado, exibir seção para configurar descrição/prompt de cada quadro do pipeline.

**Mudanças de banco**:
- Nova tabela `pipeline_stage_prompts` com: `id`, `stage_id` (FK pipeline_stages), `user_id`, `description` (text), `created_at`, `updated_at`
- RLS: usuários autenticados podem gerenciar seus próprios prompts

**Arquivos de frontend**:
- `src/pages/AdminAIConfig.tsx`: Na seção "Pipeline Automático" (quando ativado), buscar stages da organização e mostrar um textarea para cada um. Salvar na tabela `pipeline_stage_prompts`. Criar prompts padrão automaticamente para stages existentes
- **Prompts padrão**: "Novos Leads" → "Lead acabou de chegar, ainda sem interação"; "Contato Inicial" → "Lead respondeu mas ainda não demonstrou interesse claro"; "Qualificados" → "Lead demonstrou interesse real e ativo"; "Descartados" → "Lead deixou muito claro que não quer participar"

**Edge function**:
- `supabase/functions/ai-agent-respond/index.ts`: Na seção de classificação (linha 774+), buscar prompts configurados e incluí-los no prompt de classificação para que a IA entenda o contexto de cada quadro

### 5. Sistema de Follow-up automático
Sistema de mensagens automáticas quando o lead não responde após X tempo, com condicionais baseadas no pipeline.

**Mudanças de banco**:
- Nova tabela `followup_rules` com campos:
  - `id`, `user_id`, `organization_id`
  - `name` (text) — nome da regra
  - `is_active` (boolean)
  - `delay_minutes` (integer) — tempo de espera sem resposta
  - `max_followups` (integer, default 3) — máximo de follow-ups por conversa
  - `message_type` ('fixed' | 'ai_generated') — mensagem fixa ou gerada pela IA
  - `fixed_message` (text, nullable) — mensagem fixa se `message_type = 'fixed'`
  - `ai_prompt` (text, nullable) — prompt para IA se `message_type = 'ai_generated'`
  - `apply_to_stages` (uuid[], nullable) — quadros onde a regra se aplica (null = todos exceto bloqueados)
  - `exclude_stages` (uuid[], nullable) — quadros onde NÃO se aplica (ex: Descartados, Consultor)
  - `only_open_conversations` (boolean, default true) — só conversas abertas
  - `respect_working_hours` (boolean, default true) — respeitar horário comercial
  - `created_at`, `updated_at`

- Nova tabela `followup_logs` para rastrear envios:
  - `id`, `conversation_id`, `rule_id`, `sent_at`, `message_content`

**Nova Edge Function**: `followup-check`
  - Executada via cron a cada 15 minutos
  - Para cada regra ativa: busca conversas onde a última mensagem incoming foi há mais de `delay_minutes`
  - Verifica condicionais: stage do lead, conversa aberta/fechada, horário comercial, max_followups não atingido
  - Se `message_type = 'fixed'`: envia mensagem fixa via `crm-send-message`
  - Se `message_type = 'ai_generated'`: chama Lovable AI com o histórico + `ai_prompt` e envia resultado
  - Registra em `followup_logs` para controle

**Frontend**:
- Nova aba "Follow-up" na página `AdminAIConfig.tsx` (ou seção dentro de Comportamento)
- Interface para criar/editar regras de follow-up:
  - Nome da regra
  - Tempo de espera (select com opções: 30min, 1h, 2h, 4h, 8h, 24h, 48h)
  - Tipo de mensagem (fixa ou IA)
  - Campo de mensagem ou prompt
  - Multi-select de quadros onde se aplica / não se aplica
  - Toggles: só conversas abertas, respeitar horário comercial
  - Máximo de follow-ups por conversa

**Condicionais importantes**:
- Não enviar se conversa está fechada (status = 'closed')
- Não enviar se lead está no quadro "Descartados" ou "Consultor"
- Não enviar se o lead já respondeu após o último follow-up
- Não enviar mais de X follow-ups por conversa
- Respeitar horário comercial se configurado
- Não enviar se a IA está desativada/pausada naquela conversa

### 6. Cron job para follow-up
- Registrar cron job `followup-check` para executar a cada 15 minutos
- `SELECT cron.schedule('followup-check', '*/15 * * * *', ...)`

---

### Ordem de implementação sugerida
1. Pipeline loading (rápido, UX imediata)
2. Analytics filter (rápido)
3. Botão ativar IA nas conversas
4. Configuração de pipeline com prompts por quadro
5. Sistema de follow-up (mais complexo — banco + edge function + UI + cron)

