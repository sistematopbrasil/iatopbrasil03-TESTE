
# Etapa 2: Fundacao da IA - Tabelas + Coluna ai_enabled + Pagina de Configuracao

Esta etapa cria toda a infraestrutura de banco de dados e interface para o Agente IA, sem tocar na logica existente do CRM/WhatsApp.

---

## PARTE 1: Migracao SQL

### 1.1 - Coluna `ai_enabled` na tabela `users`

Adiciona o controle do Super Admin para habilitar/desabilitar IA por consultor.

```sql
ALTER TABLE public.users 
  ADD COLUMN ai_enabled BOOLEAN NOT NULL DEFAULT false;
```

### 1.2 - Tabela `ai_agent_configs`

Armazena TODA a configuracao do agente IA de cada consultor. Uma linha por consultor.

```sql
CREATE TABLE public.ai_agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  
  -- Identidade do Agente
  agent_name TEXT DEFAULT 'Assistente',
  description TEXT,
  
  -- Prompt / Persona
  persona TEXT,           -- Papel e tom de voz (ate 2000 chars)
  skills TEXT,            -- Habilidades e roteiro (ate 20000 chars)
  products_info TEXT,     -- Info de produtos/servicos (ate 20000 chars)
  restrictions TEXT,      -- O que nao pode fazer/falar (ate 2000 chars)
  objective TEXT,         -- Objetivo principal do atendimento
  
  -- Configuracao da IA
  api_provider TEXT NOT NULL DEFAULT 'openai',
  api_key_encrypted TEXT,   -- Chave criptografada via pgcrypto
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  temperature NUMERIC(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 500,
  
  -- Comportamento
  auto_reply BOOLEAN DEFAULT true,
  pause_on_human_minutes INTEGER DEFAULT 120,
  greeting_message TEXT,
  farewell_message TEXT,
  working_hours_only BOOLEAN DEFAULT false,
  working_hours_start TIME DEFAULT '08:00',
  working_hours_end TIME DEFAULT '18:00',
  
  -- Pipeline Automatico
  auto_pipeline BOOLEAN DEFAULT false,
  
  -- Multimodalidade
  transcribe_audio BOOLEAN DEFAULT true,
  analyze_images BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id)
);

-- RLS
ALTER TABLE public.ai_agent_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own AI config"
  ON public.ai_agent_configs FOR ALL
  USING (user_id = get_current_consultant_id());

CREATE POLICY "Super admin can view all AI configs"
  ON public.ai_agent_configs FOR SELECT
  USING (is_super_admin());
```

### 1.3 - Tabela `ai_conversation_state`

Controla o estado da IA em cada conversa individual.

```sql
CREATE TABLE public.ai_conversation_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.crm_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  is_active BOOLEAN DEFAULT true,
  paused_until TIMESTAMPTZ,
  paused_by TEXT DEFAULT 'system',  -- 'manual', 'intervention', 'system'
  permanently_disabled BOOLEAN DEFAULT false,
  
  last_ai_message_at TIMESTAMPTZ,
  messages_sent INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(conversation_id)
);

-- RLS
ALTER TABLE public.ai_conversation_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own AI conversation state"
  ON public.ai_conversation_state FOR ALL
  USING (user_id = get_current_consultant_id());
```

### 1.4 - Extensao pgcrypto para criptografia de API keys

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;
```

---

## PARTE 2: Alteracoes no Codigo

### 2.1 - Super Admin: Toggle de IA na tabela de consultores

**Arquivo:** `src/pages/ConsultantsManagement.tsx`

Adicionar:
- Uma coluna "IA" na tabela com um icone de status (ativo/inativo)
- No dropdown de acoes, adicionar opcao "Ativar IA" / "Desativar IA"
- Mutation para fazer `UPDATE users SET ai_enabled = !ai_enabled WHERE id = X`

Seguindo o mesmo padrao do toggle `is_active` que ja existe (linhas 142-157).

### 2.2 - Consultor: Interface de configuracao da IA

**Arquivo novo:** `src/pages/AdminAIConfig.tsx`

Pagina dedicada (nao uma aba em Settings) com:
- Verificacao se `ai_enabled` esta ativo (se nao, mostra mensagem de que precisa solicitar ao admin)
- Formulario completo organizado em secoes:
  - **Identidade:** Nome do agente, descricao, objetivo principal
  - **Persona:** Campo de texto grande para persona/papel + tom de voz
  - **Conhecimento:** Habilidades e roteiro + Info de produtos/servicos
  - **Restricoes:** O que a IA nao pode fazer/falar
  - **Motor IA:** Provedor (OpenAI/Google), Modelo (dropdown), API Key (campo senha), Temperatura (slider)
  - **Comportamento:** Tempo de pausa, mensagem de saudacao, horario de atendimento, auto-reply toggle
  - **Avancado:** Pipeline automatico, transcricao de audio, analise de imagens

**Arquivo novo:** `src/hooks/useAIConfig.ts`

Hook para carregar e salvar a configuracao via Supabase, com:
- `useQuery` para buscar `ai_agent_configs` do usuario logado
- `useMutation` para criar/atualizar a configuracao
- Logica de upsert (INSERT ON CONFLICT UPDATE)

### 2.3 - Navegacao: Menu condicional

**Arquivo:** `src/components/admin/AdminLayout.tsx`

Adicionar item de menu "Agente IA" (icone `Bot`) no array `consultantNavItems`, mas so exibir se o usuario tiver `ai_enabled = true`. Para isso:
- Adicionar `ai_enabled` ao select do `getCurrentConsultant`
- Filtrar o item de menu condicionalmente

**Arquivo:** `src/lib/consultant-context.ts`

Adicionar `ai_enabled` na interface `ConsultantUser` e no select da funcao `getCurrentConsultant`.

### 2.4 - Rota protegida

**Arquivo:** `src/App.tsx`

Adicionar rota `/admin/ai-config` com `ProtectedRoute`.

---

## PARTE 3: Resumo dos Arquivos

| Acao | Arquivo |
|------|---------|
| Migracao SQL | Nova migracao (tabelas + coluna + pgcrypto) |
| Modificar | `src/pages/ConsultantsManagement.tsx` - toggle IA |
| Modificar | `src/components/admin/AdminLayout.tsx` - menu condicional |
| Modificar | `src/lib/consultant-context.ts` - campo ai_enabled |
| Modificar | `src/App.tsx` - nova rota |
| Criar | `src/pages/AdminAIConfig.tsx` - pagina de config |
| Criar | `src/hooks/useAIConfig.ts` - hook CRUD |

---

## Notas sobre a pesquisa da outra IA

Pontos uteis que incorporei no plano:
- **Criptografia de API keys** com pgcrypto (nao armazenar em texto puro)
- **Pausa configuravel** (padrao 120 min, editavel pelo consultor)
- **Horario de atendimento** (IA so responde em horario comercial)
- **Controle granular por conversa** (pausar/desativar IA em chats especificos)
- **Contadores de uso** (tokens usados, mensagens enviadas) para monitoramento futuro
- **Campo `permanently_disabled`** para desativar IA em um contato especifico ate reativacao manual

A logica de processamento da IA (edge function, integracao com OpenAI/Whisper, webhook) sera implementada na **Etapa 3**, mantendo o isolamento total.
