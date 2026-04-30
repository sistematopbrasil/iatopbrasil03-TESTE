## O que mudar

### 1. Top Bio dentro da aba Instagram
- Em `src/pages/ConsultantInstagram.tsx`: adicionar uma 3ª aba **"Top Bio"** ao lado de "Meus perfis" e "Análises". O conteúdo dessa aba carrega o `BioEditor` com os dados do consultor logado (mesmo padrão usado hoje em `ConsultantTopBio.tsx`).
- Em `src/components/admin/AdminLayout.tsx`: remover o item "Top Bio" da sidebar do consultor (linha 70). O acesso passa a ser sempre dentro de Instagram.
- Em `src/App.tsx`: manter a rota `/admin/top-bio` redirecionando para `/admin/instagram?tab=top-bio` para não quebrar links já copiados/abas existentes. A página `ConsultantInstagram` lê o query param `?tab=` para abrir a aba certa.
- `ConsultantTopBio.tsx` deixa de ser usado pela navegação, mas mantemos o arquivo para compatibilidade da rota redirecionada.

### 2. Botão "Criar minha página" sem feedback
O `ensureMutation.mutate()` no `BioEditor` é disparado sem callbacks de sucesso/erro, então qualquer falha (RLS, conflito, etc.) acontece silenciosamente — daí a sensação de "não faz nada".

Correção em `src/components/consultant/BioEditor.tsx`:
- Passar `{ onSuccess, onError }` no `ensureMutation.mutate()` chamado pelo botão, com toast de sucesso ("Página criada!") e toast de erro mostrando a mensagem real.
- Bloquear o botão se `userId` ou `organizationId` estiverem vazios, exibindo um aviso amigável (evita o caso de o `getCurrentConsultant` ainda não ter resolvido).

### 3. Visibilidade da aba Instagram
Hoje, se o Super Admin desativar `instagram_visible`, o consultor perde acesso ao Top Bio também. Como combinado anteriormente, o Top Bio deve ficar **sempre acessível**. Solução:
- Manter a aba **Instagram** sempre visível na sidebar do consultor (remover a guarda `instagram_visible !== false` da linha 69 de `AdminLayout.tsx`).
- Dentro da página, ocultar **apenas** as abas "Meus perfis" e "Análises" quando `instagram_visible === false`. A aba "Top Bio" continua disponível e vira a aba padrão nesse caso. Quando ambas estiverem ocultas, o cabeçalho passa a falar de "Top Bio".

## Arquivos afetados
- `src/pages/ConsultantInstagram.tsx` (adiciona 3ª aba, lê query param, respeita `instagram_visible`)
- `src/components/admin/AdminLayout.tsx` (remove item Top Bio + remove guarda da aba Instagram)
- `src/App.tsx` (transforma `/admin/top-bio` em redirect)
- `src/components/consultant/BioEditor.tsx` (toasts no botão "Criar minha página", botão desabilitado sem sessão)

## Detalhes técnicos
- Não há mudança de banco. RLS/migrations de `bio_pages` permanecem.
- `ConsultantTopBio.tsx` fica como redirect simples (`<Navigate to="/admin/instagram?tab=top-bio" replace />`).
- Query param tratado com `useSearchParams` no `ConsultantInstagram`.
