

## Plano: Toggle CRM no Super Admin + Perguntas Personalizáveis na Captura + Visual Melhorado

---

### 1. Toggle CRM/IA por consultor no Super Admin

**O que**: Adicionar um toggle na tabela de consultores (`ConsultantsTable.tsx`) para ativar/desativar o CRM para cada consultor. Quando CRM estiver desativado, o Agente IA também fica desativado automaticamente.

**Implementação**:
- Adicionar coluna `crm_enabled` (boolean, default false) na tabela `users` via migration
- No `ConsultantsTable.tsx`, adicionar uma coluna com Switch para cada consultor
- Ao desativar CRM, também setar `ai_enabled = false` no mesmo update
- No `AdminLayout.tsx` (linha 64), condicionar a exibição do item "CRM WhatsApp" e "Agente IA" ao `crm_enabled` do usuário

**Migration SQL**:
```sql
ALTER TABLE public.users ADD COLUMN crm_enabled boolean NOT NULL DEFAULT false;
```

| Arquivo | Mudança |
|---------|---------|
| Migration | Adicionar `crm_enabled` na tabela `users` |
| `ConsultantsTable.tsx` | Toggle CRM por consultor |
| `AdminLayout.tsx` | Condicionar menu CRM e IA ao `crm_enabled` |

---

### 2. Perguntas personalizáveis na Página de Captura

**O que**: Permitir que o consultor adicione perguntas customizáveis na mesma página de captura existente, além dos campos padrão (nome, email, telefone). As perguntas aparecem após os campos padrão, antes do botão de envio.

**Implementação**:
- Adicionar coluna `custom_questions` (jsonb, default '[]') na tabela `capture_page_configs`
  - Formato: `[{ "question": "Qual sua cidade?", "type": "text", "required": true, "options": [] }]`
  - Types suportados: `text`, `choice` (radio/select)
- No `ConsultantSettings.tsx` (CaptureSettingsTab), adicionar seção para gerenciar perguntas:
  - Botão "Adicionar Pergunta"
  - Lista de perguntas com drag ou setas para reordenar
  - Cada pergunta: texto, tipo (texto livre ou múltipla escolha), obrigatória sim/não, opções (se choice)
  - Botão para remover pergunta
- No `CapturePage.tsx`, renderizar as perguntas customizadas entre o campo de telefone e o botão de envio
  - Campos tipo `text` = input normal
  - Campos tipo `choice` = radio buttons estilizados
- Salvar respostas no campo `extra_answers` (jsonb) do `quiz_submissions_new` que já existe
- Atualizar a barra de progresso para incluir as perguntas extras na contagem
- Tornar o campo email **opcional** (pode ser removido pelo consultor) — adicionar `email_enabled` boolean na config (default true)

**Migration SQL**:
```sql
ALTER TABLE public.capture_page_configs 
  ADD COLUMN custom_questions jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN email_enabled boolean NOT NULL DEFAULT true;
```

| Arquivo | Mudança |
|---------|---------|
| Migration | `custom_questions` e `email_enabled` em `capture_page_configs` |
| `ConsultantSettings.tsx` | Editor de perguntas na aba de Captura |
| `CapturePage.tsx` | Renderizar perguntas + salvar em `extra_answers` |

---

### 3. Visual melhorado da Página de Captura

**O que**: Melhorar a estética seguindo a paleta Top Brasil (#EB6608 laranja + preto #0D0D0D), com animações mais suaves, gradientes mais ricos e tipografia mais impactante.

**Mudanças visuais no `CapturePage.tsx`**:
- Gradiente de fundo mais rico com partículas/orbs animadas (já existem, refinar cores)
- Cards com glassmorphism mais pronunciado (`backdrop-blur-3xl`, bordas mais sutis)
- Inputs com transições mais suaves e indicadores de foco mais elegantes
- Botão CTA com efeito de pulse suave além do shimmer
- Badge de segurança com ícone de cadeado animado
- Tipografia: usar `tracking-tight` no título para aspecto mais premium
- Adicionar sutil grid pattern no background para textura
- Melhorar espaçamento e responsividade mobile

| Arquivo | Mudança |
|---------|---------|
| `CapturePage.tsx` | Refinamentos visuais (gradientes, animações, tipografia) |

---

### Resumo

| # | Funcionalidade | Arquivos | Migration |
|---|---------------|----------|-----------|
| 1 | Toggle CRM por consultor | `ConsultantsTable.tsx`, `AdminLayout.tsx` | `crm_enabled` em `users` |
| 2 | Perguntas personalizáveis | `ConsultantSettings.tsx`, `CapturePage.tsx` | `custom_questions`, `email_enabled` em `capture_page_configs` |
| 3 | Visual melhorado | `CapturePage.tsx` | Nenhuma |

