

# Corrigir Classificador de Pipeline (IA retornando texto em vez de nome do quadro)

## Problema Identificado

Os logs mostram que o classificador de IA esta retornando **respostas conversacionais completas** em vez de apenas o nome do quadro. Exemplos reais dos logs:

- `"Vou remover seu contato da nossa lista e voce nao recebera mais mensagens..."` 
- `"Entendo sua desconfianca. E natural ter cautela hoje em dia..."`
- `"De qualquer forma, se um dia voce mudar de ideia..."`

Isso acontece porque o historico da conversa e passado como mensagens `user`/`assistant` normais. O modelo Gemini "continua a conversa" em vez de classificar. O lead qualificado da conversa que voce mostrou (tem carro, trabalha com atendimento, agendou ligacao com gestor) nao foi movido porque a resposta do classificador nao bateu com nenhum nome de quadro.

O descarte por palavras-chave **esta funcionando** (regra deterministica), conforme voce confirmou.

## Solucao

Mudar a forma como o historico e enviado ao classificador. Em vez de enviar como mensagens separadas de `user`/`assistant` (que confunde o modelo), enviar o historico inteiro como **texto plano dentro da mensagem do sistema**, seguido de uma unica mensagem `user` pedindo a classificacao.

### Mudanca no arquivo `supabase/functions/ai-agent-respond/index.ts`

Substituir o bloco do classificador (linhas 760-788) por:

```text
// Montar historico como texto plano para evitar que o modelo "continue" a conversa
const historyText = conversationHistory.slice(-15).map((m) => {
  const sender = m.role === 'user' ? 'LEAD' : 'CONSULTOR';
  return `[${sender}]: ${m.content || '(midia)'}`;
}).join('\n');

const classificationMessages = [
  {
    role: 'user',
    content: `Voce e um classificador de leads. Analise o historico abaixo e responda SOMENTE com o nome exato de um dos quadros permitidos. Nenhuma outra palavra.

QUADROS PERMITIDOS: ${allowedStageNames}
${blockedStageNames ? `QUADROS BLOQUEADOS (NUNCA usar): ${blockedStageNames}` : ''}
QUADRO ATUAL: ${currentStage ? `"${currentStage.name}"` : 'nenhum'}

REGRAS:
1. Para "Qualificado" ou equivalente: o lead demonstrou interesse real (motivacao, agendou conversa, pediu detalhes) E tem pelo menos UM requisito (veiculo, experiencia profissional, disponibilidade).
2. Para "Descartado" ou equivalente: o lead disse explicitamente que nao quer.
3. Na duvida, responda com o quadro atual: "${currentStage?.name || 'Contato Inicial'}".

HISTORICO DA CONVERSA:
${historyText}

Responda APENAS o nome do quadro. Nada mais.`,
  },
];
```

Essa mudanca:
- Envia tudo como uma unica mensagem `user`, eliminando a confusao de roles
- O historico vira texto plano com prefixos `[LEAD]` e `[CONSULTOR]`
- O prompt e mais direto e assertivo sobre o formato da resposta
- Inclui as ultimas 15 mensagens (em vez de 10) para dar mais contexto em conversas longas como a que voce testou

## Resumo

| Item | Mudanca |
|---|---|
| Classificador retornando texto | Reescrever prompt para enviar historico como texto plano em vez de mensagens chat |
| Lead qualificado nao movido | Corrigido pelo novo formato que evita confusao do modelo |
| Lead descartado | Ja funciona (regra deterministica por keywords) |

