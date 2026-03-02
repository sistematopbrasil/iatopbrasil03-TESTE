

## Plano de Melhorias — 5 itens

### 1. Botão de voltar no detalhe do perfil Instagram
O detalhe do perfil abre em um `Sheet` (painel lateral). Falta um botão de voltar/fechar visível no topo.

**Ação**: Adicionar um header no `InstagramProfileDetail.tsx` com botão `ArrowLeft` + "Voltar" que chama `onClose()`, posicionado antes do avatar.

---

### 2. Barra de seleção dos consultores saindo da tela (mobile)
A barra de ações em massa (linha 292-319 de `ConsultantsManagement.tsx`) usa `flex items-center justify-between` sem controle de overflow. Em telas pequenas, os botões "Limpar" e "Excluir Selecionados" extrapolam.

**Ação**: Mudar o layout da barra de ações para empilhar em mobile (`flex-col sm:flex-row`), com botões usando `w-full sm:w-auto` e textos menores em mobile. Garantir `overflow-hidden` no container.

---

### 3. Barra preta na parte inferior do painel consultor
O `AdminLayout` tem um container com `h-[calc(100dvh-64px)]` (linha 197). Em alguns dispositivos/navegadores, o cálculo de `dvh` pode gerar uma faixa preta visível. Isso acontece especialmente em iOS Safari quando a barra de endereço aparece/desaparece.

**Ação**: Adicionar `bg-background` ao container de conteúdo (linha 196-204) para que qualquer espaço residual tenha a cor correta em vez de preto.

---

### 4. Botões do Agente IA — remover sticky, colocar inline
Atualmente os botões "Testar Configuração" e "Salvar Configurações" estão com `sticky bottom-4` (linha 613), ficando visíveis o tempo todo. O usuário quer que apareçam apenas no final da página, após o conteúdo.

**Ação**: Remover `sticky bottom-4` e a `shadow-lg bg-background` dos botões. Colocá-los como um bloco normal no fluxo do documento, após o `Tabs` e o resultado do teste. Remover o `pb-24` do container principal que existia para compensar o sticky.

---

### 5. Melhorar carregamento — pré-carregar dados de Consultores e Agente IA
O `usePrefetchAdminData` já pré-carrega muitos dados, mas falta:
- **Consultores** (`ConsultantsManagement`): Não está pré-carregado. Essa página faz queries pesadas (N+1 por consultor). Vamos pré-carregar via a query key `all-consultants-management`.
- **Agente IA** (`AdminAIConfig`): O `ai-agent-config` já é pré-carregado, mas o `current-user-ai` e `ai-usage-stats` não. Vamos adicionar essas query keys ao prefetch.

**Ação**: No `usePrefetchAdminData.ts`, adicionar prefetch para:
- `current-user-ai` → reutilizar `currentUser` já disponível
- `ai-usage-stats` → buscar `ai_conversation_state` em background
- Dados de consultores (para super admins) com métricas básicas

