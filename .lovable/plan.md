

## Correção: Colunas Faltantes + Re-sync Completo

### Causa Raiz

A edge function `fetch-meta-ads-data` tenta gravar nas colunas `link_clicks`, `post_engagement` e `video_views` na tabela `ad_metrics`, mas essas colunas **nao existem no banco**. Isso faz com que **100% dos upserts falhem**, e nenhum dado novo e salvo. Os 27 registros existentes sao de uma versao anterior do codigo que nao incluia esses campos.

Alem disso, o `sync-all-accounts` marcou `days_synced = 90` sem verificar se o sync realmente funcionou, entao agora ele so tenta puxar 3 dias em vez de 90.

### Solucao

**1. Migracao de banco de dados**

Adicionar as 3 colunas faltantes e resetar `days_synced`:

```sql
-- Colunas que a edge function tenta gravar mas nao existem
ALTER TABLE public.ad_metrics ADD COLUMN IF NOT EXISTS link_clicks bigint DEFAULT 0;
ALTER TABLE public.ad_metrics ADD COLUMN IF NOT EXISTS post_engagement bigint DEFAULT 0;
ALTER TABLE public.ad_metrics ADD COLUMN IF NOT EXISTS video_views bigint DEFAULT 0;

-- Resetar days_synced para forcar re-sync completo de 90 dias
UPDATE public.ad_accounts SET days_synced = 0;
```

**2. Corrigir sync-all-accounts para validar resultado**

Antes de atualizar `days_synced`, verificar se o fetch realmente salvou dados:

```typescript
// Antes (sempre atualiza):
await supabase.from("ad_accounts").update({ days_synced: 90 })

// Depois (so atualiza se synced > 0):
if (data.synced && data.synced > 0) {
  await supabase.from("ad_accounts").update({ days_synced: ... })
}
```

**3. Sobre a frequencia**

A frequencia na API Meta e por dia (ex: 1.04x). O frontend faz media aritmetica dos valores diarios, o que e correto. A metrica ja esta sendo salva e exibida corretamente -- o problema era que os dados novos nao estavam sendo salvos.

### Resultado Esperado

Apos a migracao + re-deploy + clicar em "Sincronizar":
- 90 dias de historico serao puxados e salvos com sucesso
- `link_clicks`, `post_engagement`, `video_views` serao preenchidos
- Dados de hoje aparecerão
- Syncs futuros adicionarão 3 dias incrementais

### Arquivos Afetados

| Arquivo | Mudanca |
|---|---|
| Migracao SQL | Adicionar 3 colunas + resetar days_synced |
| `sync-all-accounts/index.ts` | Validar resultado antes de atualizar days_synced |

