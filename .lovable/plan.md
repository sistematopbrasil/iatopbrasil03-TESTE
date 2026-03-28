

## Plano: Redirecionamento direto para WhatsApp + Perfil do lead dinâmico por origem

### 3 entregas

---

### 1. WhatsApp direto (sem página de obrigado)

**Problema atual:** Após o formulário, SEMPRE mostra a `ThankYouPage`, mesmo quando o redirect é WhatsApp.

**Solução em `CapturePage.tsx`:**
- No `handleSubmit`, após salvar com sucesso, verificar o `redirect_type`:
  - Se `whatsapp` → redirecionar diretamente para `wa.me/...` via `window.location.href` (sem `setSubmitted(true)`)
  - Se `url` → redirecionar diretamente para a URL configurada
  - Se `thank_you` (novo tipo) → aí sim `setSubmitted(true)` e mostra a ThankYouPage
- Adicionar `thank_you` como opção de `redirect_type` para quem quer a página de obrigado
- Na `ThankYouPage`, o botão deve ser configurável (texto e link do botão) — usar campos existentes `button_text` e `redirect_url`

**Mudança no settings (`ConsultantSettings.tsx`):**
- Nas opções de redirecionamento, ajustar para 3 opções claras:
  - **WhatsApp** → vai direto pro WhatsApp
  - **URL externa** → vai direto pra URL
  - **Página de Obrigado** → mostra thank you page com botão configurável (texto + link do botão)

---

### 2. Botão configurável na página de obrigado

Quando `redirect_type === 'thank_you'`:
- Mostrar a ThankYouPage com um botão cujo texto e URL são configuráveis
- No settings, quando selecionar "Página de Obrigado", mostrar campos:
  - Texto do botão (default: "Falar com um Consultor")
  - Link do botão (URL ou WhatsApp)

Aproveitar os campos existentes `button_text` e `redirect_url` do `capture_page_configs`.

---

### 3. Perfil do lead dinâmico por origem (`LeadProfile.tsx`)

**Problema atual:** O perfil sempre mostra seções do quiz (Experiência Profissional, Expectativas, etc.) mesmo para leads de captura/recrutamento que não responderam quiz.

**Solução:**
- Adicionar `lead_source` à interface `LeadData`
- Condicionar as seções por `lead_source`:
  - **`quiz`**: mostrar tudo (informações pessoais, profissionais, expectativas — campos do quiz)
  - **`capture` / `recruitment`**: mostrar apenas informações básicas (nome, telefone, email) + `extra_answers` (respostas do formulário da landing) + origem do lead
  - Esconder seções vazias automaticamente (se nenhum campo da seção tem valor, não mostrar o header)
- Ajustar o label "Quiz respondido" para "Cadastrado em" quando `lead_source !== 'quiz'`
- Ajustar a mensagem "Este contato ainda não respondeu o quiz" para ser contextual

---

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/CapturePage.tsx` | Redirect direto para WhatsApp/URL no submit; ThankYouPage só para `thank_you` |
| `src/components/consultant/ConsultantSettings.tsx` | 3 opções de redirect; campos do botão da thank you page |
| `src/components/crm/LeadProfile.tsx` | Adicionar `lead_source`; condicionar seções por origem; esconder seções vazias |

