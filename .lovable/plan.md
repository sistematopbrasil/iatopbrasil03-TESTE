

# Plano — Separações finais por funil, Quiz/Captura por funil ativo, Pipeline/Ranking/Analytics, Lead morno por contato

Tudo aditivo. Nada de rotas/slugs removidos. Compatibilidade preservada.

---

## 1. CRM — Seletor de quadro só mostra stages do funil correto

**Diagnóstico:** `LeadProfile.tsx` (linhas 79‑91), `ChatWindow.tsx` (82‑86), `CreateLeadFromConversation.tsx` (43‑47) e `ConversationList.tsx` (89‑92) buscam `pipeline_stages` filtrando **só por organização** — sem `funnel_type`. Por isso aparecem todos os quadros (Consultores + Associados) no `Select` quando você troca o quadro do lead.

**Fix:**
- Em todos esses 4 componentes, adicionar `.eq('funnel_type', leadFunnel)` à query.
- O `leadFunnel` vem de `leadData.funnel_type` (preferencial) com fallback para `useFunnel().resolvedFunnel`.
- Incluir `leadFunnel` na `queryKey` para evitar cache cruzado.
- Caso o lead não tenha `funnel_type` definido (legado), usar `resolvedFunnel`.

**Bônus de robustez:** ao mover um lead para um stage de outro funil pelo `handleStageChange`, atualizar também `funnel_type` do lead para combinar com o do stage destino — evita lead "órfão" em funil cruzado.

---

## 2. Ranking — Filtrar consultores por `allowed_funnels`

**Diagnóstico:** `ranking-get` (linhas 91‑100) busca **todos** os consultores ativos da organização, independente do funil. UI exibe sempre o mesmo total.

**Fix em `supabase/functions/ranking-get/index.ts`:**
- Quando `funnel_type === 'consultor'`: filtrar `consultants` para `allowed_funnels` que contém `'consultor'` (= todos que têm pelo menos consultor: dois funis OU só consultor).
- Quando `funnel_type === 'associado'`: filtrar para `allowed_funnels` que contém `'associado'` (= dois funis OU só associado).
- Quando `funnel_type === 'all'`: comportamento atual (todos).
- Aplicado via `.contains('allowed_funnels', [funnelFilter])` no Postgres.

**UI (`AdminRanking.tsx`):**
- Card "Total de Consultores" passa para `Total de {Consultores|Associados|Geral}` conforme `activeFunnel`.

---

## 3. Quiz por funil — Configuração separada

Hoje `quiz_questions` é uma única lista por consultor (compartilhada). Vamos criar **dois conjuntos independentes** mantendo o existente intocado.

### 3.1 Migration aditiva
- Adicionar coluna `funnel_type funnel_type NOT NULL DEFAULT 'consultor'` em `public.quiz_questions`.
- Backfill: todas as perguntas existentes ficam com `funnel_type = 'consultor'` (não muda nada para usuários atuais).
- Atualizar índice/política RLS — políticas atuais dependem só de `consultant_id`, então continuam válidas.
- **Seed automático** (DO block): para cada consultor existente, se não houver perguntas com `funnel_type = 'associado'`, inserir 6 perguntas-padrão de Associado:
  1. "Qual é o seu nome completo?" — `open_text`, `is_default = true`, order 1
  2. "Qual é o seu telefone/WhatsApp para eu te enviar o resultado do seu perfil?" — `open_text`, `is_default = true`, order 2
  3. "Qual a sua idade?" — `open_text`, `is_default = true`, order 3
  4. "Qual a sua cidade e estado?" — `open_text`, `is_default = true`, order 5
  5. "Você possui carro ou moto?" — `multiple_choice`, opções `['Sim, carro.', 'Sim, moto.', 'Possui ambos (carro e moto).', 'Não tenho veículo.']`, order 6
  6. "Você possui CNH (Carteira Nacional de Habilitação)?" — `multiple_choice`, `['Sim, possuo CNH', 'Não possuo CNH eu preciso']`, order 7

