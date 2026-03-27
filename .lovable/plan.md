

## Plano: Ativar Meta Pixel na Landing Page (CapturePage)

### Problema
O `CapturePage.tsx` não usa o hook `useMetaPixel`. O `pixel_id` é retornado pela RPC `get_consultant_by_slug`, mas não é armazenado no estado do componente nem passado para o hook do pixel.

### Mudanças em `src/pages/CapturePage.tsx`

1. **Importar** `useMetaPixel` do hook existente
2. **Adicionar `pixel_id`** à interface `ConsultantData` e ao `setConsultant` (linha ~451-455)
3. **Chamar** `useMetaPixel({ pixelId: consultant?.pixel_id })` no componente
4. **Disparar evento** `trackEvent('Lead', ...)` no submit do formulário (junto ao `handleSubmit`)

Isso fará com que o pixel configurado pelo consultor seja carregado automaticamente quando a landing page abrir, e dispare o evento `Lead` quando o formulário for enviado.

| Arquivo | Mudança |
|---------|---------|
| `src/pages/CapturePage.tsx` | Importar useMetaPixel, armazenar pixel_id, inicializar pixel, disparar evento Lead |

