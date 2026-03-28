

## Plano: Melhorar vídeos na galeria + Landing Page para captação de consultores

### Escopo — 4 entregas

---

### 1. Corrigir capa preta dos vídeos

**Problema:** O `<video>` usa `preload="metadata"` mas não tem `poster` e muitos browsers mostram tela preta.

**Solução em `CapturePage.tsx`:**
- Adicionar `src={img.url + '#t=0.5'}` para forçar o browser a capturar um frame do vídeo como thumbnail
- Manter `preload="metadata"` para carregar o frame sem baixar o vídeo inteiro

**Solução no preview (`ConsultantSettings.tsx`):**
- Igual: vídeo no preview da galeria deve usar `#t=0.5`

---

### 2. Formato configurável para vídeos (não cortar tanto)

**Problema:** Vídeos com `aspect-video sm:aspect-square object-cover` ficam muito cortados.

**Solução:**
- Adicionar propriedade `media_format` ao objeto `GalleryImage` com opções: `'square'`, `'video'` (16:9), `'portrait'` (9:16), `'auto'` (sem aspect ratio forçado)
- No `CapturePage.tsx`, usar a classe de aspect ratio correspondente ao `media_format` do item
- No settings, adicionar um select de "Formato" por item da galeria (ao lado da legenda)
- Default: `'video'` (16:9) que é mais natural para vídeos e não corta tanto

**Mapeamento de classes:**
- `square` → `aspect-square`
- `video` → `aspect-video`
- `portrait` → `aspect-[9/16]`
- `auto` → sem aspect (tamanho natural, com max-height)

---

### 3. Preview deve refletir formato real dos vídeos

No `CapturePagePreview` dentro do `ConsultantSettings.tsx`, ao invés de mostrar apenas um placeholder "🎬 Vídeo", mostrar:
- Para vídeos nativos: `<video>` real com `#t=0.5` e o aspect ratio configurado
- Para YouTube/Vimeo: manter placeholder com ícone mas com o aspect ratio correto

---

### 4. Nova Landing Page para captação de consultores

**Conceito:** O consultor terá DUAS páginas independentes:
- `/c/:slug` — Landing de proteção veicular (já existe)
- `/r/:slug` — Landing de recrutamento de consultores (nova)

**Implementação:**

#### Banco de dados
- Adicionar coluna `page_purpose` ao `capture_page_configs` com valor `'protection'` (default) ou `'recruitment'`
- Cada consultor poderá ter 2 configs ativas (uma para cada purpose)

#### Rota nova
- Em `App.tsx`: adicionar `<Route path="/r/:slug" element={<CapturePage />} />`
- O `CapturePage` recebe o path e determina o `page_purpose` baseado na rota (`/c/` = protection, `/r/` = recruitment)

#### Settings
- No seletor de templates, adicionar um terceiro tipo: **"Recrutamento de Consultores"**
- Quando selecionado, preencher defaults focados em recrutamento:
  - Título: "Quer uma renda extra ou mudar de vida?"
  - Subtítulo: "Faça parte do nosso time de consultores..."
  - Perguntas: experiência em vendas, disponibilidade, etc.
  - Botão: "Quero fazer parte do time →"
- O link mostrado muda para `/r/:slug` quando o tipo é recrutamento
- O consultor pode configurar ambas as páginas (tabs ou seções separadas)

#### CapturePage
- Ao carregar, verificar se a rota é `/r/` ou `/c/` e buscar a config correspondente pelo `page_purpose`
- Os leads captados pela página de recrutamento serão salvos com `lead_source: 'recruitment'` ao invés de `'capture'`

---

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/CapturePage.tsx` | Fix vídeo `#t=0.5`, formato por item, rota `/r/` |
| `src/components/consultant/ConsultantSettings.tsx` | Select formato por mídia, preview real, config recrutamento |
| `src/App.tsx` | Nova rota `/r/:slug` |
| Migration SQL | Coluna `page_purpose` em `capture_page_configs` |

