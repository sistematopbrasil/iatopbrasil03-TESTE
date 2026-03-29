

## Plano: Remover banners de instalação PWA

Remover todos os componentes e referências de instalação de app das páginas.

### Mudanças

| Arquivo | Ação |
|---------|------|
| `src/components/InstallPWA.tsx` | Deletar arquivo |
| `src/components/admin/InstallAdminPWA.tsx` | Deletar arquivo |
| Qualquer arquivo que importe `InstallPWA` ou `InstallAdminPWA` | Remover import e uso do componente |

Vou verificar onde esses componentes são usados para garantir que todas as referências sejam removidas.

