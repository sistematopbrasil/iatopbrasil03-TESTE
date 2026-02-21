

## Plano: Campanhas On/Off, Reorganizacao de Graficos, IA Persistente e Auto-Sync

### 1. Toggle Ligar/Desligar Campanhas

Adicionar um botao de ligar/desligar em cada `CampaignCard` que altera o status da campanha via Meta API.

**Implementacao:**
- Criar edge function `toggle-campaign-status/index.ts` que faz `POST` na Meta Graph API para alterar o `status` da campanha (ACTIVE <-> PAUSED)
- Adicionar botao `Switch` ou `Toggle` no header do `CampaignCard.tsx` ao lado do badge de status
- Usar `useMutation` para chamar a edge function e invalidar `account-campaigns` apos sucesso
- Mostrar toast de confirmacao/erro

### 2. Mover "Performance das Contas" para aba "Contas"

**Problema atual:** `TrafficAccountsTable` (tabela de performance) esta na "Visao Geral", duplicando informacao com a aba "Contas".

**Correcao:**
- Remover `TrafficAccountsTable` do `TrafficDashboard.tsx`
- Integrar a tabela de performance no `TrafficAccounts.tsx`, combinando a listagem de contas com as metricas de performance em uma unica view organizada

### 3. Graficos na Visao Geral: 2 fixos + 1 selecionavel

**Layout atual:** 2 graficos ambos com seletores de metrica (repetitivo).

**Novo layout:**
- **Grafico 1 (fixo):** Evolucao de Gasto (R$) ao longo do tempo (AreaChart) - sem botoes de troca
- **Grafico 2 (fixo):** Impressoes vs Cliques (dual AreaChart com duas linhas) - comparativo visual direto
- **Grafico 3 (selecionavel):** Manter seletor de metricas (Alcance, CTR, CPC, Visitas ao Perfil, Frequencia) - permite explorar metricas secundarias

Grid: `grid-cols-1 lg:grid-cols-2` para os 2 primeiros + full-width para o terceiro em telas grandes, ou todos empilhados em mobile.

### 4. Remover metricas de Engajamento e Conversoes (novamente)

As metricas `totalPostEngagement` e `totalConversions` voltaram ao `useTrafficMetrics.ts`. Vou remover:
- Do tipo `TrafficMetrics` e dos calculos
- Do `dailyData` e `byAccount`
- De qualquer componente que ainda referencia

### 5. Persistencia de conversas da IA por conta

**Problema atual:** As mensagens ficam em estado local (`useState`) e se perdem ao sair.

**Solucao:**
- Criar tabela `traffic_ai_conversations` no banco: `id, organization_id, ad_account_id, messages (jsonb), updated_at, created_at`
- RLS: Super admin pode gerenciar
- Ao abrir o chat de uma conta, carregar mensagens salvas do banco
- A cada mensagem nova (user ou assistant finalizada), salvar o array completo no banco via upsert
- Botao "Limpar" limpa mensagens locais E no banco
- Cada conta tem sua propria conversa persistente

### 6. Configuracoes da IA de Trafego

Adicionar secao de configuracao da IA na aba "Configuracoes" do modulo de Trafego.

**Campos de configuracao (salvos em `traffic_settings`):**
- **Modelo de IA**: Select com opcoes (google/gemini-3-flash-preview, google/gemini-2.5-flash, google/gemini-2.5-pro, openai/gpt-5-mini, openai/gpt-5)
- **Prompt do sistema**: Textarea para customizar o prompt base (vem pre-preenchido com prompt otimizado)
- **Temperatura**: Slider 0.0-1.0 (default 0.5 para analises precisas)
- **Foco de analise**: Checkboxes (Otimizacao de CPC, Analise de CTR, Sugestoes de publico, Criacao de campanhas, Analise de criativos)
- **Modo de resposta**: Select (Detalhado / Resumido / Tecnico)

**Migracoes necessarias:** Adicionar colunas a `traffic_settings`:
- `ai_model` (text, default 'google/gemini-3-flash-preview')
- `ai_system_prompt` (text, nullable - se null usa o padrao)
- `ai_temperature` (numeric, default 0.5)
- `ai_response_mode` (text, default 'detailed')

**Prompt pre-configurado (default otimizado):**
O prompt padrao incluira instrucoes para: analise profunda de metricas, identificacao de anomalias (CTR abaixo de 1%, CPC acima da media do setor), sugestoes de publico baseadas em targeting existente, criacao de campanhas completas com briefing detalhado (objetivo, publico, orcamento, posicionamentos, criativos), e comparacao de performance entre campanhas.

**Edge function `ai-traffic-chat`:** Atualizar para ler configuracoes do banco antes de chamar a API, usando modelo/temperatura/prompt customizados.

### 7. Auto-sync ao abrir o painel

**Implementacao:**
- No `AdminTraffic.tsx`, ao montar o componente (com `organizationId` disponivel), disparar automaticamente o `syncAllAccounts.mutate()` em background
- Usar `useEffect` com flag para evitar chamadas duplicadas
- Nao mostrar loading bloqueante - os dados existentes aparecem imediatamente e se atualizam quando o sync terminar
- Combinar com a sincronizacao diaria automatica (cron) que ja existe

### Resumo dos arquivos afetados

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/toggle-campaign-status/index.ts` | **NOVO** - Edge function para ligar/desligar campanha via Meta API |
| `src/components/traffic/CampaignCard.tsx` | Adicionar toggle de status (ligar/desligar) |
| `src/components/traffic/TrafficDashboard.tsx` | Remover TrafficAccountsTable, reorganizar graficos (2 fixos + 1 selecionavel) |
| `src/components/traffic/TrafficEvolutionChart.tsx` | Refatorar: criar 3 componentes de grafico (SpendChart fixo, ImpressionsClicksChart fixo, MetricExplorerChart selecionavel) |
| `src/components/traffic/TrafficSpendChart.tsx` | Remover (substituido pelo layout de 3 graficos) |
| `src/components/traffic/TrafficAccounts.tsx` | Integrar tabela de performance das contas |
| `src/hooks/useTrafficMetrics.ts` | Remover post_engagement e conversions |
| `src/components/traffic/TrafficMetricCards.tsx` | Limpar referencias restantes |
| `src/components/traffic/TrafficAIChat.tsx` | Persistir mensagens no banco por conta |
| `src/components/traffic/TrafficSettings.tsx` | Adicionar secao de configuracao da IA (modelo, prompt, temperatura) |
| `supabase/functions/ai-traffic-chat/index.ts` | Ler configuracoes do banco (modelo, prompt, temperatura) |
| `src/pages/AdminTraffic.tsx` | Adicionar auto-sync ao montar |
| Migracao SQL | Criar tabela `traffic_ai_conversations` + adicionar colunas de config IA em `traffic_settings` |

