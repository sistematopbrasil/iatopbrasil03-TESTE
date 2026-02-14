

# Modulo Instagram Insights - Nova Aba no Super Admin

## Resumo

Integrar o projeto de Instagram Analytics como um modulo isolado dentro do painel Super Admin, com tabelas prefixadas `insta_*`, componentes independentes, e edge functions dedicadas.

## Pre-requisito: Secret APIFY_API_KEY

O modulo depende da API do Apify para coletar dados do Instagram. Sera necessario configurar o secret `APIFY_API_KEY` antes das edge functions funcionarem.

---

## Etapa 1: Banco de Dados (Migration SQL)

Criar 3 tabelas isoladas com prefixo `insta_`:

**insta_profiles** - Perfis do Instagram monitorados
- Campos: `id`, `organization_id`, `username`, `display_name`, `profile_picture`, `profile_url`, `category`, `notes`, `is_active`, `created_at`, `updated_at`
- RLS: organizacao do usuario (`get_user_organization_id()`)
- Sem `user_id` individual - vinculado a organizacao (Super Admin gerencia todos)

**insta_follower_metrics** - Historico diario de metricas
- Campos: `id`, `profile_id` (FK para insta_profiles), `follower_count`, `following_count`, `posts_count`, `daily_change`, `growth_rate`, `recorded_at`, `recorded_date`
- Constraint UNIQUE em `(profile_id, recorded_date)` para upsert
- RLS: via subquery no `insta_profiles`

**insta_campaign_notes** - Notas por perfil
- Campos: `id`, `profile_id` (FK para insta_profiles), `note_text`, `note_type`, `created_at`
- RLS: via subquery no `insta_profiles`

**Storage bucket**: `insta-profile-pictures` (publico)

**Realtime**: Habilitado para `insta_follower_metrics` (atualizacao em tempo real)

---

## Etapa 2: Edge Functions

### insta-fetch-profile
- Busca dados de 1 perfil via Apify (preview ao adicionar)
- POST `{ "username": "..." }`
- Retorna: username, displayName, followerCount, followingCount, postsCount, profilePicture

### insta-update-profiles
- Atualiza metricas de um ou todos os perfis
- POST com body opcional: `{ "profileId": "uuid" }` ou `{ "organizationId": "uuid" }` ou sem body (todos)
- Lotes de 3, timeout 25s, 3 retries com backoff
- UPSERT em `insta_follower_metrics`
- Calcula `daily_change` vs dia anterior
- Baixa foto de perfil para bucket `insta-profile-pictures`

### insta-scheduled-update
- Endpoint para cron externo (cron-job.org)
- Atualiza TODOS os perfis ativos
- Health check via `?mode=health`

---

## Etapa 3: Frontend - Componentes

Pasta: `src/components/instagram/`

### Componentes principais:
- **InstagramDashboard** - Pagina principal com cards resumo, ranking e graficos
- **InstagramProfileCard** - Card de perfil com foto, seguidores, variacao, sparkline
- **InstagramProfilesList** - Grid de todos os perfis com busca/filtro/ordenacao
- **InstagramProfileDetail** - Detalhe com graficos, historico e notas
- **InstagramAnalytics** - Ranking de crescimento com medalhas e comparativos
- **AddProfileModal** - Modal para adicionar perfil (busca via edge function)
- **EditProfileModal** - Modal para editar perfil existente
- **GrowthAreaChart** - Grafico area de evolucao de seguidores (Recharts)
- **DailyChangeBarChart** - Grafico barra de variacao diaria verde/vermelho
- **MiniSparkline** - Sparkline SVG para cards
- **MetricsHistoryTable** - Tabela paginada com exportacao CSV
- **CampaignNotesSection** - CRUD de notas por perfil
- **LastUpdatedBadge** - Badge com tempo desde ultima atualizacao

### Hooks:
- `useInstagramProfiles` - CRUD de perfis
- `useInstagramMetrics` - Consulta de metricas com filtro de periodo
- `useInstagramUpdate` - Dispara atualizacao via edge function

### Utils:
- `src/lib/instagram-utils.ts` - Calculos de media, formatacao, parse de username/URL

---

## Etapa 4: Rotas e Navegacao

### Nova rota no App.tsx:
- `/admin/instagram` - Pagina principal do Instagram Insights (com sub-abas internas via Tabs)

### Atualizar AdminLayout.tsx:
- Adicionar item no menu `superAdminNavItems`:
  ```
  { path: '/admin/instagram', icon: Instagram, label: 'Instagram' }
  ```

### Estrutura interna (Tabs dentro da pagina):
- **Visao Geral** - Dashboard com cards e ranking
- **Perfis** - Grid de todos os perfis
- **Analises** - Graficos comparativos e ranking detalhado

Ao clicar em um perfil, abre um Dialog/Sheet com o detalhe completo (sem rota separada, mantendo tudo encapsulado).

---

## Etapa 5: Migracao de Dados

Os 8 perfis e ~250 registros de metricas do projeto original precisarao ser importados. Isso sera feito via SQL INSERT apos a criacao das tabelas, vinculando ao `organization_id` da TOP Brasil.

---

## Arquitetura de Isolamento

```text
src/
  components/
    instagram/          <-- Modulo isolado
      InstagramDashboard.tsx
      InstagramProfileCard.tsx
      InstagramProfilesList.tsx
      ...
  lib/
    instagram-utils.ts  <-- Utils isoladas
  pages/
    AdminInstagram.tsx   <-- Pagina wrapper

supabase/
  functions/
    insta-fetch-profile/    <-- Edge functions isoladas
    insta-update-profiles/
    insta-scheduled-update/

Banco de dados:
  insta_profiles          <-- Tabelas isoladas
  insta_follower_metrics
  insta_campaign_notes
```

Remover o modulo = deletar a pasta `instagram/`, a pagina, as edge functions e as tabelas. Zero impacto no resto.

---

## Sequencia de Implementacao

1. Solicitar secret `APIFY_API_KEY`
2. Criar migration SQL (tabelas + RLS + bucket)
3. Criar edge functions (fetch, update, scheduled)
4. Criar componentes e hooks
5. Adicionar rota e menu no sidebar
6. Importar dados historicos dos 8 perfis

