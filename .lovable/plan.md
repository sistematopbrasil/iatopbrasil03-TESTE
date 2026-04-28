## Objetivo

Cinco ajustes pedidos pelo usuário em torno da página de captura de Associados, gestão do pipeline por funil, criação automática de instâncias WhatsApp por funil, gestão de consultores no painel super admin (email/senha) e reset de ranking com histórico.

---

## 1. Página de Captura de Associados — novo título e foco em conversão

**Problema:** título atual "Quer uma renda extra ou mudar de vida?" virou padrão da rota `/c/:slug` (Associados/proteção), mas esse texto é de recrutamento. Além disso, o formulário fica escondido lá embaixo — usuário quer captura direta.

**Mudanças em `src/pages/CapturePage.tsx`:**
- `getDefaultConfig(false)` (rota `/c/`, captura de Associados / proteção veicular) recebe novo título de captura forte:
  - **Título:** `"Proteja seu veículo por até 70% menos.\nSem burocracia, sem consulta de crédito."`
  - **Subtítulo:** `"Cobertura completa contra roubo, furto, colisão e assistência 24h. Solicite uma cotação grátis e descubra quanto você pode economizar."`
  - **Botão:** `"Quero minha cotação grátis →"`
- Para o template `landing` na rota `/c/`, adicionar uma **variante "captura direta"**: o formulário sobe para dentro da hero (lado direito em desktop, abaixo do título em mobile) em vez de ficar somente após CTA scroll. O CTA do hero passa a ser secundário ("Ver planos abaixo") e o formulário fica visível de cara — mantém todas as outras seções (benefícios, comparativo, galeria, etc.) intactas abaixo.
- Editor em `src/components/consultant/ConsultantSettings.tsx` (`getDefaults('protection')` da página de captura) recebe os mesmos defaults novos, para quem ainda não personalizou.

**Não muda** nada na rota `/r/:slug` (recrutamento) nem em `/quiz/`.

---

## 2. Quadros do pipeline misturando os dois funis

**Problema:** o gerenciador de quadros (`PipelineStageManager`) lista TODOS os stages da organização, ignorando o funil ativo — por isso aparecem "Novos Leads" duplicados, "Novos Associados" + "Consultor", etc.

**Mudanças em `src/components/crm/PipelineStageManager.tsx`:**
- Consumir `useFunnel()` e usar `resolvedFunnel` para:
  - Filtrar a query `pipeline-stages` por `funnel_type = resolvedFunnel`.
  - Definir o `funnel_type` ao criar um novo quadro.
  - Mostrar no cabeçalho qual funil está sendo configurado: "Quadros do Pipeline — funil **Consultores**" (ou Associados), com o seletor de funil sempre visível para alternar.
- A query passa a ter `queryKey: ['pipeline-stages', resolvedFunnel]`.
- Manter retrocompat: stages legados sem `funnel_type` são `'consultor'` por default (já é o default da coluna).

---

## 3. Instâncias WhatsApp por funil — criação automática no cadastro

**Problema atual:**
- Ao criar um consultor, somente UMA instância é criada (sem distinção de funil).
- O nome é genérico (ex: `davidmm3qr`) — não indica o funil.
- Quando o consultor tem acesso aos dois funis (Consultor + Associado), a instância de Associado nunca é criada.

**Mudanças em `supabase/functions/create-consultant/index.ts`:**
- Após criar o `users`, **iterar sobre `normalizedAllowed`** e criar **uma instância por funil habilitado**.
- Nome da instância: `<base>-consultor` ou `<base>-associados`, onde `<base>` é o nome sanitizado (slug curto sem acentos / sem caracteres especiais).
  - Exemplo: David → `david-consultor`, `david-associados`.
- Se o nome já existir na tabela `whatsapp_instances` (constraint `instance_name UNIQUE`), incrementar sufixo: `david-consultor-2`, `david-consultor-3`, etc. Reutilizar a função `generate_unique_instance_name(base)` que já existe no banco — chamar via RPC passando `<base>-<funil>` como base.
- Cada `INSERT` em `whatsapp_instances` recebe `funnel_type` correto (constraint `(user_id, funnel_type)` única já existe).
- Manter a chamada à Evolution API para cada instância criada (com seu próprio webhook).
- Se Evolution API não estiver configurada, apenas pula (igual hoje).

