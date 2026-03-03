

## Plano: Dois Ajustes

### 1. IA ativada nas configurações = ativa sem enviar mensagem

Atualmente quando `aiEnabled=true` e `status='none'`, o `AIStatusBadge` já trata como "ativa" (linha 49). Isso está correto — a IA responde apenas quando o contato envia mensagem (via webhook). Nenhuma mudança necessária no badge.

O ponto é confirmar que o webhook (`ai-agent-respond`) já funciona assim: quando recebe uma mensagem incoming e `auto_reply=true`, ele responde mesmo sem estado em `ai_conversation_state`. Vou verificar a edge function para garantir esse comportamento.

### 2. Follow-up: controle livre de unidade + valor

Substituir o `Select` com opções fixas por **dois campos lado a lado**:
- **Input numérico** para o valor (ex: 30, 2, 5)
- **Select de unidade** com 3 opções: "Minutos", "Horas", "Dias"

O valor será convertido para `delay_minutes` antes de salvar (valor × multiplicador da unidade).

**Arquivo**: `src/components/admin/FollowUpRulesEditor.tsx`
- Remover `DELAY_OPTIONS`
- Adicionar helper para converter de/para minutos ↔ (valor, unidade)
- No campo "Tempo sem resposta", renderizar `Input[number]` + `Select[unidade]` lado a lado
- No summary (collapsed), formatar o delay em texto legível (ex: "2 horas", "30 minutos", "5 dias")

