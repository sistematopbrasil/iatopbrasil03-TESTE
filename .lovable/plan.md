

## Correção: Adicionar coluna `days_synced` na tabela `ad_accounts`

### Problema
A edge function `sync-all-accounts` referencia `ad_accounts.days_synced` para decidir entre sync inicial (90 dias) ou incremental (3 dias), mas essa coluna nunca foi criada no banco.

### Solução

**1. Migração de banco de dados**
Adicionar a coluna `days_synced` (integer, default 0) na tabela `ad_accounts`:

```sql
ALTER TABLE public.ad_accounts ADD COLUMN IF NOT EXISTS days_synced integer DEFAULT 0;
```

**2. Nenhuma mudança de código necessária**
A edge function `sync-all-accounts` já está correta -- ela lê `days_synced` e atualiza após cada sync. Só faltava a coluna no banco.

### Resultado esperado
Após a migração, o botão "Sincronizar" funcionará normalmente:
- Contas com `days_synced = 0` puxarão os últimos 90 dias
- Contas já sincronizadas puxarão os últimos 3 dias (incremental)

