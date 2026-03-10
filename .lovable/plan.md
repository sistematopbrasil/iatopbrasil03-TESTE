

## Plano: Corrigir Métrica de Visitas ao Perfil no Tráfego

### Problema

A métrica "Visitas ao Perfil" está incorreta porque o edge function `fetch-meta-ads-data` usa action types que não existem na Meta Ads API:

```typescript
// Atual — action types incorretos
const profile_visits = findAction(
  "onsite_conversion.profile_visit",  // NÃO EXISTE na Meta API
  "page_engagement"                    // Fallback errado — é engajamento de página, não visitas ao perfil
);
```

O action type `onsite_conversion.profile_visit` não é um tipo válido na Meta Ads Insights API. O fallback `page_engagement` retorna dados de engajamento geral da página (curtidas, comentários, etc.), não visitas ao perfil.

### Solução

A Meta Ads API não oferece "visitas ao perfil" como action type direto no endpoint de Insights de conta. No entanto, existem actions relevantes que podem ser usados:

1. **`instagram_profile_visit`** — Ação de visita ao perfil do Instagram (disponível em campanhas com objetivo de tráfego/engajamento)
2. **`onsite_conversion.instagram_profile_visit`** — Variante com prefixo onsite

**Correção no `fetch-meta-ads-data/index.ts`**: Atualizar o `findAction` para usar os action types corretos da API e remover o fallback incorreto `page_engagement`:

```typescript
const profile_visits = findAction(
  "instagram_profile_visit",
  "onsite_conversion.instagram_profile_visit",
  "onsite_conversion.profile_visit"
);
```

Isso remove `page_engagement` como fallback (que inflava o número) e adiciona `instagram_profile_visit` como tipo primário.

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/fetch-meta-ads-data/index.ts` | Corrigir action types para profile_visits |

### Impacto

- Dados **futuros** serão salvos com o valor correto de visitas ao perfil
- Dados **antigos** já salvos no banco continuarão com valores incorretos. Será necessário re-sincronizar (redefinir `days_synced` para 0 nas contas) para corrigir o histórico

