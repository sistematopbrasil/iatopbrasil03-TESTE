

## Plano: Instagram Data Import + Cron + Prefetch Pages

### 1. Inserir 9 perfis Instagram + métricas históricas no banco

Usar a ferramenta de insert SQL para:
- Primeiro buscar o `organization_id` do usuário atual
- Inserir 9 perfis na tabela `insta_profiles` com os dados fornecidos (username, display_name, category)
- Inserir todas as métricas históricas na tabela `insta_follower_metrics` (aproximadamente 220 registros)

**Perfis:**
| Username | Display Name | Categoria |
|---|---|---|
| brenonogueiraferraz | Breno Nogueira \| Top Brasil ✱ | Líder |
| davidfernandesaz | David Fernandes \| Proteção Veicular | Gerente |
| dioleno.topbrasil | Dioleno \| Top Brasil | Consultor |
| gabrielquinteiroo | Gabriel Quinteiro | Consultor |
| cris.topbrasil | Cris \| Top Brasil | Consultor |
| danilo.embaixador | Danilo Embaixador | Embaixador |
| loysegurgel | Loyse Gurgel | Gerente |
| paulinho.topbrasil | Paulinho \| Top Brasil | Consultor |
| thiagopinheiro.oficial | Thiago Pinheiro | Diretor |

### 2. Configurar cron job para atualização automática diária

Usar SQL insert para criar um cron job via `pg_cron` + `pg_net` que chama a edge function `insta-scheduled-update` uma vez por dia (ex: às 06:00 UTC). A edge function já existe e chama `insta-update-profiles` internamente.

### 3. Sobre o QR Code do CRM

Preciso investigar os logs da edge function `crm-get-qrcode` para entender a falha. O código parece correto — o problema pode ser na Evolution API (URL/KEY incorretas, instância não criada, etc.). Vou verificar os logs e, se necessário, ajustar a edge function.

### 4. Prefetch de páginas (já parcialmente implementado)

O `usePrefetchAdminData` já faz prefetch de quase todas as páginas. Porém, as query keys do prefetch nem sempre batem com as keys usadas nas páginas. Vou alinhar:

| Página | Query Key usada | Prefetch atual | Fix necessário |
|---|---|---|---|
| Dashboard | `['all-leads-consultant', userId]` | `['pipeline-leads', userId]` (diferente!) | Adicionar prefetch com key correta |
| Leads | `['pipeline-stages', orgId]` | `['pipeline-stages']` (sem orgId!) | Corrigir key no prefetch |
| Pipeline | `['pipeline-stages', orgId]`, `['pipeline-leads', userId]` | Parcial | Alinhar keys |
| CRM | `['conversations', 'all', '']` | OK | — |
| Analytics | `['quiz-submissions-analytics', '30', userId]` | OK | — |
| Ranking | `['unified-ranking', 'all', 'now']` | OK | — |
| Settings | `['current-user-settings']`, `['quiz-questions', userId]` | OK | — |

**Mudanças em `src/hooks/usePrefetchAdminData.ts`:**
- Adicionar prefetch com key `['all-leads-consultant', userId]` para o Dashboard
- Corrigir prefetch de pipeline-stages para usar key `['pipeline-stages', orgId]`
- Adicionar prefetch de `['pipeline-stages-filter']` para ConversationList do CRM

### Arquivos a editar
| Arquivo | Mudança |
|---|---|
| `src/hooks/usePrefetchAdminData.ts` | Alinhar query keys do prefetch com as páginas |
| SQL (insert tool) | Inserir perfis + métricas Instagram |
| SQL (insert tool) | Criar cron job diário para `insta-scheduled-update` |

### Sobre o QR Code
Vou verificar os edge function logs para diagnosticar a falha no escaneamento do QR Code antes de propor uma correção.

