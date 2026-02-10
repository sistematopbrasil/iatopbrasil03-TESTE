

# Correcao definitiva do scroll horizontal do Pipeline + Seguranca

---

## Diagnostico real do problema de scroll

A dificuldade em corrigir o scroll tem sido porque existem **3 camadas** de containers, e uma delas estava escondida:

```text
div.min-h-screen (linha 242) -> overflow-x-hidden  <-- BLOQUEIO RAIZ
  main.flex-1 (linha 249)
    div.h-[calc...] (linha 280) -> overflow-x-auto  <-- nao funciona porque o pai corta
      AdminPipeline children
        div.pipeline-scroll -> overflow-x: auto !important  <-- tambem nao funciona
```

O `overflow-x-hidden` na linha 242 e o verdadeiro culpado. Ele impede qualquer scroll horizontal em TODAS as paginas. Nas outras paginas isso e desejado (evita scroll lateral indesejado), mas no Pipeline precisamos que ele nao interfira.

## Solucao

**Arquivo: `src/components/admin/AdminLayout.tsx`**

Linha 242 - Remover `overflow-x-hidden` do div raiz quando `disableVerticalScroll` esta ativo:

```text
Antes:  <div className="min-h-screen bg-background flex overflow-x-hidden">
Depois: <div className={`min-h-screen bg-background flex ${disableVerticalScroll ? '' : 'overflow-x-hidden'}`}>
```

Isso permite que o Pipeline tenha scroll horizontal, enquanto todas as outras paginas continuam com `overflow-x-hidden` (comportamento atual, sem mudancas).

**Arquivo: `src/pages/AdminPipeline.tsx`**

Pequeno ajuste para garantir que o container `.pipeline-scroll` ocupe todo o espaco disponivel corretamente - adicionar `overflow-x-auto` explicitamente no className alem da classe CSS.

---

## Seguranca

### crm_messages - "Private Customer Messages Could Be Intercepted"

A policy SELECT de `crm_messages` verifica `conversation_id` via subquery em `crm_conversations` que ja filtra por `user_id = get_current_consultant_id()`. Porem, o scanner questiona que nao valida `organization_id` explicitamente. Vou verificar a policy exata e, se ja estiver segura, ignorar com justificativa.

### tracking_sessions - "Visitor IP Addresses"

Acesso ja restrito a membros autenticados da mesma organizacao. E necessario para analytics. Ignorar com justificativa.

---

## Resumo

| Arquivo | Alteracao |
|:---|:---|
| `src/components/admin/AdminLayout.tsx` | Condicionar `overflow-x-hidden` do div raiz |
| `src/pages/AdminPipeline.tsx` | Garantir overflow-x-auto explicito |
| Seguranca | Ignorar findings com justificativa tecnica |

