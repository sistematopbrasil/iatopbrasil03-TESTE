

## Plano: Correcoes de Tooltip, Editor de Campanhas, Layout e Persistencia da IA

### 1. Corrigir tooltip do grafico diario do Instagram

**Problema**: No tema escuro, o tooltip do `DailyChangeBarChart` tem fundo escuro com texto escuro, ficando invisivel.

**Correcao em `DailyChangeBarChart.tsx`**:
- Adicionar `color: "hsl(var(--foreground))"` no `contentStyle` do Tooltip
- Melhorar o contraste adicionando `labelStyle` e `itemStyle` com cor explicita
- Cursor com cor semi-transparente para destacar a barra sendo hover

### 2. Editor de campanha (Dialog completo)

Criar um **Dialog fullscreen** para editar campanhas via Meta API. Sera acessado por um botao "Editar" no `CampaignCard`.

**Novo componente `CampaignEditDialog.tsx`**:
- Dialog grande (max-w-4xl) com scroll interno
- Secoes organizadas em Cards:
  - **Cabecalho**: Nome da campanha, status, objetivo, orcamento
  - **Conjuntos de Anuncios**: Lista cada AdSet com:
    - Toggle ligar/desligar (reutiliza edge function existente)
    - Campos editaveis: Idade min/max (sliders), Genero (select), Posicionamentos (checkboxes)
    - Orcamento diario (input numerico)
  - **Anuncios**: Dentro de cada conjunto, lista anuncios com toggle e preview do criativo
  - **Metricas resumidas** no topo (spend, clicks, CTR, CPC dos ultimos 30d)

**Nova edge function `update-campaign-targeting/index.ts`**:
- Aceita `adset_id` + campos de targeting (age_min, age_max, genders, publisher_platforms)
- Faz POST na Meta Graph API `/{adset_id}` com o targeting atualizado
- Tambem aceita `daily_budget` para atualizar orcamento do AdSet

**Nova edge function (reutilizar `toggle-campaign-status`)**: 
- Estender para aceitar `type: "campaign" | "adset" | "ad"` e o respectivo ID
- A Meta API usa o mesmo endpoint POST `/{id}` com `{ status }` para campanhas, adsets e ads

### 3. Layout das Configuracoes (full-width)

**Problema**: `TrafficSettings` usa `max-w-2xl`, deixando metade da tela vazia.

**Correcao**: 
- Mudar para grid de 2 colunas em desktop: `grid grid-cols-1 lg:grid-cols-2 gap-5`
- Coluna 1: Token + Sincronizacao + Toggle IA
- Coluna 2: Configuracoes da IA (modelo, temperatura, prompt)
- Em mobile: empilhado normalmente

### 4. Layout da aba Campanhas (sem scroll desnecessario)

**Correcoes em `CampaignsTab.tsx`**:
- Usar `h-[calc(100vh-200px)]` no container principal para encaixar tudo na viewport
- Campanhas com scroll interno (`overflow-y-auto`) dentro do espaco disponivel
- Chat da IA tambem com altura calculada para preencher sem cortar

### 5. Corrigir persistencia das conversas da IA

**Problema**: O upsert usa `onConflict: "organization_id,ad_account_id"` mas nao existe um UNIQUE constraint nessas colunas. O upsert falha silenciosamente.

**Migracao SQL**: Adicionar unique constraint:
```
ALTER TABLE traffic_ai_conversations 
ADD CONSTRAINT traffic_ai_conversations_org_account_unique 
UNIQUE (organization_id, ad_account_id);
```

### 6. Melhorar persistencia no codigo

**Correcao em `TrafficAIChat.tsx`**:
- No `persistMessages`, fazer fallback: tentar upsert, se falhar (sem unique), usar select + update/insert manual
- Garantir que ao trocar de conta o `initialized` reseta corretamente (ja faz, mas confirmar timing)

---

### Resumo dos arquivos afetados

| Arquivo | Mudanca |
|---|---|
| `src/components/instagram/DailyChangeBarChart.tsx` | Tooltip com cores de alto contraste |
| `src/components/traffic/CampaignCard.tsx` | Adicionar botao "Editar" que abre CampaignEditDialog |
| `src/components/traffic/CampaignEditDialog.tsx` | **NOVO** - Dialog completo para editar campanhas, conjuntos e anuncios |
| `supabase/functions/update-campaign-targeting/index.ts` | **NOVO** - Edge function para atualizar targeting de AdSets via Meta API |
| `supabase/functions/toggle-campaign-status/index.ts` | Estender para suportar adsets e ads alem de campanhas |
| `src/components/traffic/TrafficSettings.tsx` | Layout 2 colunas, usar espaco completo da tela |
| `src/components/traffic/CampaignsTab.tsx` | Ajustar alturas para caber na viewport sem scroll externo |
| Migracao SQL | Adicionar UNIQUE constraint em traffic_ai_conversations(organization_id, ad_account_id) |
| `src/components/traffic/TrafficAIChat.tsx` | Melhorar logica de persistencia com fallback |

