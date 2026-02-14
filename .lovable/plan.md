

# Migracao de Dados do Instagram + Cron Job

## O que sera feito

### 1. Importar dados historicos

Adaptar o SQL de migracao para as tabelas do novo projeto:

- `instagram_profiles` -> `insta_profiles` (substituindo `user_id` por `organization_id`)
- `follower_metrics` -> `insta_follower_metrics`
- Organization ID: `5d18251b-2926-4509-9b19-b0ee02379af2`
- 8 perfis + 250 registros de metricas

Os IDs originais dos perfis serao mantidos para que as metricas referenciem corretamente.

### 2. Configurar Cron Job

Configurar cron via `pg_cron` + `pg_net` direto no banco para disparar a edge function `insta-scheduled-update` automaticamente:

- **08:00 BRT** (11:00 UTC) - atualizacao da manha
- **23:00 BRT** (02:00 UTC) - atualizacao da noite

Isso elimina a necessidade de servico externo (cron-job.org), tudo fica dentro do proprio backend.

### Detalhes tecnicos

**Migration SQL para dados** (via insert tool, nao migration):
- INSERT dos 8 perfis na tabela `insta_profiles` com `organization_id` no lugar de `user_id`
- INSERT dos 250 registros de metricas na tabela `insta_follower_metrics`
- Manter os UUIDs originais para consistencia

**Cron SQL** (via insert tool):
```text
-- Habilitar extensoes pg_cron e pg_net (migration)
-- Criar 2 cron jobs:
--   'insta-update-morning' -> 0 11 * * * (08:00 BRT)
--   'insta-update-night'   -> 0 2 * * *  (23:00 BRT)
-- Cada job faz HTTP POST para insta-scheduled-update
```

**Apos importar**: Rodar a edge function `insta-update-profiles` para atualizar as fotos de perfil.

