
# Configurar Super Admin com topbrasil@gmail.com

## Situacao Atual

- O email `topbrasil@gmail.com` ja existe no sistema de autenticacao (auth.users)
- Porem o banco de dados esta vazio: nao existe organizacao nem registro na tabela `users`
- Por isso o login falha - o sistema autentica mas nao encontra o usuario na tabela `users`

## O que sera feito

### Passo 1: Criar a organizacao TOP Brasil
Inserir o registro da organizacao na tabela `organizations` com o slug `topbrasil`.

### Passo 2: Vincular o super admin
Inserir um registro na tabela `users` conectando o email `topbrasil@gmail.com` ao auth existente, com role `super_admin` e vinculado a organizacao criada.

### Passo 3: Criar os stages do pipeline
Inserir os stages padrao do pipeline (Novos Leads, Contato Inicial, Qualificados, Convertidos, Descartados) para a organizacao.

## Resultado

Apos essas insercoes, voce podera:
1. Fazer login com `topbrasil@gmail.com` e a senha que ja foi definida
2. Acessar o painel de Super Admin
3. Criar novos consultores pela interface de Gestao de Consultores

## Detalhes Tecnicos

Serao executados 3 comandos INSERT no banco de dados (sem necessidade de migracao SQL, pois as tabelas ja existem):

1. `INSERT INTO organizations` - Cria a org TOP Brasil
2. `INSERT INTO users` - Vincula o auth_user_id do email existente com role super_admin
3. `INSERT INTO pipeline_stages` - Cria 5 stages padrao do pipeline

Nenhum arquivo de codigo sera alterado.
