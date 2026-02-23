

## Plano: Melhorias Visuais no Instagram, Chat IA Maior, e Detalhes de Conjuntos/Anuncios nas Campanhas

### 1. Graficos do Instagram - Melhor visualizacao de crescimento

**Problema**: O grafico de crescimento com numeros grandes (ex: 6.000-7.000) mostra quase uma linha reta porque o eixo Y comeca em 0. O grafico diario tem barras escuras que se misturam com o fundo.

**Correcoes**:
- **GrowthAreaChart**: Configurar `YAxis` com `domain={['dataMin - offset', 'dataMax + offset']}` para fazer zoom automatico no range real dos dados, mostrando claramente as variacoes
- **DailyChangeBarChart**: Usar cores mais vibrantes e com melhor contraste (verde mais claro para positivo, vermelho mais claro para negativo), adicionar labels nos topos das barras para valores significativos
- Ambos os graficos: melhorar tooltips, adicionar padding, garantir responsividade

### 2. Tabela de historico diario na pagina de detalhes do perfil

**Referencia**: O print mostra uma tabela com Data, Seguidores, Mudanca Diaria, Taxa de Crescimento, Seguindo, Posts (igual ao InstaGrow).

**Implementacao em `InstagramProfileDetail.tsx`**:
- Adicionar uma terceira aba "Historico" (alem de Crescimento e Diario)
- Criar componente `DailyMetricsTable` com as colunas: Data, Seguidores, Mudanca Diaria, Taxa de Crescimento, Seguindo, Posts
- Paginacao (10 por pagina)
- Cores semanticas: verde para mudancas positivas, vermelho para negativas
- Dados ordenados do mais recente para o mais antigo

### 3. Perfil clicavel em todas as paginas

**Problema**: Na Dashboard e Analises, clicar no card de perfil nao abre os detalhes.

**Correcao**:
- `InstagramDashboard.tsx`: Adicionar state para `selectedProfileId` e passar `onClick` para cada `InstagramProfileCard`, abrir o `Sheet` com `InstagramProfileDetail`
- `InstagramAnalytics.tsx`: Tornar cada item do ranking clicavel, abrir o mesmo Sheet de detalhes
- Reutilizar o mesmo padrao que ja existe em `InstagramProfilesList.tsx`

### 4. Icones mais modernos no modulo de Instagram

Substituir icones genericos por opcoes mais adequadas do Lucide:
- Dashboard: `LayoutGrid` em vez de `LayoutDashboard`
- Perfis: `UserCircle` ou `Instagram` (do Lucide) em vez de `Users` generico
- Analises: `TrendingUp` em vez de `BarChart3`
- Cards de metricas: usar icones mais especificos (ex: `UsersRound` para seguidores, `Flame` ou `Zap` para crescimento)

### 5. Chat da IA de Trafego - Layout maior e melhor legibilidade

**Problema no print**: O chat fica numa coluna estreita de 340px, texto pequeno e cortado.

**Correcoes em `CampaignsTab.tsx` e `TrafficAIChat.tsx`**:
- Aumentar a coluna do chat de `340px` para `420px` no grid desktop
- Aumentar o font-size das mensagens de `text-xs` para `text-sm`
- Aumentar o tamanho do header e do avatar do bot
- Input: aumentar `min-h` de 60px para 80px
- Garantir que o ScrollArea ocupa todo o espaco disponivel sem cortar mensagens
- Mobile: aumentar a altura do container de `500px` para `600px`

### 6. Campanhas - Mostrar conjuntos de anuncios e anuncios

**Problema**: Atualmente a campanha mostra `adsets_count` mas nao mostra detalhes dos conjuntos nem dos anuncios.

**Implementacao**:

**Backend (`get-account-campaigns/index.ts`)**:
- Expandir o campo `adsets` para incluir: `name, status, daily_budget, lifetime_budget, targeting, insights.date_preset(last_30d){spend,impressions,clicks,reach}, optimization_goal`
- Adicionar campo `ads` dentro de cada adset: `ads{name,status,creative{id,name,thumbnail_url,effective_object_story_id,image_url,body,title}}`
- Retornar os dados de conjuntos e anuncios no response

**Frontend (`CampaignCard.tsx`)**:
- No expand da campanha, adicionar secao "Conjuntos de Anuncios" com accordion/collapsible
- Cada conjunto mostra: Nome, Status, Orcamento, Publico (targeting resumido), Posicionamento, Otimizacao
- Dentro de cada conjunto, lista de anuncios com: Nome, Status, preview do criativo (thumbnail se disponivel)
- Layout hierarquico organizado: Campanha > Conjuntos > Anuncios, cada nivel com indentacao visual
- Criativo: exibir thumbnail se `thumbnail_url` ou `image_url` estiver disponivel, senao mostrar placeholder

**Interface atualizada**:
```
Campanha [ALINE] [LEADS]         [Ativa] [Toggle]
  |- Conjunto: "Mulheres 25-45"   [Ativo]
  |    Publico: Feminino, 25-45, Sao Paulo
  |    Posicionamento: Feed IG, Stories IG
  |    |- Anuncio: "Criativo V1"  [Ativo]
  |    |   [Preview do criativo]
  |- Conjunto: "Homens 30-55"     [Pausado]
  |    ...
```

### 7. Tipos atualizados

Atualizar `useAccountCampaigns.ts`:
- Adicionar interfaces `AdSet` e `Ad` com campos de targeting, criativos etc.
- Campanha passa a ter `adsets: AdSet[]` em vez de apenas `adsets_count`

---

### Resumo dos arquivos afetados

| Arquivo | Mudanca |
|---|---|
| `src/components/instagram/GrowthAreaChart.tsx` | YAxis com domain auto-zoom, visual melhorado |
| `src/components/instagram/DailyChangeBarChart.tsx` | Cores mais vibrantes, melhor contraste |
| `src/components/instagram/InstagramProfileDetail.tsx` | Adicionar aba "Historico" com tabela diaria |
| `src/components/instagram/DailyMetricsTable.tsx` | **NOVO** - Tabela paginada de metricas diarias |
| `src/components/instagram/InstagramDashboard.tsx` | Tornar perfis clicaveis, abrir Sheet de detalhes |
| `src/components/instagram/InstagramAnalytics.tsx` | Ranking clicavel, abrir Sheet de detalhes |
| `src/pages/AdminInstagram.tsx` | Icones atualizados nas tabs |
| `src/components/traffic/TrafficAIChat.tsx` | Fontes maiores, melhor spacing, layout expandido |
| `src/components/traffic/CampaignsTab.tsx` | Coluna IA mais larga, mobile com mais altura |
| `src/components/traffic/CampaignCard.tsx` | Secao de conjuntos e anuncios com hierarquia visual |
| `src/hooks/useAccountCampaigns.ts` | Interfaces AdSet e Ad adicionadas |
| `supabase/functions/get-account-campaigns/index.ts` | Buscar adsets detalhados e ads com criativos |

