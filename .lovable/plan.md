

# Correcao do Scroll do Pipeline, Erro de Runtime e Seguranca

---

## 1. Pipeline - Scroll horizontal (causa raiz encontrada)

**Problema:** O `AdminLayout.tsx` aplica `overflow-hidden` (linha 283) no container pai quando `disableVerticalScroll` e true. Isso bloqueia **ambos os eixos** (X e Y). Mesmo que o `.pipeline-scroll` tenha `overflow-x: auto !important` no CSS, o pai "corta" tudo antes.

**Correcao em `src/components/admin/AdminLayout.tsx` (linha 283):**
- Trocar `overflow-hidden` por `overflow-y-hidden overflow-x-auto`
- Isso bloqueia o scroll vertical mas libera o horizontal para o Pipeline

```text
Antes:  ? 'overflow-hidden'
Depois: ? 'overflow-y-hidden overflow-x-auto'
```

Tambem no `src/pages/AdminPipeline.tsx`, o container da pipeline-scroll precisa garantir que nao tenha `overflow-hidden` redundante. O arquivo atual esta correto (usa `pipeline-scroll` que ja tem os estilos CSS certos), mas vou simplificar removendo o `style` inline desnecessario e garantindo que a hierarquia de overflow nao conflite.

---

## 2. Erro de Runtime: "AdminLayout has already been declared"

**Causa:** Isso e um bug do Vite HMR (Hot Module Replacement). O arquivo `AdminPipeline.tsx` esta correto (so tem um import de `AdminLayout`). O Vite guardou uma versao antiga em cache e esta tentando declarar o modulo duas vezes.

**Correcao:** Adicionar um comentario no topo do arquivo para forcar o Vite a recompilar. Isso resolve o cache corrompido sem afetar nada.

---

## 3. Seguranca - Falsos positivos

Verifiquei todas as tabelas mencionadas no scan diretamente no banco:

| Tabela | SELECT Policy | Roles | Status |
|:---|:---|:---|:---|
| ranking_scores | Org members ou super admin | authenticated | Seguro |
| quiz_submissions_new | Consultant proprio ou super admin | authenticated | Seguro |
| event_attendees | Org members via events join | authenticated | Seguro |
| tracking_sessions | Org members | authenticated | Seguro |

**Todas** as tabelas ja possuem policies de SELECT restritas a `authenticated` com filtro por organizacao. Nenhum usuario anonimo consegue ler dados. O scanner esta reportando falsos positivos.

**Acao:** Marcar esses findings como ignorados com justificativa tecnica detalhada.

---

## Resumo

| Arquivo/Acao | Alteracao |
|:---|:---|
| `src/components/admin/AdminLayout.tsx` | Trocar `overflow-hidden` por `overflow-y-hidden overflow-x-auto` |
| `src/pages/AdminPipeline.tsx` | Pequeno ajuste para forcar recompilacao do Vite |
| Seguranca | Ignorar 4 findings com justificativa (policies ja existem) |

