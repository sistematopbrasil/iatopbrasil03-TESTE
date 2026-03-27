

## Plano: Ícones sem texto, Preview da Hero corrigido, Tamanhos melhores

### 3 Problemas

1. **Ícones de benefícios**: Têm texto duplicado — os ícones já contêm o texto na própria imagem. Remover o `<span>` com label.

2. **Preview da hero no landing**: O preview (linha 67 do ConsultantSettings) renderiza a hero image sempre como `w-16 h-16 rounded-full`, ignorando `hero_image_size`, `hero_image_shape` e `hero_image_position`. Precisa respeitar esses campos.

3. **Tamanhos da hero image na página real**: `small` = `w-20 h-20` (muito pequeno), `medium` = `w-40 h-40` (ainda pequeno), `large` = `w-full max-w-md` (muito grande). Ajustar para valores mais equilibrados.

---

### Mudanças

#### 1. `src/pages/CapturePage.tsx`

**Benefícios (linhas 772-787)** — Remover o `<span>` com label de cada benefício:
```jsx
// De:
<img ... /><span className="...">{benefit.label}</span>
// Para:
<img ... /> // só o ícone, sem texto
```
Remover também o `gap-3` e ajustar o container para centralizar só o ícone.

**Hero sizes (linhas 228-233)** — Ajustar o `sizeMap`:
```
small:  'w-32 h-32'        (era w-20 h-20)
medium: 'w-56 h-56'        (era w-40 h-40)  
large:  'w-full max-w-sm h-auto'  (era max-w-md)
full:   'w-full h-auto'    (mantém)
```

#### 2. `src/components/consultant/ConsultantSettings.tsx`

**Preview landing — hero image (linha 66-68)** — Substituir o render fixo `w-16 h-16 rounded-full` por um render que respeita `hero_image_size`, `hero_image_shape` e `hero_image_position`:
```jsx
// Mapear size/shape/position para classes menores (preview scale)
const previewSizeMap = { small: 'w-12 h-12', medium: 'w-20 h-20', large: 'w-32 h-auto', full: 'w-full h-auto' };
const previewShapeMap = { rounded: 'rounded-xl', circle: 'rounded-full', square: 'rounded-none' };
```

---

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/pages/CapturePage.tsx` | Remover labels dos ícones, ajustar hero sizeMap |
| `src/components/consultant/ConsultantSettings.tsx` | Preview da hero respeitar size/shape/position |

