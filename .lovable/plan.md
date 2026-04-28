## Resumo dos dois pontos

### 1. Erro "Failed to send a request to the Edge Function"

Esse erro é uma limitação conhecida do **ambiente de Preview** do Lovable: o proxy de fetch do preview intercepta certas requisições POST autenticadas e quebra a chamada à Edge Function. **Não é um bug no código** da função `update-consultant-credentials` — ela está implementada corretamente (CORS ok, validação de super_admin, isolamento por organização, atualização via Auth Admin API).

**Como validar:** testar a troca de email/senha na **URL publicada** (`https://iatopbrasil.lovable.app`), não no preview. Lá a chamada vai funcionar normalmente.

Não vou tentar "consertar" via headers CORS ou override de fetch — isso não resolve a causa raiz e pode introduzir regressões.

### 2. Adicionar a ação na aba "Gestão de Consultores"

Hoje a opção "Editar email/senha" só existe em `ConsultantsTable.tsx` (usado em `AdminSuperAdmin.tsx`). A página `src/pages/ConsultantsManagement.tsx` ("Gestão de Consultores") tem seu próprio dropdown de ações por consultor e precisa ganhar o mesmo item.

## Mudanças propostas

**`src/pages/ConsultantsManagement.tsx`**
- Importar `EditConsultantCredentialsDialog` e o ícone `KeyRound`.
- Adicionar estado `credEdit: { id, name } | null`.
- Adicionar `<DropdownMenuItem>` "Editar email/senha" no menu de ações de cada linha (visível apenas para super_admin, junto das outras ações administrativas).
- Renderizar `<EditConsultantCredentialsDialog>` no final do componente, controlado pelo estado.
- Verificar permissão usando o mesmo padrão já existente na página (checagem de role do `currentUser`).

**Comunicação ao usuário**
- Avisar que o erro acontece só no preview e instruir a testar na URL publicada.
- Confirmar que após o deploy a opção também estará na aba Gestão de Consultores.

## Fora do escopo
- Não vou alterar a Edge Function (`update-consultant-credentials`) — ela está correta.
- Não vou mexer em CORS, `verify_jwt` ou no client Supabase.
