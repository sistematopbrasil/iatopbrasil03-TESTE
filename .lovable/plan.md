

## Plano: Melhorias na Pagina de Captura - Imagem Configuravel, Link Seguro, Redirecionamento e Design

### Mudancas

---

### 1. Banco de Dados - Novos campos para imagem

A tabela `capture_page_configs` precisa de campos para controlar tamanho, posicao e formato da imagem hero (similar ao que ja existe no quiz com `quiz_image_position`, `quiz_image_size`, `quiz_image_shape`).

**Migracao SQL:**
```sql
ALTER TABLE capture_page_configs
  ADD COLUMN IF NOT EXISTS hero_image_size text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS hero_image_position text DEFAULT 'top',
  ADD COLUMN IF NOT EXISTS hero_image_shape text DEFAULT 'rounded';
```

Valores possiveis:
- `hero_image_size`: `small` (80px), `medium` (160px), `large` (240px), `full` (100% width)
- `hero_image_position`: `top` (acima do titulo), `left` (ao lado esquerdo), `background` (fundo com overlay)
- `hero_image_shape`: `rounded` (cantos arredondados), `circle` (circular), `square` (quadrado)

---

### 2. ConsultantSettings.tsx - Configuracoes da Imagem e Link

**Imagem Hero - Novos controles:**
- Select para Tamanho: Pequeno / Medio / Grande / Largura total
- Select para Posicao: Topo / Lateral / Fundo
- Select para Formato: Arredondado / Circular / Quadrado
- Preview atualiza em tempo real com essas configuracoes

**Link editavel - Corrigir:**
- O campo de link mostra o prefixo `{dominio}/c/` como texto fixo (nao editavel)
- So a parte apos `/c/` e editavel (slug + parametros UTM)
- Ex: `[https://top-consultant-pathfinder.lovable.app/c/]` fixo + `[joao-silva?utm_source=facebook]` editavel

**Redirecionamento - 3 opcoes claras:**
1. **Pagina de obrigado (padrao)** - Mostra thank you page simples dizendo que a equipe entrara em contato. Sem botao, sem link. Este e o padrao quando nenhuma configuracao e feita.
2. **Link personalizado** - Mostra thank you page com botao incentivando a clicar no link configurado. A mensagem muda para "Enquanto isso, clique abaixo para saber mais" com botao estilizado.
3. **WhatsApp** - Campo para numero de WhatsApp + campo para mensagem padrao. Mostra thank you page com botao verde do WhatsApp.

---

### 3. CapturePage.tsx - Design e Thank You Pages

**Design da pagina publica:**
- Animacoes suaves de entrada (fade-in nos elementos)
- Efeito de foco nos inputs com glow na cor do botao
- Micro-interacoes: icone de check ao lado dos campos preenchidos
- Badge de seguranca mais visivel com icone de cadeado
- Imagem hero respeita as configuracoes de tamanho/posicao/formato

**Thank You Pages (3 variantes):**

1. `redirect_type = 'thank_you'` (padrao):
   - Icone de check animado
   - "Obrigado, {nome}!"
   - "Seus dados foram enviados com sucesso. Nossa equipe entrara em contato em breve!"
   - Sem botao

2. `redirect_type = 'url'`:
   - Mesmo icone e titulo
   - "Enquanto aguarda nosso contato, confira o link abaixo:"
   - Botao estilizado com a cor do botao configurada que abre o `redirect_url`

3. `redirect_type = 'whatsapp'`:
   - Mesmo icone e titulo
   - "Fale diretamente conosco pelo WhatsApp:"
   - Botao verde do WhatsApp que abre `wa.me/{numero}?text={mensagem}`

**Preview do CapturePagePreview:**
- Atualizar para refletir tamanho/posicao/formato da imagem
- Mostrar preview da thank you page tambem (toggle "Ver pagina de obrigado")

---

### 4. Arquivos a Editar

| Arquivo | Mudanca |
|---|---|
| Migracao SQL | 3 colunas novas em `capture_page_configs` |
| `src/components/consultant/ConsultantSettings.tsx` | Controles imagem (size/position/shape), link fixo+editavel, redirecionamento com campo WhatsApp numero |
| `src/pages/CapturePage.tsx` | Design melhorado, animacoes, 3 variantes de thank you, imagem configuravel |

### Ordem
1. Migracao SQL (campos de imagem)
2. ConsultantSettings (controles + link + redirecionamento)
3. CapturePage (design + thank you + imagem)

