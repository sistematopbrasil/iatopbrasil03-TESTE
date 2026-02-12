
# Correcao: Mensagens Duplicadas, Pausa Indevida e Pipeline

## Diagnostico Detalhado

### Problema 1: Mensagens duplicadas (CAUSA RAIZ ENCONTRADA)
Existem **duas instancias WhatsApp conectadas simultaneamente** (David `davidmljjs` e Breno `brenomlazv`). O mesmo numero de telefone (5533984109171) tem conversas em AMBAS as instancias. Quando uma mensagem chega, o webhook dispara para AMBAS, e cada uma aciona seu proprio AI Agent. Resultado: a pessoa recebe 2 respostas.

**Correcao**: No `ai-agent-respond`, antes de processar, verificar se a conversa pertence a instancia que o consultor realmente usa. Tambem no `crm-webhook`, ao disparar o AI Agent, garantir que apenas UMA instancia processe cada mensagem. Porem, isso e um problema de configuracao (duas instancias para o mesmo numero), entao tambem sera tratado no codigo para que, se a IA ja tiver respondido nos ultimos 10 segundos para aquela conversa, a segunda chamada seja ignorada (deduplicacao temporal).

### Problema 2: IA sendo pausada sem intervencao humana (CAUSA RAIZ ENCONTRADA)
Quando a IA envia mensagem via Evolution API, o ID da mensagem e gerado pelo WhatsApp (ex: `3EB0571E3F1AB7...`) - NAO tem prefixo `ai-`. O fallback de prefixo nunca funciona. O fallback temporal de 15 segundos tambem falha porque:
- A IA envia mensagens em partes (2-4 partes com 1-2s entre elas)
- `last_ai_message_at` e atualizado ANTES de enviar as partes
- As partes levam 3-8 segundos para serem todas enviadas
- Os webhooks da Evolution API para essas mensagens outgoing chegam DEPOIS dos 15 segundos

**Correcao**: 
1. Ampliar a janela temporal de 15 para 45 segundos (as partes demoram)
2. Salvar TODOS os message_ids das partes enviadas pela IA em um campo `ai_message_ids` no `ai_conversation_state` 
3. No webhook, verificar se o message_id esta na lista de IDs conhecidos da IA
4. Atualizar `last_ai_message_at` DEPOIS de enviar todas as partes (nao antes)

### Problema 3: Pipeline nao move para "Contato Inicial"
Os logs mostram "Lead mantido no quadro atual" em TODOS os casos. A IA classificadora esta retornando o mesmo quadro que o lead ja esta. Problemas identificados:
- O `leadMessageCount` conta mensagens do historico que ja inclui a mensagem atual
- A IA classifica corretamente mas o matching pode falhar se o nome retornado tiver espacos extras ou variacao
- A IA precisa ser instruida mais explicitamente a considerar a PROGRESSAO (se ja esta em Novos Leads e tem 2+ msgs, DEVE mover)

---

## Alteracoes Tecnicas

### Arquivo 1: `supabase/functions/ai-agent-respond/index.ts`

**Mudanca A - Deduplicacao temporal (evitar dois agentes respondendo):**
Antes de processar qualquer coisa, verificar se ja houve resposta da IA para esta conversa nos ultimos 10 segundos. Se sim, ignorar (outra instancia ja respondeu).

```text
// Apos verificar ai_state (passo 3), antes do passo 4:
if (aiState?.last_ai_message_at) {
  const diff = Date.now() - new Date(aiState.last_ai_message_at).getTime();
  if (diff < 10000) { // 10 segundos
    console.log('Rate limit: outra instancia ja respondeu');
    return skip;
  }
}
```

**Mudanca B - Atualizar `last_ai_message_at` DEPOIS de enviar todas as partes:**
Mover o update de `last_ai_message_at` para DEPOIS do loop de envio das partes (linha 563-571 atual), nao antes. Isso garante que a janela temporal no webhook comeca a contar a partir do ULTIMO envio.

**Mudanca C - Salvar lista de message_ids enviados pela IA:**
Apos enviar todas as partes, salvar os IDs no `ai_conversation_state` para que o webhook possa verificar.

**Mudanca D - Pipeline mais assertivo:**
Ajustar o prompt de classificacao para ser mais direto:
- Se leadMessageCount >= 2 E estagio atual e "Novos Leads" -> DEVE retornar "Contato Inicial"
- Adicionar instrucao explicita: "Se o lead esta em 'Novos Leads' e ja respondeu 2 ou mais mensagens, mova para 'Contato Inicial'"

### Arquivo 2: `supabase/functions/crm-webhook/index.ts`

**Mudanca E - Verificacao robusta de mensagem da IA:**
1. Ampliar janela temporal de 15 para 45 segundos
2. Verificar se o message_id esta na lista `last_ai_message_ids` do ai_conversation_state
3. Esses dois metodos combinados eliminam os falsos positivos

### Migracao de banco (opcional mas recomendada)
Adicionar coluna `last_ai_message_ids` (jsonb, default '[]') na tabela `ai_conversation_state` para armazenar os IDs das ultimas mensagens enviadas pela IA.

---

## Resumo das correcoes

| Problema | Causa | Solucao |
|---|---|---|
| Mensagens duplicadas | 2 instancias WhatsApp respondem ao mesmo tempo | Rate limit temporal de 10s entre respostas + deduplicacao |
| IA pausada indevidamente | Message IDs do WhatsApp nao tem prefixo `ai-` e janela de 15s e curta demais | Ampliar para 45s + salvar lista de IDs da IA no banco |
| Pipeline nao move | Prompt de classificacao nao e assertivo o suficiente | Regras deterministicas: se 2+ msgs e esta em "Novos Leads", mover para "Contato Inicial" |
