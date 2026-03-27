

## Plano: Numerar Perguntas Customizadas + Template 2 "Landing Page WhatsApp"

---

### 1. Numerar perguntas customizadas na CapturePage

**Problema**: As perguntas customizadas não têm numeração como os campos padrão (nome=1, email=2, telefone=3).

**Correção em `CapturePage.tsx`** (linha 716-718): Adicionar o badge numérico (mesmo estilo dos campos padrão) nas perguntas custom. O número começa após o último campo base (phoneStep + 1, phoneStep + 2, etc.).

**Garantir respostas no lead**: As custom answers já são salvas em `extra_answers` (jsonb) no `quiz_submissions_new`. Precisa verificar que essas respostas aparecem na visualização do lead no painel. Verificar `LeadProfile.tsx` ou `LeadCard.tsx` para exibir `extra_answers`.

---

### 2. Novo template "Landing Page WhatsApp" (Template 2)

**Conceito**: Página curta e direta, estilo landing page com:
- Seção hero com título/subtítulo
- Galeria de imagens "antes e depois" (até 6 imagens, configuráveis)
- Formulário com nome, email (opcional), telefone + perguntas customizáveis
- Botão CTA que redireciona para WhatsApp
- Visual moderno com a paleta Top Brasil

**Implementação**:

#### 2a. Database: novo campo `template_type` na tabela `capture_page_configs`

```sql
ALTER TABLE public.capture_page_configs 
  ADD COLUMN template_type text NOT NULL DEFAULT 'standard',
  ADD COLUMN gallery_images jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN gallery_title text DEFAULT 'Veja nossos resultados';
```

- `template_type`: `'standard'` (atual) ou `'landing'` (novo)
- `gallery_images`: Array de `{ url: string, caption?: string }` para as imagens antes/depois
- `gallery_title`: Título da seção de galeria

#### 2b. `ConsultantSettings.tsx` — Seletor de template

Na aba "Captura", adicionar no topo um **seletor de template** (dois cards clicáveis):
- **Template 1 — Formulário Simples**: O atual (ícone de formulário)
- **Template 2 — Landing Page**: O novo (ícone de página web)

Ao selecionar um template, os campos de configuração se adaptam:
- Template "standard": mostra os campos atuais (título, subtítulo, hero, etc.)
- Template "landing": mostra os mesmos campos + seção de **Galeria de Imagens** (upload múltiplo, caption, reordenar) + título da galeria

O preview também muda conforme o template selecionado.

As perguntas padrão sugeridas pelo cliente (trabalho CLT, experiência vendas, veículo) vêm **pré-preenchidas** quando o usuário seleciona o template "landing" pela primeira vez, mas são editáveis/removíveis.

#### 2c. `CapturePage.tsx` — Renderizar template "landing"

Quando `config.template_type === 'landing'`, renderizar layout diferente:

1. **Hero Section**: Título grande + subtítulo + CTA scroll-to-form
2. **Galeria Section**: Grid de imagens (2-3 colunas) com bordas arredondadas e efeito hover
3. **Formulário Section**: Mesmo sistema de formulário atual (nome, email?, telefone, perguntas custom)
4. **Footer**: Badge de segurança

Visual: Mesmo estilo glassmorphism + paleta Top Brasil, mas com layout vertical mais longo (scrollável), seções separadas por espaçamento generoso.

#### 2d. Preview no Settings

Criar `CapturePagePreviewLanding` que mostra miniatura do template landing (hero + mini galeria + mini form).

---

### 3. Exibir `extra_answers` no perfil do lead

Verificar e garantir que o `LeadProfile.tsx` ou componente de detalhes do lead mostra as respostas das perguntas customizadas (`extra_answers` do `quiz_submissions_new`).

---

### Resumo

| # | O que | Arquivo(s) | Migration |
|---|-------|-----------|-----------|
| 1 | Numerar perguntas custom | `CapturePage.tsx` | — |
| 2a | Campos template | Migration | `template_type`, `gallery_images`, `gallery_title` |
| 2b | Seletor de template + config | `ConsultantSettings.tsx` | — |
| 2c | Render template landing | `CapturePage.tsx` | — |
| 2d | Preview landing | `ConsultantSettings.tsx` | — |
| 3 | Mostrar extra_answers no lead | `LeadProfile.tsx` | — |

### Perguntas default do template Landing
Ao selecionar template "landing" pela primeira vez (sem perguntas custom), pré-preencher:
1. "Você trabalha atualmente com carteira assinada?" → choice: ["Sim", "Não, sou autônomo", "Estou sem emprego no momento"]
2. "Você já teve alguma experiência com vendas?" → choice: ["Sim, já trabalhei com vendas", "Nunca trabalhei mas tenho interesse", "Não tenho experiência e não sei se é pra mim"]
3. "Você tem veículo próprio?" → choice: ["Sim, carro", "Sim, moto", "Não tenho"]

