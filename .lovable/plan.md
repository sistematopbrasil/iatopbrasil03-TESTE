

## Plano: Ajustes no Analytics, IA nas Conversas, Follow-up e Pipeline Prompts

### 1. Analytics — filtrar corretamente leads do quiz

O filtro `.eq('lead_source', 'quiz')` já está no código (linha 96), mas o problema pode estar na query principal ou em outra query na mesma página que não filtra. Vou verificar todas as queries do `AdminAnalytics.tsx` e garantir que **todas** filtrem por `lead_source = 'quiz'`. Pode haver queries adicionais (como a de consultores ou a de funil) que buscam dados sem esse filtro.

**Arquivo**: `src/pages/AdminAnalytics.tsx` — revisar todas as queries para incluir `.eq('lead_source', 'quiz')`.

### 2. Botão "Disparar IA" visível a qualquer momento

Atualmente o botão "Ativar IA" só aparece quando `status === 'none'`. O usuário quer um botão de **disparo** que funcione sempre — mesmo quando a IA já está ativa — para forçar uma resposta imediata.

Além disso, ao ativar a IA deve haver **duas opções**:
- **Ativar e enviar mensagem**: IA gera e envia uma mensagem imediata
- **Ativar sem enviar**: IA fica ativa mas só responde quando o lead mandar mensagem

**Arquivos**:
- `src/components/crm/AIStatusBadge.tsx`: Adicionar opção "Disparar IA agora" no dropdown quando `status === 'active'`. Quando `status === 'none'`, mostrar dropdown com 2 opções (ativar com/sem mensagem).
- `src/hooks/useAIConversationState.ts`: Adicionar mutation `activateSilent` (cria estado ativo sem invocar a edge function).

### 3. IA ativa em todas as conversas ao ligar nas configurações

Quando o usuário ativa `auto_reply` nas configurações, a IA deve ficar ativa em **todas** as conversas automaticamente (sem precisar ativar uma por uma). Isso já funciona via a edge function (webhook), mas o `AIStatusBadge` retorna `null` quando `status === 'none'`. 

**Mudança**: Quando `aiEnabled=true` e `status === 'none'`, em vez de mostrar "Ativar IA", tratar como se a IA estivesse ativa (já que o webhook vai responder). Mostrar badge "IA Ativa" e permitir desativar/pausar naquela conversa específica.

### 4. Follow-up — opções de minutos, horas e dias

Atualmente as opções são fixas em minutos/horas (30min a 48h). Adicionar opções com **dias** e melhor formatação.

**Arquivo**: `src/components/admin/FollowUpRulesEditor.tsx` — expandir `DELAY_OPTIONS` para incluir:
- 30 minutos, 1h, 2h, 4h, 8h, 12h, 24h, 48h, 3 dias, 5 dias, 7 dias

### 5. Pipeline Prompts — abrir em Dialog em vez de inline

Atualmente o `PipelineStagePromptsEditor` mostra todos os textareas inline, o que alonga a página. Mudar para um botão "Configurar Quadros" que abre um **Dialog** com os campos.

**Arquivos**:
- `src/components/admin/PipelineStagePromptsEditor.tsx`: Wrappear o conteúdo em um `Dialog`. O componente exportado mostra apenas um botão + descrição. Ao clicar, abre o dialog com os textareas dos quadros.

