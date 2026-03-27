

## Plano: Corrigir Erro de Save + Build Errors + Melhorias Landing Page

---

### Problema 1: Erro "Could not find 'compare_enabled' column"

**Causa raiz**: O código salva campos `compare_enabled`, `compare_title`, `compare_traditional_items`, `compare_topbrasil_items` e `logo_image` no banco, mas essas colunas **não existem** na tabela `capture_page_configs`. A migration nunca foi criada para elas.

**Correção**: Criar migration adicionando as colunas faltantes:
```sql
ALTER TABLE public.capture_page_configs 
  ADD COLUMN logo_image text,
  ADD COLUMN compare_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN compare_title text DEFAULT 'Por que pagar caro no seguro se você pode pagar muito menos?',
  ADD COLUMN compare_traditional_items jsonb DEFAULT '["Consulta de crédito","Processo burocrático","Atendimento demorado","Preço varia pelo seu perfil","Franquia obrigatória","Renovação anual forçada"]'::jsonb,
  ADD COLUMN compare_topbrasil_items jsonb DEFAULT '["Sem consulta de crédito","Aprovação na hora","Assistência 24h inclusa","Preço justo pra todos","Sem franquia surpresa","Atendimento humanizado"]'::jsonb;
```

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Adicionar 5 colunas faltantes |

---

### Problema 2: Build errors nos edge functions (TypeScript)

15 erros de tipo: `'e' is of type 'unknown'` e variáveis sem anotação de tipo.

**Correção**: Em cada edge function afetado, adicionar type annotations:
- `const res: Response = await fetch(nextUrl)` e `const json: any = await res.json()` em `fetch-meta-ads-data`
- `(e as Error).message` ou `(error as Error).message` em todos os catch blocks de: `fetch-meta-ads-data`, `get-account-campaigns`, `insta-fetch-profile`, `insta-scheduled-update`, `insta-update-profiles`, `list-meta-ad-accounts`, `sync-ad-accounts`, `sync-all-accounts`, `sync-history`, `validate-meta-token`

| Arquivo | Mudança |
|---------|---------|
| 10 edge functions | Tipar `catch(e)` como `(e as Error).message` e anotar variáveis |

---

### Problema 3: Logo indo para lugar da hero image

**Causa raiz**: Na landing page (`CapturePage.tsx` linha 700), quando `config.hero_image` e `config.logo_image` existem, a hero image aparece dentro do hero section com classe `lp-logo`, conflitando com o logo no header.

**Correção**: Separar completamente logo (header, canto superior esquerdo) e hero image (seção hero). O logo já está correto na linha 690-696. Remover a classe `lp-logo` da hero image na linha 701 e garantir que hero image e logo são independentes (removendo a condição `!config.logo_image` da linha 56 do preview).

| Arquivo | Mudança |
|---------|---------|
| `CapturePage.tsx` | Remover `lp-logo` class da hero image, permitir hero e logo coexistirem |
| `ConsultantSettings.tsx` | Corrigir preview para mostrar logo e hero separados |

---

### Problema 4: Upload múltiplo de imagens e vídeos do computador

**Correções**:
1. Alterar `input.multiple = true` no upload de galeria e processar todos os files selecionados
2. Adicionar botão para upload de vídeo local (do computador) além do link YouTube
3. Adicionar controles de tamanho/formato/posição para cada mídia da galeria (aspect ratio, object-fit)

| Arquivo | Mudança |
|---------|---------|
| `ConsultantSettings.tsx` | Upload múltiplo + upload vídeo local + controles por mídia |

---

### Problema 5: Visual e conteúdo da landing page

**Melhorias na `CapturePage.tsx`**:
1. Ícones de benefícios: se as imagens `/benefits/benefit-X.png` não existirem, usar ícones SVG com Lucide (Shield, Phone, Car, Truck, CreditCard) com estilo glassmorphism
2. Seção de comparação já está implementada e com visual bom — manter
3. Remover texto "Preencha seus dados e saiba como começar" se existir
4. Player de vídeo local: usar tag `<video>` com controls nativo para vídeos uploadados do computador
5. Responsividade mobile: verificar sticky CTA, espaçamentos, grid de galeria

| Arquivo | Mudança |
|---------|---------|
| `CapturePage.tsx` | Fallback ícones SVG, melhorar player de vídeo, ajustes mobile |

---

### Resumo

| # | Problema | Arquivo(s) | Tipo |
|---|----------|-----------|------|
| 1 | Colunas faltantes no DB | Migration | Migration |
| 2 | Build errors TypeScript | 10 edge functions | Fix tipos |
| 3 | Logo x Hero conflito | `CapturePage.tsx`, `ConsultantSettings.tsx` | Fix layout |
| 4 | Upload múltiplo + vídeo local | `ConsultantSettings.tsx` | Feature |
| 5 | Visual landing page | `CapturePage.tsx` | Refinamento |

