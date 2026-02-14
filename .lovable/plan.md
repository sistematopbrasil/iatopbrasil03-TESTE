

## Melhorias no Instagram Insights

### 1. Editar Perfil do Instagram

Adicionar um botao "Editar" no painel de detalhes do perfil (`InstagramProfileDetail`) que permite alterar:
- Username (@)
- Nome de exibicao
- Categoria
- Notas

Ao mudar o username, o sistema tambem atualizara o `profile_url` automaticamente.

---

### 2. Filtro por Data com Presets

Criar um componente reutilizavel `DatePeriodFilter` que sera usado nas 3 abas (Dashboard, Perfis, Analises).

**Opcoes de filtro:**
- Hoje
- Ontem
- Ultimos 7 dias
- Ultimos 30 dias
- Total
- Periodo personalizado (date range picker com calendario)

O filtro controlara quais metricas sao exibidas, filtrando pela coluna `recorded_date`.

---

### 3. Ordenacao Padrao por Maior Crescimento

Na aba Perfis (`InstagramProfilesList`), o valor padrao de `sort` sera alterado de `"recent"` para `"growth"`.

Na aba Analises (`InstagramAnalytics`), o ranking ja esta ordenado por crescimento por padrao, entao nao precisa de mudanca.

No Dashboard (`InstagramDashboard`), os cards de perfil tambem serao reordenados por crescimento diario.

---

### Detalhes Tecnicos

**Componente `DatePeriodFilter`** (novo arquivo `src/components/instagram/DatePeriodFilter.tsx`):
- Select com as opcoes de preset (Hoje, Ontem, 7d, 30d, Total)
- Quando "Personalizado" for selecionado, exibe um Popover com calendario de selecao de intervalo (date range)
- Usa `react-day-picker` no modo `range` com `pointer-events-auto`
- Retorna `{ from: Date | null, to: Date | null }` para o componente pai

**Alteracoes em arquivos existentes:**

1. **`InstagramProfileDetail.tsx`** -- Adicionar botao "Editar" e dialog/formulario inline para editar username, display_name, category e notes. Usa a mutacao `updateProfile` ja existente.

2. **`InstagramProfilesList.tsx`** -- Trocar sort padrao para `"growth"`. Adicionar o componente `DatePeriodFilter` na toolbar. Passar o filtro de datas para a logica de metricas.

3. **`InstagramDashboard.tsx`** -- Adicionar `DatePeriodFilter`. Ordenar grid de perfis por crescimento. Filtrar metricas pelo periodo selecionado.

4. **`InstagramAnalytics.tsx`** -- Adicionar `DatePeriodFilter`. Filtrar metricas pelo periodo selecionado para que o ranking reflita o periodo escolhido.

5. **`instagram-utils.ts`** -- Adicionar funcao helper `getDateRangeFromPreset(preset: string): { from: Date | null, to: Date | null }` para converter presets em datas.

