

# Aprimoramentos: Deduplicacao Atomica, Pipeline Mais Rapido, Isolamento de Instancias

## Problemas Identificados

### 1. Mensagens duplicadas persistem (race condition no lock)
O mecanismo atual faz check-then-update (linhas 326-334 e 358-361 do `ai-agent-respond`):
1. Verifica se `last_ai_message_at` tem menos de 10s (check)
2. Se passou, atualiza `last_ai_message_at` (update/lock)

O problema: duas instancias chegam ao passo 1 simultaneamente (em milissegundos), ambas veem o timestamp antigo, ambas passam no check, ambas fazem o lock e ambas respondem. E um problema classico de TOCTOU (Time-of-Check-Time-of-Use).

**Solucao**: Usar uma operacao atomica via database function (RPC). Criar uma funcao SQL que faz o check E o update em uma unica transacao, retornando se conseguiu o "lock" ou nao. Se outra instancia ja fez o lock, retorna false e o agente ignora.

### 2. Pipeline demora para mover para "Qualificado"
A regra deterministica so cobre a transicao "Novos Leads" para "Contato Inicial" (2+ msgs). As transicoes seguintes dependem da IA classificadora que e chamada com `gemini-2.5-flash-lite` e temperatura 0.1. O prompt pede que a IA "considere a progressao" mas nao da sinais claros do que constitui "interesse".

**Solucao**: Adicionar mais regras deterministicas:
- Se o lead tem 5+ mensagens e o lead fez perguntas ou respondeu positivamente, mover para "Qualificado"
- Melhorar o prompt com exemplos concretos de sinais de qualificacao
- Usar um modelo mais capaz para classificacao (gemini-2.5-flash em vez de flash-lite)

### 3. Isolamento entre instancias/consultores
O codigo ja isola por `user_id` na busca de configs (linha 284) e por `conversation_id` no state. Porem, a deduplicacao temporal atual e por `conversation_id` e nao por telefone. Se o mesmo telefone tem conversas em duas instancias diferentes, ambas disparam o AI Agent com `conversation_id` diferentes, e a dedup nao funciona.

**Solucao**: Adicionar deduplicacao por telefone alem de por conversa. Antes de processar, verificar se algum AI Agent ja respondeu para aquele `contact_phone` nos ultimos 10s (independente da instancia/conversa).

---

## Alteracoes Tecnicas

### Alteracao 1: Funcao SQL para lock atomico

Criar uma database function `try_acquire_ai_lock` que:
- Recebe `p_conversation_id` e `p_contact_phone`
- Faz `UPDATE ai_conversation_state SET last_ai_message_at = now() WHERE conversation_id = p_conversation_id AND (last_ai_message_at IS NULL OR last_ai_message_at < now() - interval '10 seconds') RETURNING id`
- Se retornou rows, o lock foi adquirido (retorna true)
- Se nao retornou, outra instancia ja tem o lock (retorna false)
- Tambem verifica por telefone: busca se existe OUTRA conversa com o mesmo telefone que tenha `last_ai_message_at` nos ultimos 10s

### Alteracao 2: `ai-agent-respond/index.ts` - Usar lock atomico

Substituir o check manual (linhas 326-334) e o lock manual (linhas 358-361) por uma unica chamada RPC:

```text
const { data: lockAcquired } = await supabaseAdmin.rpc('try_acquire_ai_lock', {
  p_conversation_id: conversation_id,
  p_contact_phone: contact_phone
});

if (!lockAcquired) {
  console.log('Lock nao adquirido - outra instancia ja esta processando');
  return skip;
}
```

### Alteracao 3: `ai-agent-respond/index.ts` - Pipeline mais agressivo

Adicionar regra deterministica adicional para "Qualificado":
- Se o lead tem 5+ mensagens incoming E o estagio atual e "Contato Inicial" (ou equivalente), mover para "Qualificado"
- Isso garante que leads engajados progridam mais rapido sem depender da IA classificadora
- Manter a IA classificadora como fallback para casos intermediarios

Tambem melhorar o modelo da IA classificadora de `gemini-2.5-flash-lite` para `gemini-2.5-flash` para melhor compreensao.

### Alteracao 4: `crm-webhook/index.ts` - Sem mudancas necessarias

A logica de deteccao de intervencao humana com 45s de janela e verificacao de IDs ja esta adequada. O isolamento de instancia ja existe (busca por `instance_id`).

---

## Resumo

| Problema | Causa | Solucao |
|---|---|---|
| Mensagens duplicadas | Race condition no check-then-update | Lock atomico via funcao SQL |
| Pipeline lento | Regras deterministicas so para 1a transicao | Adicionar regra para "Qualificado" (5+ msgs) e melhorar modelo da IA |
| Isolamento de instancias | Dedup por conversation_id nao cobre mesmo telefone em instancias diferentes | Dedup por telefone via funcao SQL |

