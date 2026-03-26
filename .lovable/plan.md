

## Plano: Toggle Ranking no Super Admin + Preview dinâmico + Visual da Captura

---

### 1. Toggle Ranking por consultor no Super Admin

Adicionar coluna `ranking_visible` (boolean, default true) na tabela `users`. No `ConsultantsTable.tsx`, adicionar um toggle ao lado do CRM toggle (mobile e desktop). No `AdminLayout.tsx`, condicionar o menu "Ranking" ao `ranking_visible` do usuário (para consultores, não para super admin).

**Migration**:
```sql
ALTER TABLE public.users ADD COLUMN ranking_visible boolean NOT NULL DEFAULT true;
```

| Arquivo | Mudança |
|---------|---------|
| Migration | `ranking_visible` em `users` |
| `ConsultantsTable.tsx` | Toggle Ranking + mutation |
| `AdminLayout.tsx` | Condicionar menu Ranking ao `ranking_visible` |
| `useRankingData.ts` | Incluir `ranking_visible` na interface |
| `supabase/functions/ranking-get/index.ts` | Retornar `ranking_visible` |

---

### 2. Preview dinâmico com perguntas customizadas

O `CapturePagePreview` (linha 37-73 de `ConsultantSettings.tsx`) atualmente é estático — mostra sempre nome, email, telefone. Precisa:
- Receber `email_enabled` e `custom_questions` como props
- Esconder email se desabilitado
- Renderizar as perguntas customizadas após telefone
- Não mostrar barra de progresso

| Arquivo | Mudança |
|---------|---------|
| `ConsultantSettings.tsx` | Atualizar `CapturePagePreview` props e renderização |

---

### 3. Remover progresso + colocar perguntas dentro do card + visual melhorado

No `CapturePage.tsx`:
- **Remover** a seção de progresso (linhas 608-620) — "Progresso 0/3 campos"
- **Mover** as perguntas customizadas para **dentro** do card glassmorphism (após telefone, antes do fechar `</div>` do card na linha 727)
- **Melhorar visual**: gradiente mais rico, melhor contraste, refinar orbs

| Arquivo | Mudança |
|---------|---------|
| `CapturePage.tsx` | Remover progresso, mover perguntas para dentro do card, refinamentos visuais |

---

### Resumo

| # | Funcionalidade | Arquivo(s) | Migration |
|---|---------------|-----------|-----------|
| 1 | Toggle Ranking | `ConsultantsTable.tsx`, `AdminLayout.tsx`, ranking-get | `ranking_visible` em `users` |
| 2 | Preview dinâmico | `ConsultantSettings.tsx` | Nenhuma |
| 3 | Captura: remover progresso + perguntas no card | `CapturePage.tsx` | Nenhuma |