### 3.2 Frontend — `QuizQuestionsEditor.tsx`
- Passa a usar `useFunnel().resolvedFunnel` para filtrar e criar perguntas por funil.
- `queryKey: ['quiz-questions', consultant.id, resolvedFunnel]`.
- Insert sempre injeta `funnel_type: resolvedFunnel`.
- Header da seção mostra qual funil está sendo editado: "Perguntas do Quiz — Consultores" / "Perguntas do Quiz — Associados". Remove o aviso atual de "compartilhadas entre funis" (não é mais verdade).

### 3.3 `QuizContainer.tsx` (público)
- Carrega perguntas filtrando por `funnel_type = consultant.quiz_funnel_type` (já existe esse campo, definindo qual funil o quiz alimenta).
- `quiz_funnel_type` continua sendo **um por consultor** — quando o usuário vai a `/quiz/{slug}`, o quiz pega as perguntas do funil escolhido para esse slug.
- Mantém todas as URLs existentes funcionando.

### 3.4 Em `ConsultantSettings → aba Quiz`
- O selector "Funil que o Quiz alimenta" continua existindo. Quando trocar entre Consultor/Associado, o `QuizQuestionsEditor` re-renderiza com o conjunto correto.
- **Aviso novo:** "As perguntas abaixo são exclusivas do funil de {X}. Cada funil tem sua própria lista."

### 3.5 Analytics de Associados — usar campos novos
- `AdminAnalytics.tsx` já filtra por `funnel_type = resolvedFunnel`.
- Para Associados, mostrar SOMENTE donuts úteis: `relationship_status` (estado civil), `has_vehicle`, `has_driver_license`, `lead_source`, e adicionalmente um donut por **cidade/estado** (`location`).
- Esconder donuts de recrutamento (`sales_experience`, `vehicle_protection_experience`, `current_income`, `desired_income`, `employment_status`) — já parcialmente implementado.

---

## 4. Página de captura — também por funil ativo

Hoje a Captura permite ao usuário escolher manualmente "Proteção Veicular" vs "Recrutamento" via 2 botões internos (`pagePurpose`). O usuário pediu para **simplificar**: o funil ativo do sidebar decide qual configuração de página o usuário está editando.

### 4.1 Mapeamento
- `activeFunnel = 'consultor'` → o usuário está configurando a **Página de Recrutamento** (`/r/{slug}`, `page_purpose = 'recruitment'`, leads caem em funil Consultores).
- `activeFunnel = 'associado'` → o usuário está configurando a **Página de Proteção Veicular** (`/c/{slug}`, `page_purpose = 'protection'`, leads caem em funil Associados).
- O slug é o mesmo (`quiz_slug`) — só o prefixo da rota muda. Não criamos slug novo (mantém compat).

### 4.2 Fix em `CaptureSettingsTab` (`ConsultantSettings.tsx`)
- Remove os dois botões internos "Finalidade da Página".
- Lê `useFunnel().resolvedFunnel` e mapeia automaticamente para o `pagePurpose`:
  - `consultor` → `'recruitment'`
  - `associado` → `'protection'`
- Mostra um banner no topo: "Você está editando a página de {Recrutamento de Consultores | Captação de Associados}. Para configurar a outra, troque o funil no menu lateral."
- O link `/c/` ou `/r/` continua sendo mostrado conforme o purpose.
- Mantém o resto do código intacto — query, save, defaults — porque a estrutura `(consultant_id, page_purpose)` já é única por purpose, então as duas configurações coexistem.

### 4.3 Compat
- Configs antigas que o usuário já tinha (uma de cada `page_purpose`) continuam acessíveis. A página `/c/` e `/r/` continuam buscando pela `page_purpose` correta — nenhum link público quebra.

---

## 5. Super Admin — "Todos" como padrão e remover Tabs internas redundantes

### 5.1 `FunnelContext`
- Quando o usuário é super admin **e não tem `last_active_funnel` nem valor no localStorage**, inicializar com `'all'` (em vez de `defaultFunnel`). Para usuários comuns, segue como está.

### 5.2 `AdminSuperAdmin.tsx`
- **Remover as Tabs internas** "