

## Plano: Corrigir status do Agente IA e badge no CRM

### Problema 1: "Agente IA Ativo" sempre visível na página Agente IA
O card (linha 192-215 de `AdminAIConfig.tsx`) sempre mostra "Agente IA Ativo" como título fixo. O texto e o estilo devem mudar conforme o estado do `auto_reply`.

**Correção**: Alterar o título para "Agente IA Inativo" e usar estilo neutro quando `auto_reply` é `false`.

| Arquivo | Mudança |
|---------|---------|
| `src/pages/AdminAIConfig.tsx` | Título e estilo do card condicionais ao `formData.auto_reply` |

### Problema 2: Badge "IA Ativa" aparece no CRM mesmo com IA desativada
O `AIStatusBadge` recebe `aiEnabled` do campo `ai_enabled` do usuário (permissão do super admin), mas não verifica se o `auto_reply` está ligado na config. Resultado: badge aparece mesmo sem a IA estar configurada/ativa.

**Correção**: No `ChatWindow.tsx`, além de buscar `ai_enabled` do usuário, buscar também `auto_reply` da tabela `ai_agent_configs`. Só passar `aiEnabled=true` para o `AIStatusBadge` quando ambos forem `true`.

| Arquivo | Mudança |
|---------|---------|
| `src/components/crm/ChatWindow.tsx` | Buscar `auto_reply` de `ai_agent_configs` e combinar com `ai_enabled` |

### Problema 3: "Disparar IA agora" sem prompt configurado
Quando o usuário clica "Disparar IA agora" sem ter preenchido o prompt/persona, a IA falha silenciosamente.

**Correção**: No `useAIConversationState.ts`, antes de chamar `invokeAI`, verificar se existe uma config em `ai_agent_configs` com `persona` preenchida. Se não, mostrar toast de erro orientando a configurar o prompt primeiro.

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useAIConversationState.ts` | Verificar config antes de invocar IA; toast se prompt vazio |

### Resumo

| # | Problema | Arquivo | Mudança |
|---|----------|---------|---------|
| 1 | Título "Ativo" fixo | `AdminAIConfig.tsx` | Condicional ao `auto_reply` |
| 2 | Badge no CRM sempre visível | `ChatWindow.tsx` | Combinar `ai_enabled` + `auto_reply` |
| 3 | Disparar sem prompt | `useAIConversationState.ts` | Validar config antes de invocar |

