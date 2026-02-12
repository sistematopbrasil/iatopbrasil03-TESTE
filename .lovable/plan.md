

# Melhorias: Modelos IA, Descarte Automatico, Pipeline Realtime e Scroll

## 1. Limpar opcoes de modelos de IA

**Problema**: Existem modelos gratuitos (via Lovable AI) que nao funcionam bem ou cortam textos, e modelos GPT aparecem como gratuitos.

**Solucao**: Na lista de modelos do provedor "Lovable AI (Incluso)", manter apenas os que realmente funcionam:
- **Manter**: `google/gemini-3-flash-preview` (Gemini 3 Flash - o que voce usa e funciona)
- **Manter**: `google/gemini-2.5-flash` (Gemini 2.5 Flash - funciona bem)
- **Remover**: `google/gemini-2.5-pro`, `openai/gpt-5-mini`, `openai/gpt-5-nano` (GPT so com API propria)

Para os provedores com API Key propria (OpenAI, Google, Anthropic), mantemos todas as opcoes pois o usuario esta usando sua propria chave.

**Sobre o Gemini 3 Flash**: E um modelo gratuito incluso no plano, com limites de requisicoes por minuto por workspace. Se o volume de uso for muito alto, pode haver rate limiting (erro 429). O modelo e rapido, tem boa capacidade de raciocinio e compreensao de texto, ideal para atendimento via WhatsApp.

**Arquivos**: `src/pages/AdminAIConfig.tsx` (linhas 119-141), `supabase/functions/ai-agent-test/index.ts`

---

## 2. Regra de descarte automatico no pipeline

**Problema**: Quando o lead diz que nao tem interesse, o pipeline nao move para "Descartados".

**Solucao**: Adicionar uma regra deterministica no `ai-agent-respond` que detecta sinais claros de desinteresse e move o lead para o quadro "Descartados":
- Palavras-chave no historico: "nao tenho interesse", "nao quero", "nao preciso", "para de mandar", "nao me interessa", "desisto"
- Se detectado, mover direto para o stage "Descartados" (ou equivalente)
- Essa verificacao sera feita ANTES da classificacao por IA, para ser mais rapida

**Arquivo**: `supabase/functions/ai-agent-respond/index.ts` (secao auto-pipeline, apos linha 707)

---

## 3. Pipeline com atualizacao em tempo real

**Problema**: O pipeline so atualiza ao recarregar a pagina.

**Situacao atual**: Ja existe uma subscription realtime na `PipelineBoard.tsx` (linhas 47-62) para `quiz_submissions_new`, mas ela escuta apenas eventos gerais (`*`). O problema e que tambem precisamos escutar mudancas na tabela `pipeline_stages` para refletir reorganizacoes.

**Solucao**: A subscription ja existe e deveria funcionar. O problema pode ser que as atualizacoes feitas pelo edge function (via service role key) nao disparam o evento realtime para o cliente. Vamos garantir que:
- A tabela `quiz_submissions_new` esteja na publicacao `supabase_realtime` (verificar/adicionar)
- A subscription tenha filtro por `organization_id` para eficiencia

**Arquivo**: `src/components/crm/PipelineBoard.tsx` (linhas 47-62)

---

## 4. Remover scroll vertical do Pipeline

**Problema**: O pipeline tem barra de scroll vertical desnecessaria.

**Causa**: No `AdminPipeline.tsx` linha 50, a classe `overflow-y-auto` esta sobrescrevendo o CSS `.pipeline-scroll` que ja define `overflow-y: hidden !important`.

**Solucao**: Remover `overflow-y-auto` da div do pipeline no `AdminPipeline.tsx`, deixando apenas `overflow-x-auto` (que ja e coberto pelo CSS `.pipeline-scroll`).

**Arquivo**: `src/pages/AdminPipeline.tsx` (linha 50)

---

## Resumo de Arquivos a Editar

| Arquivo | Alteracao |
|---|---|
| `src/pages/AdminAIConfig.tsx` | Remover modelos GPT e Gemini Pro da lista "Lovable AI" |
| `supabase/functions/ai-agent-respond/index.ts` | Adicionar regra de descarte automatico por palavras-chave |
| `src/components/crm/PipelineBoard.tsx` | Garantir realtime funcional |
| `src/pages/AdminPipeline.tsx` | Remover `overflow-y-auto` |
| Migracao SQL | Adicionar `quiz_submissions_new` ao `supabase_realtime` se necessario |
