# Ajustes finais: Instagram + Top Bio

## 1. Filtro de período do Instagram (Meu perfil)

**Arquivo:** `src/components/instagram/ConsultantSingleProfileView.tsx`

- Adicionar o botão **"Ontem"** ao seletor de período (entre "7 dias" e "30 dias", ou logo no início). Ao selecionar, filtra apenas o registro do dia anterior.
- Trocar os 2 cards de **"Média 7 dias"** e **"Média 30 dias"** por **"Total 7 dias"** e **"Total 30 dias"**, mostrando a soma de novos seguidores ganhos no período (soma de `daily_change`), em vez da média.
- Adicionar card extra **"Total Ontem"** ou ajustar dinamicamente conforme período selecionado? → Manter os 4 cards fixos: **Seguidores | Hoje | Total 7 dias | Total 30 dias** (ficou mais útil que média).

**Arquivo:** `src/lib/instagram-utils.ts`

- Adicionar função `calculateTotal(metrics, field, days)` que soma `daily_change` dentro do período (mesma lógica do `calculateAverage` mas sem dividir).

**Lógica do "Ontem" no seletor:** quando ativo, `periodDays = 1` mas filtrando exclusivamente o dia anterior (pular hoje). Implementado com filtro custom (`yesterday` como case especial em `filteredMetrics`).

## 2. Preview fixo no editor do Top Bio

**Arquivo:** `src/components/consultant/BioEditor.tsx`

Atualmente o container do preview usa `lg:sticky self-start`, mas como o **container pai é o `AdminLayout` que tem seu próprio scroll**, o `position: sticky` não está "agarrando" porque o ancestral de scroll não é o `<html>`.

Correção:
- Trocar a abordagem para `lg:sticky lg:top-4` no wrapper do preview, e garantir que **nenhum ancestral entre o sticky e o scroll container** tenha `overflow` que quebre o sticky.
- Inspecionar o grid pai (`lg:grid-cols-[1fr_400px]`) — adicionar `lg:items-start` (já tem) e remover qualquer `overflow-hidden` que esteja interrompendo o sticky no `AdminLayout` ou no wrapper do `ConsultantInstagram`/`ConsultantTopBio`.
- Definir altura máxima e scroll interno do próprio preview: `lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto` para que se a bio for muito longa, ela rola dentro do próprio cartão fixo.

Caso o sticky não funcione mesmo após ajustes (ancestrais com `overflow`), fallback: usar `lg:fixed` + cálculo de largura manual para a coluna direita do preview.

---

## Arquivos editados

- `src/components/instagram/ConsultantSingleProfileView.tsx` — botão "Ontem", cards de Total
- `src/lib/instagram-utils.ts` — função `calculateTotal`
- `src/components/consultant/BioEditor.tsx` — preview fixo de verdade
- Possivelmente `src/pages/ConsultantInstagram.tsx` ou `AdminLayout.tsx` se um ancestral com `overflow` estiver bloqueando o sticky

Posso seguir?
