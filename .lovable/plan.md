

## Plano: Eliminar flash de template errado na CapturePage

### Causa raiz

O `DEFAULT_CONFIG` tem `template_type: 'standard'`. Como `loading` começa `false` (mudança anterior para carregar rápido), a página renderiza imediatamente com o template **standard** (formulário de captura). Quando os dados do Supabase chegam e `template_type` é `'landing'`, a UI troca — causando um flash visível onde o usuário vê a página de captura antes da landing.

### Solução

Não renderizar o conteúdo principal até saber qual template usar. Em vez de mostrar um spinner, mostrar apenas o **background escuro** (`bg-[#0D0D0D]`) sem conteúdo — isso é instantâneo e não parece "tela de loading". Assim que os dados chegam (geralmente <200ms), o template correto aparece direto.

### Mudanças em `src/pages/CapturePage.tsx`

1. **Adicionar estado `dataLoaded`** (inicia `false`, fica `true` após `loadData` completar)
2. **Antes do check de `notFound` e antes de renderizar qualquer template**, se `!dataLoaded`, retornar apenas:
   ```tsx
   <div className="min-h-screen bg-[#0D0D0D]" />
   ```
   — Tela preta limpa, sem spinner, sem flash de conteúdo errado
3. O carregamento continua rápido (sem delay artificial), mas o conteúdo só aparece quando sabemos qual template renderizar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/CapturePage.tsx` | Adicionar guard `dataLoaded` para não renderizar conteúdo antes de saber o template |

