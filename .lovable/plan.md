
# Plano de correções — Erros pós-Fase D

Cinco problemas identificados, com causa-raiz mapeada. Nenhuma rota, slug ou funcionalidade existente é afetada.

---

## 1. "Encryption key not configured" ao salvar integração

**Causa raiz:** A migration `20260228140000` removeu o fallback hardcoded das funções `encrypt_api_key` / `decrypt_api_key` (regra de segurança documentada em `mem://architecture/encryption-key-policy`). Agora elas exigem `app.settings.encryption_key` configurado no Postgres — e esse setting nunca foi definido nesta instância. Resultado: qualquer `set_integration_value` quebra com a mensagem que você viu.

**Correção:** Migration que define `app.settings.encryption_key` no nível do role `postgres` via `ALTER ROLE postgres IN DATABASE current_database() SET ...` (não toca em `ALTER DATABASE postgres`, que é proibido). A chave é gerada na própria migration usando `encode(gen_random_bytes(32), 'hex')` (256 bits). A migration também faz `SELECT pg_catalog.set_config(...)` na mesma transação para que valha imediatamente sem reconexão, e roda um `SELECT public.encrypt_api_key('teste')` ao final como smoke test.

**Garantia de não-quebra:** A tabela `integration_settings` está vazia hoje (a tentativa de salvar falhou antes de gravar). Zero registros perdidos. Os segredos do `.env` continuam sendo lidos pelo helper `getIntegrationValue` (ordem: banco → env), permanecendo ativos até você sobrescrever na tela.

---

## 2. Painel Super Admin → Dashboard mostra "Nenhum consultor encontrado"
## 3. Página de Ranking → "Erro ao carregar ranking"

**Causa raiz (mesma para os dois):** A edge function `ranking-get/index.ts` tem **erro de sintaxe** — a variável `let leadsQuery` está declarada **duas vezes** seguidas (linhas 117–127). Isso faz a função retornar 500 → `useRankingData` joga `error` → tabela do super admin renderiza array vazio ("Nenhum consultor encontrado") e a página de Ranking mostra "Erro ao carregar".

**Correção:** Remover o bloco duplicado (linhas 117–120 do arquivo), mantendo apenas a segunda declaração que já inclui `funnel_type` no select. Sem mudança de comportamento — apenas elimina a duplicação sintática. Deploy automático.

---

## 4. UI cortada ao selecionar 2 funis no diálogo "Novo Consultor" + edição para consultores existentes

**Causa raiz UI:** O `DialogContent` do `CreateConsultantDialog` usa `max-w-md` sem altura máxima nem scroll. Quando ambos os funis são marcados, aparece o bloco "Funil padrão (entrada)" e o conteúdo extrapola a viewport — o footer com o botão "Criar Consultor" some abaixo da tela.

**Edição para consultores existentes:** O componente `EditConsultantFunnelDialog` **já existe e já está integrado** ao `ConsultantsTable` via item de menu "Acesso a Funis" no `DropdownMenu` (3 pontinhos da coluna Ações). Provavelmente passou despercebido. Vou renomear para deixar 100% claro.

**Correções:**

- `CreateConsultantDialog.tsx`: trocar `max-w-md` por `max-w-md max-h-[90vh] flex flex-col`, mover o `<form>` para dentro de um wrapper `overflow-y-auto flex-1` e deixar o footer (`Cancelar` / `Criar Consultor`) **fixo fora do scroll**.
- `EditConsultantFunnelDialog.tsx`: mesmo tratamento de overflow, defensivo.
- `ConsultantsTable.tsx`: renomear o item de menu `"Acesso a Funis"` → `"Editar funis de acesso"` (mobile e desktop), mantendo o ícone `Layers`.

---

## 5. Funil padrão deve seguir automaticamente o tipo escolhido

**Comportamento atual:** A lógica do `setAllowedFunnels` no `CreateConsultantDialog` já realinha o `defaultFunnel` para o único funil ativo quando o admin marca apenas um. O bloco "Funil padrão" só aparece quando os 2 estão marcados (via `allowedFunnels.length > 1`).

**Confirmação:** ao marcar **só Associados**, salva `default_funnel = 'associado'`. Ao marcar **só Consultores**, salva `'consultor'`. Já está correto na lógica — só estava invisível por causa do overflow do dialog (#4). Após corrigir #4, o comportamento fica visível e funcional.

---

## Ordem de execução

1. **Migration** — definir `app.settings.encryption_key` via `ALTER ROLE` + `set_config`, com smoke test.
2. **Edge `ranking-get`** — remover o bloco duplicado de `let leadsQuery`. Deploy.
3. **`CreateConsultantDialog.tsx`** — overflow fix com footer fixo.
4. **`EditConsultantFunnelDialog.tsx`** — mesmo tratamento defensivo.
5. **`ConsultantsTable.tsx`** — renomear item de menu para "Editar funis de acesso".
6. **Build check** — `npx tsc --noEmit` ao final.

---

## Detalhes técnicos sensíveis

- **Encryption key:** gerada com `encode(gen_random_bytes(32), 'hex')` (256 bits). Setada via `ALTER ROLE postgres IN DATABASE current_database() SET app.settings.encryption_key = '<chave>'` + `SELECT pg_catalog.set_config('app.settings.encryption_key', '<chave>', false)` na mesma transação. **Não toca `ALTER DATABASE postgres`**.
- **Edge functions afetadas:** apenas `ranking-get` é redeployed. As 17 funções da Fase D não são tocadas.
- **Frontend:** somente 3 arquivos UI alterados. Nenhuma rota, prop pública ou tipo é alterado. `EditConsultantFunnelDialog` já existe — apenas reaproveitamos.
- **Riscos zerados:** `integration_settings` está vazia, então não há valor criptografado com chave nula que precisaria ser regravado.
