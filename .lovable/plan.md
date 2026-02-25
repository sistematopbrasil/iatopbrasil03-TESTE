

## Plano: Pagina de Captura + Origem dos Leads + Temperatura Dinamica por Pipeline

Este e um plano extenso porque a mudanca impacta banco de dados, logica de temperatura, pagina de leads, dashboard, pipeline, configuracoes do consultor, e uma nova pagina publica. Tudo sera feito de forma isolada e modular.

---

### PARTE 1: Banco de Dados

**Migracao 1 - Adicionar coluna `lead_source` e campos da pagina de captura:**

```sql
-- Coluna para identificar a origem do lead
ALTER TABLE quiz_submissions_new 
  ADD COLUMN IF NOT EXISTS lead_source text NOT NULL DEFAULT 'quiz';

-- Atualizar leads existentes do WhatsApp (completion_percentage = 0 e sem dados do quiz)
UPDATE quiz_submissions_new 
SET lead_source = 'whatsapp' 
WHERE completion_percentage = 0 
  AND (has_vehicle IS NULL AND has_driver_license IS NULL AND sales_experience IS NULL);

-- Coluna email ja existe na tabela (confirmado no schema)
```

**Migracao 2 - Tabela de configuracao da pagina de captura por consultor:**

```sql
CREATE TABLE capture_page_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  title text DEFAULT 'Quer uma renda extra ou mudar de vida?',
  subtitle text DEFAULT 'Preencha seus dados e descubra como fazer parte do nosso time de sucesso.',
  button_text text DEFAULT 'Quero saber mais!',
  button_color text DEFAULT '#EB6608',
  hero_image text,
  redirect_type text DEFAULT 'whatsapp',  -- 'whatsapp' | 'url' | 'thank_you'
  redirect_url text,
  whatsapp_message text DEFAULT 'Olá! Vim pela página de captura e quero saber mais.',
  custom_slug text,  -- Se null, usa o quiz_slug do consultor
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(consultant_id)
);

-- RLS
ALTER TABLE capture_page_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultants can manage own capture config"
  ON capture_page_configs FOR ALL
  USING (consultant_id = get_current_consultant_id());

CREATE POLICY "Public can read active configs"
  ON capture_page_configs FOR SELECT
  USING (is_active = true);
```

**Migracao 3 - Alterar trigger `calculate_lead_score` para considerar `lead_source`:**

A logica de temperatura no trigger do banco sera expandida:

- `lead_source = 'quiz'` → manter logica atual (frio se incompleto, calculo por score se completo)
- `lead_source = 'capture'` ou `'whatsapp'` → temperatura calculada pelo pipeline stage:
  - Stage "Novos Leads" ou primeiro stage → `cold`
  - Stage "Contato Inicial" ou segundo stage → `warm`  
  - Stage "Qualificados" ou terceiro stage → `hot`
  - Stage "Descartados" ou stage com nome contendo "descart" → `cold`
  - Se `temperature_override = true` → nao muda (manual)

**Migracao 4 - Trigger para atualizar temperatura ao mover no pipeline:**

```sql
CREATE OR REPLACE FUNCTION update_temperature_on_pipeline_move()
RETURNS trigger AS $$
DECLARE
  source text;
  stage_name text;
  stage_order int;
  total_stages int;
BEGIN
  -- So atuar se pipeline_stage_id mudou
  IF NEW.pipeline_stage_id IS NOT DISTINCT FROM OLD.pipeline_stage_id THEN
    RETURN NEW;
  END IF;

  -- Verificar se e lead nao-quiz E sem override manual
  IF NEW.lead_source = 'quiz' OR NEW.temperature_override = true THEN
    RETURN NEW;
  END IF;

  -- Buscar info do novo stage
  SELECT ps.name, ps.order_index INTO stage_name, stage_order
  FROM pipeline_stages ps WHERE ps.id = NEW.pipeline_stage_id;

  -- Contar total de stages da org
  SELECT count(*) INTO total_stages
  FROM pipeline_stages WHERE organization_id = NEW.organization_id;

  -- Logica de temperatura por posicao/nome do stage
  IF lower(stage_name) LIKE '%descart%' THEN
    NEW.temperature := 'cold';
  ELSIF lower(stage_name) LIKE '%qualificad%' OR lower(stage_name) LIKE '%convertid%' 
        OR lower(stage_name) LIKE '%novo%consultor%' THEN
    NEW.temperature := 'hot';
  ELSIF lower(stage_name) LIKE '%contato%' THEN
    NEW.temperature := 'warm';
  ELSIF stage_order = 0 THEN
    NEW.temperature := 'cold';
  ELSIF stage_order >= (total_stages - 2) AND NOT lower(stage_name) LIKE '%descart%' THEN
    NEW.temperature := 'hot';
  ELSE
    NEW.temperature := 'warm';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_temp_on_pipeline_move
  BEFORE UPDATE OF pipeline_stage_id ON quiz_submissions_new
  FOR EACH ROW
  EXECUTE FUNCTION update_temperature_on_pipeline_move();
```

---

### PARTE 2: Nova Pagina Publica de Captura

**Novo arquivo: `src/pages/CapturePage.tsx`**

- Rota: `/c/:slug` (curta, diferente de `/quiz/:slug`)
- Busca config do consultor via `capture_page_configs` + fallback para valores padrao
- Layout moderno: fundo escuro, gradiente laranja, mobile-first
- Formulario com 3 campos: Nome, Email, Telefone
- Ao submeter:
  1. Insere em `quiz_submissions_new` com `lead_source = 'capture'`, `completion_percentage = 100`, `temperature = 'cold'`
  2. Redireciona conforme `redirect_type`:
     - `whatsapp` → abre `wa.me/{numero}?text={mensagem}` (usa `whatsapp_button_url` do consultor)
     - `url` → redireciona para URL customizada
     - `thank_you` → mostra tela de agradecimento
