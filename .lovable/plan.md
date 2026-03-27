

## Plano: Corrigir Logo, Melhorar Visual da Landing Page

### Problemas identificados

1. **Logo vai para o lugar da hero image**: No `CapturePage.tsx` (linha 725-727), quando `config.hero_image` existe, renderiza `HeroImage` na hero section. O `HeroImage` component usa `config.hero_image` — logo e hero são campos separados (`logo_image` vs `hero_image`), mas a logo está sobrepondo porque no preview do settings (linha 56) há `{config.hero_image && !config.logo_image && ...}` — quando logo é configurada, a hero desaparece da preview. No CapturePage real, ambos renderizam independentemente, mas a logo (header) + HeroImage (hero section) parecem conflitar visualmente.

2. **Reordenar imagens da galeria**: Não há botões de reordenação para gallery_images (só para custom_questions).

3. **Seção de comparação com R$ ??? e R$ XX**: Precisa remover os preços e redesenhar com a paleta Top Brasil (laranja/preto, não azul).

4. **Preview não reflete a landing page configurada**: Preview é muito simplificada.

5. **Espaçamentos excessivos** e visual geral precisa de polimento.

6. **Logo padrão**: Copiar a imagem enviada como logo default.

---

### Mudanças

#### 1. `src/pages/CapturePage.tsx` — Corrigir logo + comparação + visual

**Logo separada da Hero:**
- Header (linhas 715-721): Logo fica no canto superior esquerdo — OK, já está assim
- Hero section (linhas 724-727): A hero image renderiza INDEPENDENTE da logo. Manter ambos renderizando. A logo fica no header, a hero image fica na seção hero. Sem conflito.
- O problema real: quando o usuário configura a logo_image, ela funciona certo no header. Mas o campo `hero_image` do settings é compartilhado — o usuário pode estar colocando a logo no campo de hero_image ao invés do campo logo_image. Verificar se no settings a UI é clara.

**Seção de comparação — Redesenhar:**
- Remover `R$ ???` / `R$ XX` / `/mês em média` / `/mês` (linhas 801-824)
- Usar paleta Top Brasil: card esquerdo = `bg-[#1A1A1A]` (OK), card direito = gradiente laranja `bg-gradient-to-br from-[#EB6608] to-[#D35A07]` ao invés de azul `#002B7A`
- Badge "Melhor Escolha" em branco/laranja ao invés de dourado/azul
- Itens positivos em branco (não verde) para combinar com fundo laranja
- Apenas título do card + lista de itens, sem preços

**Espaçamentos:**
- Reduzir `py-20 md:py-28` para `py-14 md:py-20` nas seções
- Reduzir `pt-28 pb-28` do hero para `pt-24 pb-16`
- Reduzir gaps gerais

**Visual geral:**
- Manter animações e glassmorphism
- Melhorar benefits section com ícones reais (Lucide) ao invés de imagens estáticas que provavelmente não existem em `/benefits/`

#### 2. `src/components/consultant/ConsultantSettings.tsx`

**Reordenar galeria:**
- Adicionar botões ArrowUp/ArrowDown em cada item da galeria (mesma lógica das custom_questions, linhas 824-841)

**Logo default:**
- Copiar imagem enviada para `src/assets/top-brasil-logo.png`
- Quando `captureForm.logo_image` está vazio e template é landing, mostrar a imagem default (importada)

**Preview melhorada:**
- Atualizar `CapturePagePreview` para refletir melhor a landing page real (mostrar galeria real, comparação com cores corretas)

#### 3. Copiar asset
- `user-uploads://Cópia_de_Ativo_8.png` → `public/top-brasil-logo.png` para uso como logo padrão

---

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| `public/top-brasil-logo.png` | Logo padrão copiada do upload |
| `src/pages/CapturePage.tsx` | Redesenhar comparação (remover preços, paleta laranja), ajustar espaçamentos, benefits com ícones Lucide, garantir logo e hero independentes |
| `src/components/consultant/ConsultantSettings.tsx` | Adicionar reordenação de galeria, logo default, preview melhorada |

