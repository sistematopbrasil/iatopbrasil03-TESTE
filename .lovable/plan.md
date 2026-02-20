
## Módulo de Campanhas + IA por Conta — Plano Completo

### Visão Geral do que Será Construído

O sistema atual tem: Visão Geral (métricas agregadas), Contas (lista simples), Configurações. Será adicionada uma 4ª aba central chamada **"Campanhas"**, que será o coração do novo módulo. Ela permitirá: selecionar uma conta, ver todas as campanhas daquela conta com detalhes completos, e (quando IA ativa) conversar com um assistente especializado sobre aquela conta.

---

### Arquitetura das Novas Abas

```text
[Visão Geral] [Campanhas ★ NOVA] [Contas] [Configurações]
```

A aba "Campanhas" terá 3 zonas:
1. **Seletor de Conta** — dropdown ou cards laterais para escolher qual conta visualizar
2. **Lista de Campanhas** — tabela/cards com dados detalhados de cada campanha
3. **Chat IA** (condicional) — painel lateral ou inferior que aparece quando IA está ativa

---

### 1. Nova Edge Function: `get-account-campaigns`

**Propósito:** Buscar campanhas diretamente da Meta Graph API (não do banco — campanhas mudam com frequência, dados devem ser frescos).

**Dados retornados por campanha:**
- `id`, `name`, `status`, `objective`
- `daily_budget` / `lifetime_budget`, `budget_remaining`
- `start_time`, `stop_time`, `created_time`
- **Targeting:** `age_min`, `age_max`, `genders`, `geo_locations`, `interests`, `publisher_platforms`, `device_platforms`
- **Insights** (últimos 30d): `spend`, `impressions`, `clicks`, `reach`, `ctr`, `cpc`, `frequency`

**Endpoint Meta usado:**
```
GET /act_{ad_account_id}/campaigns
?fields=id,name,status,objective,daily_budget,lifetime_budget,budget_remaining,start_time,stop_time,created_time,insights{spend,impressions,clicks,reach,ctr,cpc,frequency},adsets{targeting}
```

O adset contém o `targeting` com público, gênero, idade e posicionamento.

---

### 2. Nova Edge Function: `ai-traffic-chat`

**Propósito:** Assistente IA especializado em análise de campanhas Meta Ads.

**Funcionamento:**
- Recebe: `messages[]` (histórico do chat), `account_name`, `campaigns_data` (JSON das campanhas), `metrics_summary` (métricas do período)
- Usa `LOVABLE_API_KEY` + `google/gemini-2.5-flash` via Lovable AI Gateway
- O sistema prompt injeta automaticamente os dados da conta + campanhas como contexto
- Capaz de:
  - Analisar performance de campanhas existentes
  - Sugerir otimizações (CTR baixo, CPC alto, frequência elevada)
  - Criar briefing de novas campanhas (objetivo, público sugerido, orçamento)
  - Responder perguntas sobre métricas históricas

**Sistema Prompt injetado:**
```
Você é um especialista em Meta Ads (Facebook/Instagram Ads). 
Contexto da conta: {account_name} (ID: {ad_account_id})
Campanhas ativas: {campaigns_json}
Métricas dos últimos {period} dias: {metrics_summary}
Responda em português brasileiro. Seja preciso, use os dados reais fornecidos.
```

**Streaming:** Sim — usa SSE para resposta token a token.

---

### 3. Hook: `useAccountCampaigns`

Novo hook `src/hooks/useAccountCampaigns.ts` que:
- Chama `get-account-campaigns` via `supabase.functions.invoke()`
- Recebe `ad_account_id` como parâmetro
- Retorna `{ campaigns, isLoading, refetch }`
- Cache de 5 minutos (dados da API Meta são "frescos" mas não precisam ser recarregados a todo momento)

---

### 4. Componente: `CampaignsTab`

**Arquivo:** `src/components/traffic/CampaignsTab.tsx`

**Layout (2 painéis quando IA ativa, 1 painel quando desativa):**

```text
┌─────────────────────────────────────────────────────────┐
│  [Seletor de Conta ▼]        [Atualizar] [Status conta]  │
├─────────────────────────────┬───────────────────────────┤
│                             │                           │
│  LISTA DE CAMPANHAS         │  CHAT IA (se ai_enabled)  │
│  ─────────────────          │  ─────────────────────── │
│  Campanha A        [ATIVA]  │  💬 Olá! Sou especialista │
│  Objetivo: Tráfego          │  em Meta Ads. Analisando  │
│  Orçamento: R$ 50/dia       │  sua conta...             │
│  Público: 25-45, M/F        │                           │
│  Alcance: São Paulo         │  [input do usuário...]    │
│  Interesse: Finanças        │                           │
│  Posicionamento: Feed+Reels │  [Enviar]                 │
│                             │                           │
│  Campanha B        [PAUSADA]│                           │
│  ...                        │                           │
└─────────────────────────────┴───────────────────────────┘
```

