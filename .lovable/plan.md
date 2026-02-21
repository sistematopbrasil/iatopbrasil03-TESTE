

## Plano: Sync de Hoje, Filtros de Data com Calendario e Reordenacao do Menu

### 1. Sync incluindo dados de hoje

**Problema**: A Meta API com `date_preset=last_3d` retorna apenas os 3 dias anteriores, sem incluir o dia atual. Por isso "Hoje" nunca tem dados.

**Correcao em `sync-all-accounts/index.ts`**: Apos o sync principal (last_90d ou last_3d), fazer uma chamada adicional com `date_preset=today` para garantir que os dados do dia atual sejam sempre capturados.

**Correcao em `fetch-meta-ads-data/index.ts`**: Garantir que o preset `today` funciona corretamente (ja funciona, pois a Meta API suporta esse preset nativamente).

### 2. Atualizar filtros de periodo (TrafficPeriodFilter)

Mudancas nos presets:
- Manter: Hoje, 7 dias, 14 dias, 30 dias, Total
- **Adicionar**: "Ontem" (logo apos Hoje)
- **Remover**: "60 dias"
- **Adicionar**: Botao de calendario para periodo personalizado (usando Popover + Calendar em modo range, igual ao DatePeriodFilter do Instagram)

### 3. Reordenar menu do sidebar (AdminLayout)

Mover "Ranking" para antes de "Instagram" e "Trafego" no array `superAdminNavItems`:

```text
Atual:   Dashboard > Consultores > Instagram > Trafego > Ranking > Config
Novo:    Dashboard > Consultores > Ranking > Instagram > Trafego > Config
```

---

### Arquivos afetados

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/sync-all-accounts/index.ts` | Adicionar chamada extra com `date_preset=today` apos sync principal |
| `src/components/traffic/TrafficPeriodFilter.tsx` | Remover 60d, adicionar Ontem, adicionar calendario personalizado |
| `src/components/admin/AdminLayout.tsx` | Reordenar Ranking antes de Instagram/Trafego |

