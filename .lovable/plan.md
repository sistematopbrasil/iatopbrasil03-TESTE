
# Correcao dos Bugs da IA: Mensagens Duplicadas, Pausa Indevida e Pipeline

---

## Problema 1: Mensagens duplicadas e antigas

**Causa raiz**: O webhook salva a mensagem no banco e depois dispara o AI Agent. O AI Agent busca as ultimas 20 mensagens do banco (que ja inclui a mensagem atual) e depois adiciona a mesma mensagem novamente no array da API (linha 516). Resultado: a mensagem do usuario aparece duplicada para a IA, que responde de forma confusa.

Alem disso, a greeting message e enviada toda vez que `ai_conversation_state` nao existe para aquela conversa, mesmo que a conversa ja tenha historico anterior.

**Correcao no `ai-agent-respond/index.ts`**:
- Ao buscar historico, verificar se a ultima mensagem do historico ja contem a mensagem atual. Se sim, nao adicionar novamente
- Mudar a logica de `isNewConversation`: verificar se a conversa tem 0 mensagens no historico (nao apenas se o ai_state existia)
- Limitar o historico enviado a IA para que nao puxe mensagens muito antigas (apenas mensagens das ultimas 24 horas)

---

## Problema 2: IA sendo pausada sem intervencao humana

**Causa raiz**: Quando a IA envia uma mensagem via Evolution API, o WhatsApp gera um evento `send_message` que volta ao webhook. O webhook verifica se a mensagem no banco tem `sent_by_ai=true` no metadata, mas ha uma condicao de corrida: o evento do webhook pode chegar antes da IA ter salvo a mensagem no banco, ou o upsert sobrescreve o metadata original.

**Correcao no `crm-webhook/index.ts`**:
- Adicionar um delay/retry na verificacao de `sent_by_ai` para mensagens outgoing
- Verificar se a mensagem foi enviada nos ultimos 10 segundos E se existe um `ai_conversation_state` ativo para essa conversa. Se ambos forem verdade, considerar como mensagem da IA e NAO pausar
- Adicionar prefixo no message_id da IA (`ai-`) para facilitar a identificacao sem depender do metadata

---

## Problema 3: Lead nao move para "Contato Inicial"

**Causa raiz**: O prompt de classificacao do auto-pipeline (linha 664-678) usa criterios vagos como "primeiros quadros" e "quadros intermediarios". A IA nao entende a logica especifica do negocio.

**Correcao no `ai-agent-respond/index.ts`**:
- Reescrever o prompt de classificacao com regras claras e explicitas:
  - **Novo Lead**: Lead acabou de entrar, enviou primeira mensagem mas ainda nao respondeu
  - **Contato Inicial**: Lead comecou a responder as mensagens (qualquer resposta apos a primeira)
  - **Qualificado**: Lead demonstrou interesse claro (fez perguntas sobre a oportunidade, pediu mais informacoes, mostrou entusiasmo)
  - **Descartado**: Lead disse explicitamente que nao quer, nao tem interesse, pediu para parar
- Adicionar regra de exclusao: a IA NUNCA deve mover para quadros que contenham "Novos Consultores" ou "Convertido" pois esses sao de confirmacao manual
- Buscar os quadros do pipeline dinamicamente (ja faz isso) e incluir no prompt a instrucao de que quadros novos adicionados pelo usuario devem ser interpretados pelo nome
- Adicionar a lista de quadros proibidos para movimentacao automatica (Novos Consultores, Convertidos)

---

## Problema 4: IA deve conhecer quadros dinamicamente

**Ja funciona parcialmente**: A IA ja busca os stages do banco (linha 646-651). Porem o prompt precisa ser mais inteligente.

**Correcao**:
- Incluir no prompt de classificacao uma instrucao para que a IA interprete o significado de cada quadro pelo nome
- Manter uma lista de quadros "bloqueados" para movimentacao automatica (que so humanos podem usar)
- Passar o historico completo dos quadros com seus nomes para a IA poder tomar decisoes informadas

---

## Resumo das alteracoes

| Arquivo | Alteracao |
|:---|:---|
| `supabase/functions/ai-agent-respond/index.ts` | Corrigir duplicacao de mensagens no historico, melhorar logica de greeting, reescrever prompt do auto-pipeline com regras claras e quadros bloqueados |
| `supabase/functions/crm-webhook/index.ts` | Corrigir deteccao de intervencao humana para nao pausar quando a IA envia mensagens, usar verificacao mais robusta com fallback temporal |

---

## Detalhes tecnicos

### ai-agent-respond - Historico sem duplicacao
```text
Antes:
  1. Busca ultimas 20 mensagens do banco (inclui a atual)
  2. Adiciona processedMessage como nova mensagem user
  Resultado: mensagem duplicada

Depois:
  1. Busca ultimas 20 mensagens do banco
  2. Filtra mensagens das ultimas 24h apenas
  3. Verifica se a ultima mensagem do historico tem o mesmo conteudo que processedMessage
  4. Se sim, nao adiciona novamente
  5. Se nao, adiciona processedMessage
```

### crm-webhook - Deteccao de intervencao humana
```text
Antes:
  1. Mensagem outgoing chega
  2. Verifica metadata.sent_by_ai no banco
  3. Se nao encontra (race condition) -> pausa IA

Depois:
  1. Mensagem outgoing chega
  2. Verifica metadata.sent_by_ai no banco
  3. Se nao encontra, verifica:
     a. O message_id comeca com "ai-"? -> e da IA, nao pausar
     b. Existe ai_conversation_state ativo com last_ai_message_at nos ultimos 15 segundos? -> provavelmente e da IA, nao pausar
  4. So pausa se nenhuma das verificacoes indicar mensagem da IA
```

### ai-agent-respond - Prompt do auto-pipeline
```text
Novo prompt com regras explicitas:
- Quadros BLOQUEADOS (so humano move): Novos Consultores, Convertidos
- Regras claras por quadro baseadas no comportamento do lead
- Instrucao para interpretar quadros novos pelo nome
- Contexto do estagio atual para evitar movimentos desnecessarios
```
