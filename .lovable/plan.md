

# Plano de Seguranca e Preparacao para IA - Fase 1

Este plano cobre as correcoes de seguranca criticas, otimizacoes e a preparacao da base de dados para o futuro agente IA.

---

## PARTE 1: Correcoes de Seguranca (Prioridade Maxima)

### 1.1 - Dados de Consultores Expostos Publicamente (ERRO CRITICO)

**Problema:** A policy `Public can read consultants by quiz slug` permite que QUALQUER pessoa leia TODOS os campos da tabela `users` (email, role, auth_user_id, etc.) quando o consultor tem `quiz_slug` definido.

**Solucao:** Criar uma **VIEW publica** que expoe apenas os campos necessarios para o quiz funcionar, e restringir a policy da tabela `users`.

**Migracao SQL:**
```sql
-- 1. Criar view publica com APENAS campos seguros
CREATE OR REPLACE VIEW public.consultants_public AS
SELECT 
  id,
  full_name,
  organization_id,
  quiz_slug,
  profile_photo,
  whatsapp_button_url,
  quiz_cover_image,
  quiz_image_position,
  quiz_image_shape,
  quiz_image_size,
  pixel_id
FROM public.users
WHERE is_active = true AND quiz_slug IS NOT NULL;

-- 2. Remover a policy publica da tabela users
DROP POLICY IF EXISTS "Public can read consultants by quiz slug" ON public.users;
```

**Codigo:** Atualizar `src/lib/organization-service.ts` para usar a view `consultants_public` ao inves da tabela `users` nas funcoes `getQuizDataBySlug` e `getConsultantBySlug`.

---

### 1.2 - Dados de Leads Expostos por 24h (ERRO CRITICO)

**Problema:** A tabela legada `quiz_submissions` expoe nome, telefone, email e dados pessoais de QUALQUER lead criado nas ultimas 24 horas para QUALQUER pessoa na internet.

**Solucao:** Remover todas as policies publicas dessa tabela legada. Nenhum codigo do projeto a utiliza mais.

**Migracao SQL:**
```sql
-- Remover policies perigosas da tabela legada
DROP POLICY IF EXISTS "Anyone can select recent quiz submissions" 
  ON public.quiz_submissions;
DROP POLICY IF EXISTS "Anyone can update recent quiz submissions" 
  ON public.quiz_submissions;
DROP POLICY IF EXISTS "Anyone can insert quiz submissions" 
  ON public.quiz_submissions;
```

---

### 1.3 - Policies "Always True" (AVISO)

**Problema:** As tabelas `quiz_submissions_new` e `tracking_sessions` tem policies de INSERT e UPDATE com `WITH CHECK (true)`, o que permite insercao sem validacao.

**Solucao:** Restringir os WITH CHECK para validar que campos obrigatorios estejam presentes (ex: `organization_id IS NOT NULL`).

**Migracao SQL:**
```sql
-- quiz_submissions_new: INSERT precisa ter organization_id
DROP POLICY IF EXISTS "Public can insert submissions" 
  ON public.quiz_submissions_new;
CREATE POLICY "Public can insert submissions" 
  ON public.quiz_submissions_new FOR INSERT
  WITH CHECK (organization_id IS NOT NULL);

-- quiz_submissions_new: UPDATE restrito a 2h E com organization_id
DROP POLICY IF EXISTS "Public can update recent submissions" 
  ON public.quiz_submissions_new;
CREATE POLICY "Public can update recent submissions" 
  ON public.quiz_submissions_new FOR UPDATE
  USING (created_at > (now() - interval '2 hours'))
  WITH CHECK (organization_id IS NOT NULL);

-- tracking_sessions: INSERT precisa ter organization_id
DROP POLICY IF EXISTS "Public can insert tracking sessions" 
  ON public.tracking_sessions;
CREATE POLICY "Public can insert tracking sessions" 
  ON public.tracking_sessions FOR INSERT
  WITH CHECK (organization_id IS NOT NULL);

-- tracking_sessions: UPDATE restrito a 2h E com organization_id
DROP POLICY IF EXISTS "Public can update tracking sessions" 
  ON public.tracking_sessions;
CREATE POLICY "Public can update tracking sessions" 
  ON public.tracking_sessions FOR UPDATE
  USING (started_at > (now() - interval '2 hours'))
  WITH CHECK (organization_id IS NOT NULL);
```

---

### 1.4 - Extensao no Schema Publico (AVISO)

**Problema:** A extensao `unaccent` esta instalada no schema `public`, o que e uma pratica nao recomendada.

**Solucao:** Mover para o schema `extensions`. Atualizar as funcoes que referenciam `unaccent` para usar o schema correto.

