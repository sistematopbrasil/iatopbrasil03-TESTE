

## Plano: Correções de Segurança, Responsividade Mobile e Melhorias de UX

### 1. Segurança

**1a. Tabela `quiz_submissions` com RLS ativado mas sem policies**
- Adicionar policies SELECT/INSERT/UPDATE para a tabela `quiz_submissions` (provavelmente tabela legada - precisa de ao menos uma policy para nao bloquear acesso)

**1b. Leaked Password Protection desabilitado**
- Nota: Esta configuração é gerenciada no painel do backend e não pode ser alterada via código. Sera documentado como ponto de atenção.

### 2. Pipeline - Scroll horizontal sem scroll vertical (mobile)

**Problema**: No mobile, o pipeline faz scroll vertical alem do horizontal, e a pagina toda desce. Isso acontece porque os cards dentro de cada coluna usam `ScrollArea` do Radix que pode conflitar com o layout flex. Alem disso, a altura `h-[calc(100%-8px)]` pode nao funcionar bem no mobile.

**Correcoes**:
- Em `PipelineBoard.tsx`: Reduzir altura dos cards no mobile com classes responsivas. Trocar `h-[calc(100%-8px)]` para uma altura fixa menor no mobile: `h-[calc(100vh-180px)] md:h-[calc(100%-8px)]`
- Em `AdminLayout.tsx`: Garantir que quando `disableVerticalScroll` estiver ativo, o container main usa `overflow-y-hidden` tambem na versao mobile (atualmente ja faz, mas o calculo de `h-[calc(100vh-64px)]` pode estar incorreto)
- Em `AdminPipeline.tsx`: Adicionar `touch-action: pan-x` no container do pipeline para mobile, garantindo que o touch so rola horizontalmente
- Adicionar CSS: `.pipeline-scroll { -webkit-overflow-scrolling: touch; overscroll-behavior-y: contain; }` para conter o scroll vertical no container

### 3. Responsividade Mobile - Paginas de Trafego

**Problema**: Conteudo cortado nas paginas de trafego no mobile (configuracoes, campanhas).

**Correcoes em `TrafficSettings.tsx`**:
- Ja usa `grid-cols-1 lg:grid-cols-2` - ok no mobile
- Verificar que Cards nao ultrapassem a largura da tela com `overflow-hidden` e `max-w-full`

**Correcoes em `CampaignsTab.tsx`**:
- O container desktop com `height: calc(100vh - 260px)` causa problemas no mobile porque nao ha espaco suficiente
- Remover a altura fixa do container quando em mobile (ja usa tabs separadas no mobile, entao nao deve ter problema)

**Correcoes em `AdminTraffic.tsx`**:
- Adicionar `overflow-x-hidden` ao container principal

### 4. Responsividade Mobile - Instagram Insights

**Problema**: Conteudo cortado no mobile.

**Correcao em `AdminInstagram.tsx`**:
- Adicionar `overflow-x-hidden` ao container
- Garantir que graficos e tabelas tenham `min-w-0` para nao estourar

### 5. Responsividade Mobile - Agente IA (Painel do Consultor)

**Problema**: Pagina de configuracao do Agente IA fica cortada no mobile.

**Correcoes em `AdminAIConfig.tsx`**:
- Remover `max-w-6xl` que pode estar limitando a largura em telas menores de forma estranha
- Garantir que os grids `grid-cols-3` de stats mudem para `grid-cols-1 sm:grid-cols-3` no mobile
- TabsList: ja usa `overflow-x-auto` - verificar se funciona corretamente
- Cards de configuração com Textareas: garantir `overflow-hidden` no container pai

### 6. Toggle global de IA para o consultor

**Problema**: O consultor pode ter a IA ativada pelo admin, mas quer poder desativar temporariamente.

**Implementacao**:
- Na pagina `AdminAIConfig.tsx`, adicionar um Switch no topo "Ativar/Desativar Agente IA" que altera um campo na tabela `ai_config` (ou cria um campo `is_globally_active` no `ai_config`)
- Alternativa mais simples: usar o campo `auto_reply` ja existente na config como toggle principal - quando desativado, a IA nao responde automaticamente
- **Melhor opcao**: Adicionar um card proeminente no topo da pagina do Agente IA com um Switch "Agente IA Ativo" que salva no `ai_config.auto_reply`. O label explica: "Quando desativado, a IA nao responde automaticamente"
- Isso ja existe na aba "Comportamento" como "Resposta Automatica", mas pode nao ser obvio. Vamos adicionar um switch mais visivel no topo da pagina, antes das tabs, controlando `auto_reply`

### 7. Novo consultor nao aparece na lista sem atualizar

**Problema**: `CreateConsultantDialog` invalida `['all-consultants']` mas `ConsultantsManagement` usa `['all-consultants-management']`.

**Correcao em `CreateConsultantDialog.tsx`**:
- Adicionar `queryClient.invalidateQueries({ queryKey: ['all-consultants-management'] })` no `onSuccess`
- Manter o `['all-consultants']` existente para compatibilidade com `ConsultantsTable` do Super Admin

### 8. CampaignEditDialog - X sobrepondo toggle

**Problema**: O botao X de fechar o dialog fica sobreposto ao switch de ativar/desativar campanha (visivel no print).

**Correcao em `CampaignEditDialog.tsx`**:
- Mover o switch de status da campanha para ABAIXO do titulo, em vez de ao lado direito onde compete com o X do dialog
- Reorganizar o header: titulo na esquerda, badge de status + switch abaixo, X do dialog fica no canto superior direito sem conflito

### 9. Responsividade geral - overflow protection

Adicionar protecoes globais:
- Em `AdminLayout.tsx`: adicionar `overflow-x-hidden` no container `main` para prevenir scroll horizontal acidental em todas as paginas (exceto quando `disableVerticalScroll` esta ativo para o pipeline)

---

### Resumo dos arquivos afetados

| Arquivo | Mudanca |
|---|---|
| `src/components/crm/PipelineBoard.tsx` | Altura responsiva, touch-action |
| `src/pages/AdminPipeline.tsx` | Ajustes de overflow mobile |
| `src/index.css` | CSS de overscroll-behavior para pipeline |
| `src/components/admin/AdminLayout.tsx` | overflow-x-hidden global |
| `src/components/traffic/CampaignsTab.tsx` | Altura fixa apenas no desktop |
| `src/components/traffic/CampaignEditDialog.tsx` | Reposicionar switch longe do X |
| `src/pages/AdminAIConfig.tsx` | Toggle global de IA, grid responsivo stats, remover max-w |
| `src/pages/AdminInstagram.tsx` | overflow protection |
| `src/pages/AdminTraffic.tsx` | overflow protection |
| `src/components/super-admin/CreateConsultantDialog.tsx` | Corrigir query key para atualizar lista |
| Migracao SQL | Policy para tabela `quiz_submissions` |

