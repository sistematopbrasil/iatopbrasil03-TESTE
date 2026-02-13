
# Corrigir Qualificacao e Dashboard Realtime

## 1. Qualificacao mais criteriosa no Pipeline

**Problema**: O lead esta sendo movido para "Qualificado" com apenas 5 mensagens, sem analisar o conteudo. A regra deterministica atual (linha 763 do `ai-agent-respond`) so conta mensagens, nao avalia interesse real.

**Solucao**:
- Remover a regra deterministica de 5 msgs -> Qualificado (linhas 750-769)
- Manter apenas a regra deterministica de 2 msgs -> Contato Inicial (que faz sentido)
- Deixar a progressao para "Qualificado" exclusivamente com o classificador de IA, que analisa o conteudo das mensagens
- Ajustar o prompt do classificador (linha 782-789) para ser mais criterioso:
  - Remover a regra 6 "Se em duvida, PROGRIDA" (muito agressiva)
  - Substituir por: "Se em duvida, MANTENHA no quadro atual"
  - Exigir sinais claros de interesse para qualificar: perguntas sobre a oportunidade, entusiasmo, pedido de mais informacoes, confirmacao de disponibilidade
  - Exigir que o lead demonstre ter requisitos (veiculo, experiencia, etc.)

**Arquivo**: `supabase/functions/ai-agent-respond/index.ts`

---

## 2. Dashboard atualizando em tempo real

**Problema**: O `AdminDashboard.tsx` so escuta eventos `INSERT` na subscription realtime (linha 24). Quando um lead e atualizado (temperatura, quadro do pipeline), o dashboard nao reflete a mudanca.

**Solucao**: Mudar `event: 'INSERT'` para `event: '*'` no `AdminDashboard.tsx` para capturar INSERT, UPDATE e DELETE.

**Arquivo**: `src/pages/AdminDashboard.tsx` (linha 24)

---

## Resumo

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/ai-agent-respond/index.ts` | Remover regra deterministica 5 msgs -> Qualificado; tornar prompt do classificador mais criterioso |
| `src/pages/AdminDashboard.tsx` | Mudar `event: 'INSERT'` para `event: '*'` no realtime |