**Migracao SQL:**
```sql
-- Mover extensao para schema extensions
CREATE SCHEMA IF NOT EXISTS extensions;
DROP EXTENSION IF EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA extensions;

-- Atualizar funcoes que usam unaccent
-- (generate_quiz_slug e generate_unique_username)
-- Substituir unaccent() por extensions.unaccent()
```

---

## PARTE 2: Preparacao da Base de Dados para IA

### 2.1 - Tabela `ai_agent_configs`

Armazena a configuracao do agente IA de cada consultor. Totalmente isolada.

```text
+-----------------------------+
|     ai_agent_configs        |
+-----------------------------+
| id           UUID PK        |
| user_id      UUID FK->users |
| org_id       UUID FK->orgs  |
| is_enabled   BOOLEAN        | -- Super admin controla
| api_provider TEXT            | -- 'openai', 'google', etc
| api_key      TEXT (encrypt)  | -- Chave da API (criptografada)
| model        TEXT            | -- 'gpt-4o', 'gpt-4o-mini'
| agent_name   TEXT            | -- Nome do agente
| description  TEXT            | -- Descricao curta
| persona      TEXT            | -- Persona e papel (ate 2000 chars)
| skills       TEXT            | -- Habilidades (ate 20000 chars)
| products_info TEXT           | -- Info de produtos (ate 20000 chars)
| restrictions TEXT            | -- Restricoes (ate 2000 chars)
| auto_pipeline BOOLEAN       | -- Se move leads automaticamente
| pause_minutes INT            | -- Minutos de pausa ao intervir
| created_at   TIMESTAMPTZ    |
| updated_at   TIMESTAMPTZ    |
+-----------------------------+
```

### 2.2 - Tabela `ai_conversation_state`

Controla o estado da IA em cada conversa individual.

```text
+-------------------------------+
|   ai_conversation_state       |
+-------------------------------+
| id              UUID PK       |
| conversation_id UUID FK->conv |
| user_id         UUID FK->users|
| is_active       BOOLEAN       | -- IA ativa nesta conversa
| paused_until    TIMESTAMPTZ   | -- Pausa temporaria
| paused_by       TEXT           | -- 'manual' ou 'intervention'
| last_ai_msg_at  TIMESTAMPTZ   |
| messages_sent   INT           | -- Contador de msgs da IA
| created_at      TIMESTAMPTZ   |
| updated_at      TIMESTAMPTZ   |
+-------------------------------+
```

### 2.3 - Coluna na tabela `users`

Adicionar `ai_enabled BOOLEAN DEFAULT false` na tabela `users` para o super admin controlar acesso rapidamente.

---

## PARTE 3: Alteracoes no Codigo

### 3.1 - Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/lib/organization-service.ts` | Trocar `.from('users')` por `.from('consultants_public')` nas consultas publicas |
| `src/components/quiz/QuizContainer.tsx` | Idem - usar view publica |

### 3.2 - Arquivos a Criar (preparacao IA - so estrutura)

| Arquivo | Proposito |
|---------|-----------|
| `src/pages/AdminAIConfig.tsx` | Pagina de configuracao da IA do consultor |
| `src/components/admin/AIConfigForm.tsx` | Formulario de configuracao |
| `src/hooks/useAIConfig.ts` | Hook para CRUD da configuracao |

---

## PARTE 4: Resumo da Execucao

A implementacao sera feita em **3 etapas isoladas**:

1. **Etapa 1 (agora):** Correcoes de seguranca (migracoes SQL + update do codigo)
2. **Etapa 2 (proximo):** Criacao das tabelas de IA + coluna ai_enabled + pagina de config
3. **Etapa 3 (futuro):** Edge function do agente IA + integracao com webhook do WhatsApp

Cada etapa e independente e nao quebra funcionalidades existentes.

---

## Detalhes Tecnicos da IA (pesquisa inicial)

Para o agente IA funcionar bem no WhatsApp, a arquitetura sera:

1. **Webhook recebe mensagem** -> verifica se IA esta ativa para aquela conversa
2. **Se ativa:** envia historico + prompt para a API configurada (OpenAI/etc)
3. **Resposta da IA** -> envia via Evolution API como mensagem do consultor
4. **Deteccao de intervencao:** se o consultor envia mensagem manualmente, pausa a IA automaticamente por X minutos
5. **Transcricao de audio:** usar Whisper API (OpenAI) para entender audios recebidos
6. **Visao de imagens:** usar GPT-4o vision para entender imagens recebidas
7. **Pipeline automatico:** IA analisa conversa e sugere/move lead entre quadros

A chave da API sera armazenada criptografada no banco usando `pgcrypto` e so sera descriptografada na edge function (server-side).

