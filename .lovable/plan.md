

## Plano: Adicionar toggles de CRM e Ranking na página de Consultores

### Problema

Os toggles de CRM e Ranking existem apenas na página "Dashboard" do Super Admin (`/admin/super`), dentro do componente `ConsultantsTable`. Porém, a página dedicada "Consultores" (`/admin/consultants` → `ConsultantsManagement.tsx`) é um componente **completamente separado** com sua própria tabela — e **não tem** os toggles de CRM e Ranking.

### Solução

Substituir a tabela antiga em `ConsultantsManagement.tsx` pelo componente `ConsultantsTable` que já tem os toggles, ou adicionar os toggles diretamente na tabela existente de `ConsultantsManagement.tsx`.

A melhor abordagem: **reusar o `ConsultantsTable`** na página de Consultores, já que ele já tem toda a lógica pronta (mutations, UI mobile/desktop, toggles).

### Mudanças

| Arquivo | Mudança |
|---------|---------|
| `src/pages/ConsultantsManagement.tsx` | Substituir a tabela custom pela importação do `ConsultantsTable` que já tem CRM + Ranking toggles. Manter funcionalidades extras que existem apenas nesta página (bulk delete, etc.) se houver |

### Detalhes

1. Verificar se `ConsultantsManagement.tsx` tem funcionalidades extras que `ConsultantsTable` não tem (bulk select, delete em massa, etc.)
2. Se tiver, migrar essas funcionalidades para o `ConsultantsTable` compartilhado
3. Se não tiver, simplesmente substituir a tabela pela importação do componente

Isso garante que em **qualquer lugar** que o super admin veja consultores, os toggles de CRM e Ranking estarão disponíveis.

