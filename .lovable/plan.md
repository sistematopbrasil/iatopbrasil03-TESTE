

## Plano: Correção do Pipeline Travado + Responsividade Mobile em Todas as Páginas

### Diagnóstico

Analisei todos os arquivos afetados e identifiquei as causas raiz:

---

### 1. Pipeline Travado (não arrasta pro lado)

**Causa raiz**: O `touch-action: pan-x` no container do pipeline (linha 51 de `AdminPipeline.tsx`) e a regra CSS mobile `.pipeline-scroll { touch-action: pan-x }` (index.css) conflitam com o `@hello-pangea/dnd`. A biblioteca precisa de `touch-action: none` nos itens arrastáveis, mas `touch-action: pan-x` no container pai anula isso e trava o drag.

Além disso, o `AdminLayout.tsx` (linha 199) usa `overflow-y-hidden overflow-x-auto` quando `disableVerticalScroll` está ativo, mas isso cria dois eixos de scroll conflitantes.

**Correções**:

- **`AdminPipeline.tsx` linha 51**: Remover `style={{ touchAction: 'pan-x' }}` do container. O scroll horizontal deve vir do `overflow-x: auto` nativo, não do touch-action.

- **`index.css` linhas 225-230**: Remover o bloco `@media (max-width: 767px)` que adiciona `touch-action: pan-x` ao `.pipeline-scroll`. Manter apenas `overscroll-behavior-y: contain` como regra base.

- **`AdminLayout.tsx` linha 199**: Trocar `overflow-y-hidden overflow-x-auto` para apenas `overflow-hidden`. O scroll horizontal é gerenciado pelo `.pipeline-scroll` interno, não pelo container do layout.

- **`PipelineBoard.tsx` linha 298**: Ajustar a altura de `100dvh-160px` para `100dvh-180px` no mobile para dar mais margem e evitar que colunas ultrapassem a viewport.

---

### 2. Agente IA - Todas as abas cortadas no mobile

**Causa raiz**: A `TabsList` (linha 243) usa `w-full max-w-full overflow-x-auto flex flex-nowrap` mas o container pai não tem `overflow-hidden` e os labels das tabs são longos demais para telas pequenas.

**Correções em `AdminAIConfig.tsx`**:

- **Linha 178**: Trocar `overflow-x-hidden` para `overflow-hidden` no container principal.
- **Linhas 243-260**: Encapsular a TabsList em um div com `overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0` para permitir scroll das tabs. Abreviar os labels no mobile: "Identidade" → "ID", "Conhecimento" → "Dados", "Motor IA" → "Motor", "Comportamento" → "Config" usando `hidden sm:inline` / `sm:hidden`. Usar `flex-1` em cada trigger para distribuir o espaço.

---

### 3. Consultores - Tabela cortada no mobile

**Causa raiz**: O container (linha 280) tem `min-w-0 max-w-full` mas falta `overflow-hidden` para conter a tabela.

**Correção em `ConsultantsManagement.tsx`**:
- **Linha 280**: Adicionar `overflow-hidden` ao div principal.

---

### 4. Tráfego - Visão Geral e Contas cortadas no mobile

**Causa raiz**: O container em `AdminTraffic.tsx` (linha 51) usa `overflow-x-hidden` mas os sub-componentes (`TrafficDashboard`, `TrafficAccounts`) têm conteúdo que estoura. O `TrafficPeriodFilter` tem 7 botões + calendário que não cabem em tela pequena.

**Correções**:
- **`AdminTraffic.tsx` linha 51**: Trocar `overflow-x-hidden` para `overflow-hidden min-w-0 max-w-full`.
- **`TrafficDashboard.tsx`**: Já tem `min-w-0` (ok).
- **`TrafficAccounts.tsx`**: Já tem `min-w-0` (ok).

---

### Resumo dos arquivos e linhas exatas

| Arquivo | Linha | Mudança |
|---|---|---|
| `AdminPipeline.tsx` | 51 | Remover `style={{ touchAction: 'pan-x' }}` |
| `index.css` | 225-230 | Remover bloco `@media` com `touch-action: pan-x` do `.pipeline-scroll` |
| `AdminLayout.tsx` | 199 | `overflow-hidden` em vez de `overflow-y-hidden overflow-x-auto` |
| `PipelineBoard.tsx` | 298 | `100dvh-180px` em vez de `100dvh-160px` |
| `AdminAIConfig.tsx` | 178 | `overflow-hidden` no container |
| `AdminAIConfig.tsx` | 243-260 | Tabs com labels abreviados no mobile + scroll horizontal |
| `ConsultantsManagement.tsx` | 280 | Adicionar `overflow-hidden` |
| `AdminTraffic.tsx` | 51 | `overflow-hidden min-w-0 max-w-full` |

