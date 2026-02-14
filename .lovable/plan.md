

# Configurar Acesso Super Admin e Dados Iniciais

## Problema

O usuario `topbrasil@gmail.com` foi criado no auth mas nao existe registro correspondente na tabela `public.users`, nem organizacao, nem pipeline stages. O login falha porque o `ProtectedRoute` busca o role na tabela `users` e recebe 0 resultados.

## Solucao

Executar migrations SQL para popular os dados iniciais necessarios.

### Passo 1: Criar organizacao TOP Brasil

```sql
INSERT INTO public.organizations (name, slug, is_active)
VALUES ('TOP Brasil', 'topbrasil', true);
```

### Passo 2: Vincular usuario como super_admin

```sql
INSERT INTO public.users (auth_user_id, organization_id, email, full_name, role, is_active)
SELECT 
  '92017f68-9201-494d-9e3c-75097011ce7b',
  o.id,
  'topbrasil@gmail.com',
  'TOP Brasil',
  'super_admin',
  true
FROM public.organizations o WHERE o.slug = 'topbrasil';
```

### Passo 3: Criar pipeline stages padrao

```sql
INSERT INTO public.pipeline_stages (organization_id, name, color, icon, order_index)
SELECT o.id, s.name, s.color, s.icon, s.order_index
FROM public.organizations o,
(VALUES
  ('Novos Leads', '#3B82F6', 'UserPlus', 0),
  ('Contato Inicial', '#F59E0B', 'MessageCircle', 1),
  ('Qualificados', '#10B981', 'CheckCircle', 2),
  ('Novos Consultores', '#8B5CF6', 'Users', 3),
  ('Descartados', '#EF4444', 'XCircle', 4)
) AS s(name, color, icon, order_index)
WHERE o.slug = 'topbrasil';
```

### Resultado esperado

Apos a execucao:
- Login com `topbrasil@gmail.com` funcionara
- Usuario sera redirecionado para `/admin/super` (painel Super Admin)
- Pipeline com 5 stages estara disponivel para todos os consultores

## Sobre os modulos futuros

Entendi a estrategia. Quando voce enviar os prompts dos projetos (Instagram Insights e Dashboard de Trafego), cada modulo sera implementado com:

- **Tabelas isoladas** com prefixo do modulo (ex: `insta_*`, `traffic_*`)
- **Sem foreign keys cruzadas** entre modulos - apenas referencia a `users.id` e `organizations.id` como ponto de conexao
- **Componentes independentes** em pastas separadas
- **Novas abas** no painel Super Admin, cada uma carregando dados de forma independente
- **Remocao segura** - deletar as tabelas e componentes de um modulo nao afeta nada do resto

Isso garante que cada modulo funciona como um "plugin" que pode ser adicionado, modificado ou removido sem efeitos colaterais.

