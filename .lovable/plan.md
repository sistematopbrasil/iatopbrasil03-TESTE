
# Plano — Toggle de funil e edição de funis para consultores

Investiguei o código e o estado do banco. Identifiquei exatamente o que está acontecendo. **A funcionalidade de edição de funis JÁ EXISTE e está integrada**, mas há um detalhe que está escondendo o toggle e a percepção de que a edição não está disponível.

---

## O que está acontecendo de fato

### 1. Toggle de funil não aparece pra você (super admin)

Você está logado como **`topbrasil@gmail.com`** (super admin). Consultei o banco:

```
super_admin: allowed_funnels = {consultor}   ← só 1 funil
```

O `FunnelSwitcher` (sidebar) tem a regra: "se só tem 1 funil disponível e não tem opção 'Todos', esconde". Como o seu super admin só tem `{consultor}` no `allowed_funnels`, o switcher esconde.

Os consultores que você criou **estão corretos** no banco:
```
teste4:           {consultor, associado}   ✅
teste 2 funis:    {consultor, associado}   ✅
teste associados: {associado}              ✅
```

Se você logar como `teste4@gmail.com` ou `teste2@gmail.com`, o toggle vai aparecer normalmente na sidebar (canto inferior, acima do nome do usuário, em formato de pill segmentado "Consultor | Associado").

### 2. Edição de funis "não aparece" nos perfis existentes

Já existe e está integrada. No painel **Super Admin → Consultores**, na coluna "Ações" (ícone de 3 pontinhos `⋮` ao final de cada linha), o menu já tem o item **"Editar funis de acesso"** (com ícone de camadas), entre "Ativar/Desativar" e "Excluir". Ele abre o `EditConsultantFunnelDialog` que carrega `allowed_funnels` + `default_funnel` atuais e permite alterar.

O problema é apenas de **descoberta**: o item está dentro do dropdown e fica em destaque baixo.

---

## O que vou fazer

### A. Garantir o toggle pro super admin

Atualizar o `allowed_funnels` do super admin (`topbrasil@gmail.com`) para `{consultor, associado}` e `default_funnel = consultor`. Assim o switcher passa a mostrar **3 opções**: `Consultor | Associado | Todos` na sidebar, e você consegue alternar visões a partir da própria conta admin sem precisar logar como consultor.

### B. Tornar a edição de funis óbvia e descoberta

1. **Coluna dedicada "Funis" na tabela** (desktop): mostra dois badges coloridos (`C` para Consultor, `A` para Associado) destacando o `default_funnel` com cor primária. Ao clicar no badge, abre o `EditConsultantFunnelDialog` direto. Sem precisar passar pelo dropdown.

2. **Botão direto "Editar funis" visível no card mobile** (não escondido no dropdown) — uma linha extra com `Layers` + texto "Funis: Consultor, Associado ▸" clicável.

3. **Manter o item no dropdown** como está (atalho secundário).

### C. Confirmar o fluxo de criação

O `CreateConsultantDialog` já tem a seção "Acesso a Funis" com checkboxes. Vou verificar se está visível ao criar e ajustar o realce visual da seção pra ficar inconfundível (borda mais forte, cabeçalho destacado).

---

## Arquivos alterados

- **Migration**: `UPDATE public.users SET allowed_funnels = ARRAY['consultor','associado']::funnel_type[], default_funnel = 'consultor' WHERE role = 'super_admin' AND email = 'topbrasil@gmail.com';`
- `src/components/super-admin/ConsultantsTable.tsx`:
  - Nova coluna "Funis" (desktop) com badges clicáveis
  - Bloco "Funis" clicável no card mobile (acima dos toggles CRM/Ranking)
  - Mantém item "Editar funis de acesso" no dropdown
- `src/components/super-admin/CreateConsultantDialog.tsx`:
  - Reforço visual no bloco "Acesso a Funis" (borda primária leve, label maior)

Nada mais é alterado. Sem mudança em rotas, slugs, edge functions, RLS ou tipos.

---

## Detalhes técnicos

- A coluna nova consome `consultant.allowed_funnels` e `consultant.default_funnel` que precisam ser expostos pelo `useRankingData` / `ranking-get`. **Verificar:** se a edge `ranking-get` ainda não retorna esses campos, adicionar `allowed_funnels, default_funnel` no SELECT da query principal e na interface `ConsultantRankingData`. Sem mudança de comportamento — apenas inclusão de colunas.
- O switcher `FunnelSwitcher` não precisa ser tocado: assim que o super admin tiver `allowed_funnels` com 2 valores, a regra `availableFunnels.length > 1 && canSeeAll` libera a opção "Todos" automaticamente.
- A migration toca apenas no super admin específico. Demais usuários permanecem como estão.

---

## Riscos

- Zero. A migration ajusta apenas a configuração do próprio super admin (ele já é super_admin e enxerga tudo via RLS — `allowed_funnels` só governa o switcher, não filtros de banco). Os componentes alterados são aditivos: a coluna nova aparece, o dropdown continua igual, e o card mobile ganha um bloco a mais.

Posso começar?