**Quando IA desativada:** lista de campanhas ocupa 100% da largura, sem painel de chat.

---

### 5. Componente: `CampaignCard`

**Arquivo:** `src/components/traffic/CampaignCard.tsx`

Cada campanha exibirá em formato card expansível:

**Header (sempre visível):**
- Nome da campanha + badge de status (Ativa / Pausada / Arquivada) com cor semântica
- Objetivo (Tráfego, Engajamento, Conversões, etc.) com ícone
- Gasto total no período + badge de orçamento diário/total

**Corpo expandido (ao clicar):**
- **Métricas:** Impressões, Cliques, CTR, Alcance, Frequência, CPC — em mini-cards horizontais
- **Público-alvo:** Faixa de idade (ex: 25–45), Gênero (Todos / Masculino / Feminino)
- **Localização:** Cidades/estados/países do targeting
- **Interesses:** Tags dos interesses configurados
- **Posicionamentos:** Feed, Stories, Reels, Audience Network, Messenger — com ícones
- **Período da campanha:** Data início → Data fim (ou "Em andamento")

---

### 6. Componente: `TrafficAIChat`

**Arquivo:** `src/components/traffic/TrafficAIChat.tsx`

Painel de chat lateral com:
- **Header:** "Assistente IA — {nome da conta}" + badge "Especialista em Ads"
- **Área de mensagens:** scroll com markdown rendering (usando `dangerouslySetInnerHTML` com sanitização básica para bold/listas)
- **Sugestões rápidas** (chips clicáveis na primeira interação):
  - "Analise a campanha com melhor CTR"
  - "Qual campanha está com CPC muito alto?"
  - "Sugira um novo público para tráfego"
  - "Crie um briefing de campanha de conversão"
- **Input:** Textarea + botão Enviar
- **Streaming:** Tokens aparecem progressivamente
- **Contexto automático:** A cada nova conta selecionada, o contexto é reiniciado com dados frescos

---

### 7. Reorganização das Abas em `AdminTraffic.tsx`

```text
[Visão Geral] [Campanhas] [Contas] [Configurações]
```

- "Campanhas" recebe `organizationId` + `aiEnabled` (lido do banco)
- `aiEnabled` é carregado uma vez na página pai e passado como prop para evitar queries duplicadas

---

### Arquivos que Serão Criados

| Arquivo | Descrição |
|---|---|
| `supabase/functions/get-account-campaigns/index.ts` | Busca campanhas + targeting + insights da Meta API |
| `supabase/functions/ai-traffic-chat/index.ts` | Chat IA especializado com contexto de campanhas |
| `src/hooks/useAccountCampaigns.ts` | Hook para buscar campanhas de uma conta |
| `src/components/traffic/CampaignsTab.tsx` | Aba principal com seletor, lista e chat |
| `src/components/traffic/CampaignCard.tsx` | Card expansível de campanha com targeting |
| `src/components/traffic/TrafficAIChat.tsx` | Painel de chat IA com streaming |

### Arquivos que Serão Editados

| Arquivo | O que muda |
|---|---|
| `src/pages/AdminTraffic.tsx` | Adiciona aba "Campanhas", carrega `aiEnabled` centralmente |
| `supabase/config.toml` | Registra novas functions (`get-account-campaigns`, `ai-traffic-chat`) |

---

### Detalhes Técnicos Importantes

**Por que buscar campanhas da API (não do banco):**
- Campanhas mudam status, orçamento e targeting com frequência
- Dados de `ad_metrics` no banco são métricas históricas (bom para gráficos)
- Campanhas precisam de dados frescos da Meta API a cada visualização

**Targeting via `adsets`:**
- A API Meta retorna o targeting dentro dos `adsets` de cada campanha
- Será feito um `adsets{targeting}` na mesma query para evitar N+1
- O targeting inclui: `age_min`, `age_max`, `genders[]`, `geo_locations.cities[]/.countries[]`, `flexible_spec[].interests[]`, `publisher_platforms[]`, `device_platforms[]`

**Segurança do Chat IA:**
- O contexto (campanhas + métricas) é sempre injetado pelo backend (edge function)
- O frontend só envia `messages[]` + `ad_account_id` + período
- Nunca expõe o `META_ACCESS_TOKEN` no frontend

**Responsividade:**
- Mobile: Chat IA fica em aba separada abaixo da lista de campanhas (usando Tabs internas)
- Desktop: Layout de 2 colunas (70% lista / 30% chat)

**Streaming do chat:**
- A edge function `ai-traffic-chat` retorna `text/event-stream`
- O frontend usa `ReadableStream` + `TextDecoder` para tokens progressivos
- Mesma implementação já comprovada em outros módulos IA do projeto