**Mudanças em `supabase/functions/crm-create-instance/index.ts`** (criação manual via UI da CRM):
- Ao criar uma nova instância, mudar a geração do nome para `<username>-<funnel_type>` (ex: `davidmm3qr-consultor`) para alinhar com a convenção. Em caso de conflito, sufixar `-2`, `-3`.

**Sem migration de dados** das instâncias atuais (não renomeia o que já existe — o usuário pediu a regra para criações futuras).

---

## 4. Editar email e senha de um consultor pelo painel Super Admin

**Mudanças:**

- **Nova edge function `update-consultant-credentials`** (`supabase/functions/update-consultant-credentials/index.ts`):
  - Autenticada, valida `is_super_admin()`.
  - Recebe `{ consultant_id, new_email?, new_password? }`.
  - Busca `auth_user_id` do consultor.
  - Usa `supabaseAdmin.auth.admin.updateUserById(authUserId, { email, password })`.
  - Atualiza também `users.email` quando o email mudar.
  - Validações: senha mín 8 chars, email válido.
  - Audita via `create_audit_log`.

- **Frontend em `src/components/super-admin/ConsultantsTable.tsx`:**
  - Adicionar item no `DropdownMenu` de cada consultor: **"Alterar email/senha"**.
  - Novo componente `EditConsultantCredentialsDialog.tsx` com dois campos opcionais (email novo / senha nova) e botão Salvar — chama a edge function via `supabase.functions.invoke`.

---

## 5. Reset de Ranking com histórico preservado

**Necessidade:** zerar o ranking para iniciar uma nova competição num período definido, mas manter os dados anteriores acessíveis para histórico.

**Migration SQL:**
1. Criar tabela `ranking_history` com a mesma estrutura de `ranking_scores` + colunas extras:
   - `archived_at timestamptz NOT NULL DEFAULT now()`
   - `competition_label text` (ex: "Competição Out/2025")
   - `archived_by uuid` (super admin que arquivou)
   - RLS: super admin da org pode SELECT/INSERT.
2. Criar função `archive_and_reset_ranking(p_competition_label text)`:
   - SECURITY DEFINER, exige `is_super_admin()`.
   - Copia todas as linhas de `ranking_scores` da org do super admin para `ranking_history` com `competition_label` informado.
   - `DELETE FROM ranking_scores WHERE organization_id = get_user_organization_id()`.
   - Audita em `crm_audit_logs`.
3. Função `list_ranking_history()` que retorna competições arquivadas agrupadas por `competition_label` com totais.

**Frontend — nova seção em `src/components/super-admin/SuperAdminSettings.tsx`:**
- Card "Gerenciar Ranking" com:
  - Botão "Resetar Ranking (iniciar nova competição)" → abre `AlertDialog` pedindo nome da competição (placeholder "Ex: Competição Novembro/2025") + confirmação dupla.
  - Lista expansível de competições arquivadas (chamando `list_ranking_history`) — mostra label, data, top 5 do período. Botão "Ver detalhes" abre dialog com tabela completa.

---

## Arquivos a alterar / criar

**Editados:**
- `src/pages/CapturePage.tsx` (defaults + variante captura direta)
- `src/components/consultant/ConsultantSettings.tsx` (defaults editor)
- `src/components/crm/PipelineStageManager.tsx` (filtro por funil)
- `src/components/super-admin/ConsultantsTable.tsx` (menu editar credenciais)
- `src/components/super-admin/SuperAdminSettings.tsx` (card de reset ranking)
- `supabase/functions/create-consultant/index.ts` (loop de instâncias por funil + nome)
- `supabase/functions/crm-create-instance/index.ts` (nome com sufixo de funil)

**Novos:**
- `src/components/super-admin/EditConsultantCredentialsDialog.tsx`
- `src/components/super-admin/RankingResetCard.tsx`
- `src/components/super-admin/RankingHistoryDialog.tsx`
- `supabase/functions/update-consultant-credentials/index.ts`

**Migration SQL:**
- Tabela `ranking_history` + RLS
- Função `archive_and_reset_ranking(text)`
- Função `list_ranking_history()`

---

## Observações de segurança e consistência

- A edge function de credenciais valida super admin no servidor (não só no client).
- A função de reset é SECURITY DEFINER mas exige `is_super_admin()`, escopo organização (multi-tenant).
- Instâncias da Evolution API ganham nomes legíveis (`david-consultor`) — facilita debug, mas mantém auto-sufixo numérico em colisões.
- Pipeline por funil: nenhum stage é apagado/migrado — o filtro só passa a respeitar `funnel_type`.