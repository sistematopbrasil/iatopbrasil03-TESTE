# Ajustes Top Bio + Instagram por consultor

## 1. Preview do Top Bio acompanha o scroll
No `BioEditor.tsx` o preview fica em uma coluna lateral (`grid lg:grid-cols-[1fr_400px]`), mas sem `position: sticky`, então sai da tela ao rolar.

- Envolver a coluna de preview em uma `div` com `lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto`.
- Garantir que o `AdminLayout` não use `overflow-hidden` no container que quebra o sticky (verificar e ajustar a wrapper se necessário).
- Mostrar também o **link da bio** dentro do card de preview (URL + botão copiar), reforçando a visibilidade.

## 2. Consultor só vê os próprios perfis do Instagram
Hoje `useInstagramProfiles` faz `select * from insta_profiles` e a RLS filtra por `consultant_id`, mas só quando ele está preenchido. Precisamos:

- **Migração SQL**: ajustar a policy de SELECT em `insta_profiles` para:
  - Super Admin / Admin da org → vê todos da organização (como hoje).
  - Consultor → vê apenas linhas onde `consultant_id = auth.uid()`.
- No hook `useInstagramProfiles`, manter o `select *` (a RLS cuida), mas trocar a `queryKey` para incluir o user id evitando cache cruzado.
- No `ConsultantInstagram.tsx`, esconder o botão "Adicionar" do `InstagramProfilesList` quando o usuário não for admin (criar prop `canManage`). Consultor só visualiza seus perfis vinculados pelo admin.

## 3. Toggle "Mostrar Instagram" por consultor (no painel Super Admin)
A página Top Bio sempre fica disponível para o consultor; já o **acompanhamento de Instagram** (aba Meus Perfis + Análises) deve poder ser ligado/desligado pelo Super Admin.

- **Migração SQL**: adicionar coluna `instagram_visible boolean default true` em `users`.
- Em `ConsultantsTable.tsx`, ao lado dos toggles de **CRM** e **Ranking**, adicionar toggle **Instagram** (mobile e desktop), com mutation análoga a `toggleRankingMutation`.
- No `useRankingData` / consulta de consultores, trazer o novo campo.
- Em `AdminLayout.tsx`, o item "Instagram" do sidebar do consultor só aparece se `user.instagram_visible !== false`. Top Bio continua acessível por uma rota direta `/admin/top-bio` (nova rota dedicada que renderiza só o `BioEditor`) — assim mesmo sem Instagram, o consultor entra em "Top Bio" pelo sidebar.
- Resultado no sidebar do consultor:
  - Sempre: **Top Bio**
  - Condicional ao toggle: **Instagram** (com sub-abas Meus Perfis / Análises)

## 4. Vincular Instagram já na criação do consultor
No `CreateConsultantDialog.tsx`, adicionar um bloco opcional **"Perfil do Instagram (opcional)"** com:
- Campo username (`@`).
- Texto auxiliar: "Será adicionado ao painel Super Admin e vinculado a este consultor para acompanhamento do crescimento."

Fluxo:
1. Após `create-consultant` retornar o novo `user_id`, se houver username preenchido, fazer `insert` em `insta_profiles` com `organization_id`, `consultant_id = novo user_id`, `username`, `profile_url`.
2. Disparar (best-effort, não-bloqueante) a edge function `insta-fetch-profile` para já popular foto e métricas iniciais.
3. Invalidar `['insta-profiles']`.

Também adicionar, no `ConsultantsTable` (menu de ações de cada consultor existente), opção **"Adicionar perfil Instagram"** que abre um diálogo simples com o mesmo fluxo, para consultores já criados.

## 5. Link da bio visível também no Super Admin
No `ConsultantsTable.tsx`, adicionar no menu de ações de cada consultor:
- **Copiar link Top Bio** e **Abrir Top Bio** (usando o slug do consultor; buscar via join com `bio_pages` no `useRankingData` ou query auxiliar).

## Arquivos afetados

```text
supabase/migrations/<novo>.sql      RLS insta_profiles + coluna instagram_visible
src/components/consultant/BioEditor.tsx          preview sticky + link no preview
src/components/admin/AdminLayout.tsx             item Instagram condicional + Top Bio dedicado
src/pages/ConsultantInstagram.tsx                ocultar "Adicionar" para consultor
src/pages/ConsultantTopBio.tsx (novo)            página Top Bio independente
src/App.tsx                                      rota /admin/top-bio
src/components/instagram/InstagramProfilesList.tsx  prop canManage
src/hooks/useInstagramProfiles.ts                queryKey por user
src/hooks/useRankingData.ts                      trazer instagram_visible + bio slug
src/components/super-admin/ConsultantsTable.tsx  toggle Instagram + ações Top Bio + add Insta
src/components/super-admin/CreateConsultantDialog.tsx  campo Instagram opcional
src/components/super-admin/AddInstagramToConsultantDialog.tsx (novo)
```

Posso seguir com a implementação?