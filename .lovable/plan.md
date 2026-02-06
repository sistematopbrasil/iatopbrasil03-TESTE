

# Correcao de Seguranca: Policies TO authenticated

## Problema

Os 2 erros e 1 warning restantes seguem o mesmo padrao ja corrigido nas tabelas `quiz_submissions_new` e `ranking_scores`: as policies SELECT nao especificam `TO authenticated`, permitindo que o role `anon` tente avalia-las.

## Tabelas Afetadas

### 1. `users` (Error)
Policies atuais sem restricao de role:
- SELECT: "Users can view users in their organization" -- falta `TO authenticated`
- UPDATE (own profile): sem restricao de role
- UPDATE (super admin): sem restricao de role
- INSERT (super admin): sem restricao de role
- DELETE (super admin): sem restricao de role

**Acao:** Recriar TODAS as policies com `TO authenticated`.

### 2. `consultant_recruits` (Error)
Policies atuais sem restricao de role:
- SELECT: "Users can view recruits in their organization" -- falta `TO authenticated`
- INSERT: sem restricao de role
- UPDATE: sem restricao de role

**Acao:** Recriar todas as policies com `TO authenticated`.

### 3. `tracking_sessions` (Warning)
A policy SELECT ja usa `get_user_organization_id()` que retorna NULL para anon. O scanner alerta porque INSERT/UPDATE sao publicos (necessario para tracking anonimo). A policy SELECT tambem nao especifica `TO authenticated`.

**Acao:** Recriar a policy SELECT com `TO authenticated`. INSERT e UPDATE permanecem publicos (necessarios para o quiz anonimo) e o warning sera marcado como ignorado.

## Migracao SQL

```sql
-- =============================================
-- USERS: Recriar policies com TO authenticated
-- =============================================
DROP POLICY IF EXISTS "Users can view users in their organization" ON public.users;
CREATE POLICY "Users can view users in their organization"
  ON public.users FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Super Admin can create consultants" ON public.users;
CREATE POLICY "Super Admin can create consultants"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() AND organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Super Admin can update consultants" ON public.users;
CREATE POLICY "Super Admin can update consultants"
  ON public.users FOR UPDATE TO authenticated
  USING (is_super_admin() AND organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Super Admin can delete consultants" ON public.users;
CREATE POLICY "Super Admin can delete consultants"
  ON public.users FOR DELETE TO authenticated
  USING (is_super_admin() AND organization_id = get_user_organization_id());

-- =============================================
-- CONSULTANT_RECRUITS: Recriar policies com TO authenticated
-- =============================================
DROP POLICY IF EXISTS "Users can view recruits in their organization" ON public.consultant_recruits;
CREATE POLICY "Users can view recruits in their organization"
  ON public.consultant_recruits FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can create recruits in their organization" ON public.consultant_recruits;
CREATE POLICY "Users can create recruits in their organization"
  ON public.consultant_recruits FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can update recruits in their organization" ON public.consultant_recruits;
CREATE POLICY "Users can update recruits in their organization"
  ON public.consultant_recruits FOR UPDATE TO authenticated
  USING (organization_id = get_user_organization_id());

-- =============================================
-- TRACKING_SESSIONS: SELECT com TO authenticated
-- =============================================
DROP POLICY IF EXISTS "Users can view tracking in their organization" ON public.tracking_sessions;
CREATE POLICY "Users can view tracking in their organization"
  ON public.tracking_sessions FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());
```

## Apos a migracao

Marcar o warning de `tracking_sessions` como ignorado no scan (INSERT/UPDATE publicos sao necessarios para tracking anonimo do quiz e nao permitem leitura de dados).

## Impacto

- Zero impacto funcional: todas as funcionalidades continuam iguais
- O quiz anonimo continua funcionando (usa RPC functions com SECURITY DEFINER, nao acessa `users` diretamente)
- Tracking anonimo continua funcionando (INSERT/UPDATE publicos mantidos)
- Apenas bloqueia tentativas de leitura por usuarios nao autenticados
