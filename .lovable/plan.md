

## Plano: Correções de Responsividade Mobile, Pipeline e Segurança

### Diagnóstico Completo

Após análise detalhada do código e scan de segurança (15 findings), identifiquei os seguintes problemas:

---

### 1. Pipeline - Scroll vertical persistente no mobile

**Causa raiz**: O container pai na `AdminLayout` (linha 142) tem `min-h-screen` que permite ao body expandir verticalmente. Mesmo com `overflow-y-hidden` no content div, o wrapper externo não bloqueia o scroll. Além disso, a interação de touch nos cards do pipeline ainda permite gestos verticais.

**Correções**:
- `AdminLayout.tsx`: Quando `disableVerticalScroll`, o wrapper externo deve usar `h-dvh overflow-hidden` em vez de `min-h-screen` para bloquear qualquer scroll vertical no nível do body
- `AdminPipeline.tsx`: Adicionar `touch-action: pan-x` explicitamente no container do pipeline board via style inline
- `PipelineBoard.tsx`: Reduzir altura das colunas no mobile para `h-[calc(100dvh-160px)]` usando `dvh` em vez de `vh` para compatibilidade com barras de navegação do browser mobile
- `index.css`: Reforçar regra mobile `.pipeline-scroll` com `overscroll-behavior: none` (bloquear em ambas direções no container)

### 2. Página do Agente IA - Conteúdo cortado no mobile

**Causa raiz**: Os `Textarea` com `rows={6}` e `rows={8}` estouram a largura em telas pequenas. Os cards não têm `overflow-hidden` e o conteúdo dos tabs pode ser mais largo que a viewport.

**Correções em `AdminAIConfig.tsx`**:
- Adicionar `min-w-0` no container principal e em cada `TabsContent`
- Cards que contêm textareas: adicionar `overflow-hidden` no `CardContent`
- Garantir que `TabsList` tenha `max-w-full` para não estourar

### 3. Página de Consultores - Tabela cortada no mobile

**Causa raiz**: A tabela tem muitas colunas e embora use `overflow-x-auto`, o container pai em `ConsultantsManagement.tsx` (linha 280) já tem `overflow-x-hidden` que conflita.

**Correção em `ConsultantsManagement.tsx`**:
- Remover `overflow-x-hidden` do container pai (linha 280) ou mover para o nível correto
- A tabela em `div className="overflow-x-auto"` (linha 326) precisa de `min-w-0` no pai para funcionar corretamente
- Adicionar `min-w-0` no container `space-y-6`

### 4. Instagram Insights - Aba Análises cortada no mobile

**Causa raiz**: O componente `InstagramAnalytics` tem cards com layout flexbox nos itens do ranking onde `MiniSparkline` (width=60px fixo) compete com texto, causando overflow.

**Correções em `InstagramAnalytics.tsx`**:
- Esconder `MiniSparkline` em telas muito pequenas com `hidden sm:block`
- Adicionar `min-w-0` nos containers flex para permitir truncamento

### 5. Tráfego - Visão Geral cortada no mobile

**Causa raiz**: `TrafficDashboard` tem gráficos `ResponsiveContainer` que funcionam, mas o `TrafficPeriodFilter` e a barra de filtros podem gerar overflow horizontal.

**Correções em `TrafficDashboard.tsx`**:
- Adicionar `min-w-0` no container principal
- Garantir que a barra de filtros faça wrap correto em mobile com `flex-wrap`

### 6. Tráfego - Aba Contas cortada no mobile  

**Causa raiz**: A tabela em `TrafficAccounts` é larga e o `overflow-x-auto` funciona, mas o container pai pode estar limitando.

**Correção em `TrafficAccounts.tsx`**:
- Adicionar `min-w-0` no container principal da div

---

### 7. Segurança - Correções críticas (SQL Migration)

Foram identificados **6 erros críticos** e **5 warnings**. As correções prioritárias:

**7a. `quiz_submissions_new` SELECT - Super admin vê dados de TODAS as organizações**
- Alterar policy para: `consultant_id = get_current_consultant_id() OR (is_super_admin() AND organization_id = get_user_organization_id())`

**7b. `quiz_submissions` (legacy) SELECT - Qualquer pessoa pode ler TODOS os dados**  
- Alterar de `USING (true)` para `USING (organization_id = get_user_organization_id())` com role `authenticated`

**7c. `crm_messages` e `whatsapp_instances` - Super admin sem escopo de organização**
- Adicionar `AND organization_id = get_user_organization_id()` nas policies que usam `is_super_admin()` sem escopo

**7d. `ai_agent_configs` - Chave API exposta no SELECT**
- Criar policy que exclui `api_key_encrypted` do SELECT não é possível via RLS. Documentar como risco aceito (a chave é criptografada).

---

### Resumo dos arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/admin/AdminLayout.tsx` | `h-dvh overflow-hidden` quando `disableVerticalScroll` |
| `src/pages/AdminPipeline.tsx` | `touch-action: pan-x` inline style |
| `src/components/crm/PipelineBoard.tsx` | Altura `100dvh-160px`, melhor calc |
| `src/index.css` | `overscroll-behavior: none` no `.pipeline-scroll` mobile |
| `src/pages/AdminAIConfig.tsx` | `min-w-0`, `overflow-hidden` nos cards |
| `src/pages/ConsultantsManagement.tsx` | Remover conflito de overflow, `min-w-0` |
| `src/components/instagram/InstagramAnalytics.tsx` | Sparkline hidden em mobile pequeno |
| `src/components/traffic/TrafficDashboard.tsx` | `min-w-0` no container |
| `src/components/traffic/TrafficAccounts.tsx` | `min-w-0` no container |
| Migração SQL | Corrigir RLS policies com escopo de organização |

