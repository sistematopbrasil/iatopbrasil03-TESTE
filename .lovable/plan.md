

## Plano: Corrigir tamanho do vídeo na galeria + Habilitar configuração de perguntas no landing

### Problema 1 — Vídeo com tamanho diferente das imagens
Na galeria, as imagens usam `aspect-video sm:aspect-square` mas o vídeo nativo não segue o mesmo padrão de aspect ratio do container. O vídeo precisa ter o mesmo tamanho e formato visual das imagens.

### Problema 2 — Perguntas do formulário não configuráveis no landing
O editor de `custom_questions` está condicionado a `template_type === 'standard'` (linha 850 do ConsultantSettings), então quando o template é `landing`, a seção de perguntas personalizadas não aparece nas configurações.

---

### Mudanças

#### 1. `src/pages/CapturePage.tsx` — Vídeo na galeria

**Linha 635**: O container do vídeo nativo precisa ter a mesma classe de aspect ratio das imagens. Mudar o `<video>` de `aspect-video` para `aspect-video sm:aspect-square object-cover` e garantir que o container externo tenha as mesmas dimensões que os cards de imagem (mesma classe do container de imagem na linha 680).

#### 2. `src/components/consultant/ConsultantSettings.tsx` — Perguntas no landing

**Linha 849-850**: Remover a condição `captureForm.template_type === 'standard'` para que o editor de perguntas personalizadas apareça também quando o template é `landing`.

---

| Arquivo | Mudança |
|---------|---------|
| `src/pages/CapturePage.tsx` | Igualar aspect ratio do vídeo ao das imagens na galeria |
| `src/components/consultant/ConsultantSettings.tsx` | Mostrar editor de custom_questions para ambos os templates |

