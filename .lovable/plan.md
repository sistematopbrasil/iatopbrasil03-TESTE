
# Correcoes de Layout, Pipeline Automatico e Ranking em Tempo Real

Obrigado pelos elogios! Fico feliz que o Agente IA ja esteja funcionando bem. Vamos resolver os pontos pendentes.

---

## 1. CRM - Espaco vazio na parte de baixo do chat

**Problema:** O container do CRM usa `h-[calc(100vh-64px)]`, mas o `AdminLayout` ja calcula essa altura. No desktop (`md:h-screen`), isso cria um duplo desconto de 64px, deixando espaco vazio embaixo.

**Correcao em `src/pages/AdminCRM.tsx`:**
- Trocar `h-[calc(100vh-64px)]` por `h-full` nos dois lugares onde aparece (linhas 147 e 174)
- O layout pai ja gerencia a altura disponivel

---

## 2. Pipeline - Nao arrasta para o lado

**Problema:** O `AdminLayout.tsx` aplica `overflow-x-hidden` quando `disableVerticalScroll` esta ativo (caso do Pipeline). Isso bloqueia o scroll horizontal dos quadros.

**Correcao em `src/components/admin/AdminLayout.tsx`:**
- Quando `disableVerticalScroll` for true, trocar `overflow-hidden overflow-x-hidden` por `overflow-hidden overflow-x-auto` no container (linha 283)
- Isso libera o arraste horizontal mantendo o vertical travado

---

## 3. Ranking - Nao atualiza automaticamente ao abrir

**Problema:** O hook `useRankingData` tem `staleTime: 60_000` (1 minuto). Se o cache estiver "fresco", o `refetch()` no `useEffect` nao forca uma nova busca.

**Correcao em `src/pages/AdminRanking.tsx`:**
- Trocar `refetch()` por `refetch({ cancelRefetch: true })` com `staleTime` ignorado
- Ou usar `queryClient.invalidateQueries` ao montar o componente para forcar refresh

---

## 4. Pipeline Automatico com IA - Implementacao

**Status atual:** O campo `auto_pipeline` existe no banco e na interface (toggle no Agente IA), mas **nao ha logica implementada** na Edge Function para mover leads automaticamente.

**O que sera feito:**

### 4a. Adicionar secao de configuracao na tela do Agente IA
Em `src/pages/AdminAIConfig.tsx`, na aba "Comportamento", adicionar:
- Toggle "Pipeline Automatico" (ja existe)
- Texto explicativo de como funciona: a IA analisa a conversa e move o lead para o quadro mais adequado com base no interesse demonstrado

### 4b. Implementar logica na Edge Function `ai-agent-respond`
- Apos gerar a resposta da IA, se `auto_pipeline` estiver ativo:
  1. Buscar os stages do pipeline da organizacao
  2. Pedir a IA (no mesmo prompt ou em chamada separada) para classificar o lead com base no historico da conversa
  3. Se a IA sugerir mudanca de stage, atualizar o `pipeline_stage_id` do lead no banco
  4. A mudanca aparece automaticamente no Pipeline (ja tem realtime configurado)

---

## 5. Sobre o que ja esta funcionando

| Funcionalidade | Status |
|:---|:---|
| Agente IA respondendo mensagens | Funcionando |
| Pausa automatica ao intervir manualmente | Corrigido (preserva sent_by_ai) |
| Mensagens separadas (humanizacao) | Implementado |
| Badge de status IA com countdown | Implementado |
| Realtime no CRM (mensagens e conversas) | Habilitado |
| Pipeline drag-and-drop | Funcionando (scroll horizontal a corrigir) |
| Quiz de captacao | Funcionando |
| Ranking de consultores | Funcionando (refresh a corrigir) |
| Analytics | Funcionando |
| Gestao de consultores (super admin) | Funcionando |

---

## Resumo dos arquivos alterados

| Arquivo | Alteracao |
|:---|:---|
| `src/pages/AdminCRM.tsx` | Trocar `h-[calc(100vh-64px)]` por `h-full` |
| `src/components/admin/AdminLayout.tsx` | Permitir `overflow-x-auto` quando disableVerticalScroll |
| `src/pages/AdminRanking.tsx` | Forcar refresh ao montar componente |
| `src/pages/AdminAIConfig.tsx` | Adicionar explicacao do pipeline automatico |
| `supabase/functions/ai-agent-respond/index.ts` | Implementar logica de auto-pipeline |

## Ordem de execucao

1. Correcoes de layout (CRM + Pipeline)
2. Ranking auto-refresh
3. Pipeline automatico (config + edge function)
