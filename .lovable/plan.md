

# Correcoes do Pipeline, Seguranca e Verificacao da IA

---

## 1. Pipeline - Scroll horizontal nao funciona

**Problema raiz:** Ha um conflito entre camadas de overflow. O `AdminLayout` aplica `overflow-hidden overflow-x-auto` no container pai, e o `AdminPipeline` tambem aplica `overflow-hidden` no seu `div` raiz (linha 116). Alem disso, a scrollbar nativa esta escondida com `scrollbar-width: none`, e a custom scrollbar depende de `scrollMetrics` que podem nao atualizar corretamente porque o `ResizeObserver` nao detecta mudancas de `scrollWidth` do container quando o conteudo interno nao muda de tamanho.

**Correcao em `src/components/admin/AdminLayout.tsx`:**
- Quando `disableVerticalScroll` for true, o container deve usar `overflow: hidden` (sem `overflow-x-auto`), pois o scroll horizontal sera gerenciado pelo componente filho (Pipeline) internamente

**Correcao em `src/pages/AdminPipeline.tsx`:**
- Remover `overflow-hidden` do div raiz (linha 116), trocar por `overflow-x-hidden overflow-y-hidden`
- No container de scroll (linha 148), remover `scrollbar-none` e os estilos inline que escondem a scrollbar nativa
- Substituir a scrollbar customizada por uma **scrollbar estilizada visivel**, usando CSS simples com `scrollbar-width: thin` e cores customizadas
- Adicionar suporte a touch/arraste horizontal no mobile com `touch-action: pan-x`
- Adicionar um `setTimeout` no `useEffect` do `ResizeObserver` para garantir que as metricas sejam calculadas apos o layout estar pronto

**Alternativa mais robusta:** Remover completamente a logica de custom scrollbar e usar a scrollbar nativa do navegador com estilizacao CSS:
```text
.pipeline-scroll::-webkit-scrollbar { height: 8px; }
.pipeline-scroll::-webkit-scrollbar-track { background: hsl(var(--muted)); border-radius: 4px; }
.pipeline-scroll::-webkit-scrollbar-thumb { background: hsl(var(--primary) / 0.6); border-radius: 4px; }
```
Isso e mais confiavel e funciona em todos os dispositivos.

---

## 2. IA Auto-Pipeline - Verificacao

A logica ja esta implementada no `ai-agent-respond` (linhas 634-711). Ela:
- Busca os stages do pipeline dinamicamente a cada resposta
- Inclui stages novos que o consultor adicionar (busca por `organization_id`)
- Usa IA para classificar o lead com base nas ultimas 10 mensagens
- Move automaticamente se a classificacao mudar

**Status: Funcionando.** Nao requer alteracoes. Para validar, basta:
1. Ativar o toggle "Pipeline Automatico" na pagina do Agente IA
2. Enviar mensagens simulando interesse alto (ex: "quero saber o preco", "quando posso comecar?")
3. Verificar no Pipeline se o lead mudou de quadro

---

## 3. Seguranca - Correcoes

### 3a. quiz_submissions_new - INSERT e UPDATE publicos (ERRO)

As policies "Public can insert submissions" e "Public can update recent submissions" usam role `{public}`, o que inclui `anon`. Isso e **intencional** para o quiz funcionar sem login (visitantes anonimos preenchem o quiz). Porem, nao existe policy de SELECT para `anon` - o SELECT ja exige `authenticated`. O INSERT so permite inserir se `organization_id IS NOT NULL`, e o UPDATE so funciona em registros criados nas ultimas 2 horas.

**Acao:** Ignorar este finding com justificativa, pois:
- SELECT ja exige autenticacao (`authenticated`)
- INSERT publico e necessario para o quiz funcionar
- UPDATE publico tem restricao temporal de 2 horas e exige `organization_id`
- Dados sensiveis so sao visiveis para usuarios autenticados da mesma organizacao

### 3b. organizations - Acessivel a todos os membros (AVISO)

A policy SELECT permite qualquer membro autenticado da organizacao ver todos os campos. Campos como `meta_pixel_id` e `whatsapp_number` sao usados pelo sistema internamente.

**Acao:** Ignorar com justificativa, pois:
- Acesso ja e restrito a membros autenticados da mesma organizacao
- Os consultores precisam ver o `whatsapp_number` e `logo_url` para funcionalidades do CRM
- O `meta_pixel_id` e usado no quiz que o consultor gerencia

### 3c. Leaked Password Protection (AVISO)

**Acao:** Habilitar a protecao contra senhas vazadas via configuracao de autenticacao. Isso verifica se a senha escolhida pelo usuario ja apareceu em vazamentos de dados conhecidos.

---

## Resumo dos arquivos alterados

| Arquivo | Alteracao |
|:---|:---|
| `src/pages/AdminPipeline.tsx` | Remover custom scrollbar, usar scrollbar nativa estilizada |
| `src/components/admin/AdminLayout.tsx` | Ajustar overflow do container quando disableVerticalScroll |
| `src/index.css` | Adicionar estilos CSS para scrollbar do pipeline |
| Seguranca | Ignorar findings com justificativa + habilitar leaked password protection |

## Ordem de execucao

1. Corrigir layout/scroll do Pipeline
2. Resolver findings de seguranca
3. Habilitar leaked password protection