- Design: hero com imagem opcional, card glassmorphism com form, botao CTA grande
- Sem configuracao: funciona com titulo/subtitulo/botao padrao e redireciona para WhatsApp do consultor

**Nova rota em `App.tsx`:**
```tsx
<Route path="/c/:slug" element={<CapturePage />} />
```

---

### PARTE 3: Configuracoes do Consultor (nova aba)

**Arquivo: `src/components/consultant/ConsultantSettings.tsx`**

Adicionar nova aba "Captura" no `TabsList` (ao lado de Quiz, Tracking, WhatsApp, Conta):

- Titulo da pagina
- Subtitulo/descricao
- Texto do botao
- Cor do botao (color picker)
- Upload de imagem hero (reutilizar mesmo bucket `quiz-images`)
- Tipo de redirecionamento (WhatsApp / URL externa / Pagina de obrigado)
- URL de redirecionamento (se tipo = URL)
- Mensagem do WhatsApp (se tipo = WhatsApp)
- Preview do link da pagina de captura: `dominio/c/{slug}`
- Botoes Copiar/Abrir (igual ao quiz)

Se nao existir config ainda, criar automaticamente ao salvar com valores padrao.

---

### PARTE 4: Pagina de Leads Unificada

**Arquivo: `src/pages/AdminLeads.tsx`**

Mudancas:

1. **Remover filtro `.gt('completion_percentage', 0)`** da query principal (linha 119) → agora busca TODOS os leads
2. **Novo filtro "Origem"** com opcoes: Todos, Quiz, Captura, WhatsApp
   - Filtra por `lead_source` (`quiz`, `capture`, `whatsapp`)
3. **Badge de origem** em cada lead na tabela/card:
   - Quiz → badge roxo "Quiz"
   - Captura → badge laranja "Captura"
   - WhatsApp → badge verde "WhatsApp"
4. **Interface Lead** → adicionar campo `lead_source` e `email`
5. **Dialog de detalhes do lead** → mostrar origem e email quando disponivel
6. **Export CSV** → incluir coluna `origem` e `email`

---

### PARTE 5: Pipeline Board

**Arquivo: `src/components/crm/PipelineBoard.tsx`**

Na `updateStageMutation` (linha 146-203):
- Apos mover lead, se `lead_source !== 'quiz'`, o trigger do banco ja atualiza a temperatura automaticamente
- Adicionar feedback visual: "Temperatura atualizada para Morno" (toast info)
- Invalidar queries de leads apos mover para refletir nova temperatura

**Arquivo: `src/components/crm/LeadCard.tsx`**
- Adicionar badge de origem pequeno (icone) no card

---

### PARTE 6: Dashboard do Consultor

**Arquivo: `src/components/consultant/ConsultantDashboard.tsx`**

- Adicionar link da pagina de captura ao lado do link do quiz (copiar/abrir)
- Metricas: adicionar "Leads Captura" e "Leads WhatsApp" como stat cards opcionais
- Grafico donut de distribuicao por origem (Quiz vs Captura vs WhatsApp)

---

### PARTE 7: WhatsApp Leads List

**Arquivo: `src/components/crm/WhatsAppLeadsList.tsx`**

No `handleCreateLead` (linha 163):
- Mudar para `lead_source: 'whatsapp'` no insert (ao inves de so `completion_percentage: 0`)
- Ja funciona porque o trigger ira tratar a temperatura pelo pipeline

---

### PARTE 8: CRM Webhook

**Arquivo: `supabase/functions/crm-webhook/index.ts`**

Quando cria lead automaticamente a partir de mensagem recebida:
- Adicionar `lead_source: 'whatsapp'` no insert

---

### Resumo de Arquivos

| Arquivo | Tipo | Mudanca |
|---|---|---|
| Migracao SQL (4 scripts) | DB | `lead_source`, `capture_page_configs`, trigger temperatura por pipeline |
| `src/pages/CapturePage.tsx` | Novo | Pagina publica de captura |
| `src/App.tsx` | Edit | Nova rota `/c/:slug` |
| `src/components/consultant/ConsultantSettings.tsx` | Edit | Nova aba "Captura" |
| `src/pages/AdminLeads.tsx` | Edit | Filtro por origem, badge, remover filtro completion > 0 |
| `src/components/consultant/ConsultantDashboard.tsx` | Edit | Link captura, metricas por origem |
| `src/components/crm/PipelineBoard.tsx` | Edit | Feedback visual temperatura |
| `src/components/crm/LeadCard.tsx` | Edit | Badge de origem |
| `src/components/crm/WhatsAppLeadsList.tsx` | Edit | `lead_source: 'whatsapp'` |
| `supabase/functions/crm-webhook/index.ts` | Edit | `lead_source: 'whatsapp'` |
| `src/lib/consultant-context.ts` | Edit | Helper `getCaptureUrl(slug)` |

---

### Ordem de Implementacao

1. Migracoes SQL (banco primeiro, base solida)
2. Pagina de captura publica + rota
3. Configuracoes do consultor (aba Captura)
4. Pagina de leads unificada
5. LeadCard + PipelineBoard (badge + temperatura)
6. Dashboard (links + metricas)
7. WhatsApp leads + webhook (lead_source)

Cada etapa e independente e pode ser testada isoladamente. A coluna `lead_source` tem default `'quiz'` entao nenhum dado existente quebra.

