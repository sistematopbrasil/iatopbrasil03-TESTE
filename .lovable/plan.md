

# Correcoes: Super Admin Realtime, Botao Testar IA, Qualificacao e Descarte

## 1. Consultor novo nao aparece na lista do Super Admin

**Problema**: O `CreateConsultantDialog` invalida a query `['all-consultants']` apos criar, mas o `ConsultantsTable` usa o hook `useRankingData()` que busca dados com a query key `['unified-ranking']`. As keys nao coincidem, entao a lista nao atualiza.

**Solucao**: No `onSuccess` do `CreateConsultantDialog`, adicionar `queryClient.invalidateQueries({ queryKey: ['unified-ranking'] })` para que a tabela de consultores atualize imediatamente.

**Arquivo**: `src/components/super-admin/CreateConsultantDialog.tsx` (linha 92)

---

## 2. Botao "Testar Configuracao" - visual e funcionalidade

**Problema visual**: O botao com `variant="outline"` no sticky bottom fica com fundo transparente, parecendo estranho ao sobrepor conteudo.

**Problema funcional**: O botao chama a edge function `ai-agent-test` usando apenas a anon key no header de autorizacao (linha 149), mas a funcao precisa do token do usuario autenticado para funcionar corretamente em contextos onde JWT e verificado.

**Solucao**:
- Adicionar `bg-background` ao botao para garantir fundo solido
- Usar `supabase.functions.invoke('ai-agent-test', ...)` em vez de fetch manual, pois o SDK ja inclui o token de autenticacao correto automaticamente
- Adicionar explicacao visual (tooltip ou texto) sobre o que o botao faz: "Envia uma mensagem de teste para verificar se a IA responde corretamente com as configuracoes atuais"

**Arquivo**: `src/pages/AdminAIConfig.tsx` (linhas 142-180 e 586-610)

---

## 3. Lead qualificado nao esta sendo movido

**Problema**: A conversa que voce mostrou tem sinais claros de qualificacao:
- Tem veiculo (moto)
- Demonstrou interesse na liberdade profissional
- Tem experiencia em atendimento/telemarketing
- Definiu meta de renda (R$ 20k)
- Agendou conversa com gestor para o dia seguinte
- Mostrou motivacao ("vontade de ter um futuro melhor")

O prompt atual exige que o lead demonstre TODOS os sinais simultaneamente (interesse + veiculo + experiencia em vendas). Isso e muito restritivo - a maioria dos leads nunca vai mencionar todos os criterios numa conversa natural.

**Solucao**: Ajustar o prompt do classificador para exigir sinais SUFICIENTES (nao todos). Criterios para qualificar:
- Demonstrou interesse real (fez perguntas, expressou motivacao, agendou conversa)
- E tem pelo menos UM requisito basico (veiculo, experiencia profissional relevante, ou disponibilidade)

Mudar de "DEVE demonstrar TODOS estes sinais" para "DEVE demonstrar interesse real E ter pelo menos UM dos requisitos basicos".

**Arquivo**: `supabase/functions/ai-agent-respond/index.ts` (linha 772)

---

## 4. Lead descartado nao esta sendo movido (BUG)

**Problema**: A mensagem "Na verdade eu achei que era outra coisa. Nao quero mais ok?" contem a keyword "nao quero mais" que esta na lista de rejeicao. Porem, ha um BUG no fluxo: apos a regra de descarte (linhas 732-739), o codigo NAO para - ele continua executando as regras seguintes (Contato Inicial na linha 750, e o classificador IA na linha 757). O classificador de IA pode entao sugerir OUTRO quadro e sobrescrever o descarte.

**Solucao**: Adicionar uma flag `skipRemainingPipeline` que, quando o descarte deterministico acontece, impede que as regras seguintes sobrescrevam a decisao. Alternativamente, usar um bloco `if/else if` para garantir exclusao mutua entre as regras.

**Arquivo**: `supabase/functions/ai-agent-respond/index.ts` (linhas 730-805)

---

## Resumo

| Item | Arquivo | Mudanca |
|---|---|---|
| Lista de consultores nao atualiza | `CreateConsultantDialog.tsx` | Invalidar query `['unified-ranking']` no onSuccess |
| Botao Testar visual | `AdminAIConfig.tsx` | Adicionar `bg-background` ao botao |
| Botao Testar funcional | `AdminAIConfig.tsx` | Usar `supabase.functions.invoke` em vez de fetch manual |
| Qualificacao muito restritiva | `ai-agent-respond/index.ts` | Mudar de "TODOS os sinais" para "interesse + pelo menos 1 requisito" |
| Descarte sendo sobrescrito (BUG) | `ai-agent-respond/index.ts` | Adicionar flag para impedir que regras subsequentes sobrescrevam o descarte |

