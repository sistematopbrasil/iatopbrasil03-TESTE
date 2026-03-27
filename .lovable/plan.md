

## Plano: Formulário no preview, remover CTA final, corrigir upload de vídeo

### 3 Problemas

1. **Formulário não aparece no preview** do settings — o `CapturePagePreview` (landing) mostra hero, benefícios, comparação e galeria, mas **não tem o formulário**. Precisa adicionar.

2. **Upload de vídeo dá erro "exceeded maximum allowed size"** — O bucket `quiz-images` do Supabase tem limite padrão de 50MB. O código já valida 50MB no frontend (linha 687), mas o bucket pode ter um limite menor configurado (padrão Supabase = 50MB). Precisa aumentar o file_size_limit do bucket via migration.

3. **Seção "Proteção real — Preço justo" no final** (linhas 986-1001) deve ser removida pois já tem a prova social e formulário.

---

### Mudanças

#### 1. `src/components/consultant/ConsultantSettings.tsx` — Preview do Landing

**Adicionar seção de formulário no preview** (entre comparação e galeria, linhas ~110):
- Mostrar preview do formulário com campos Nome, WhatsApp
- Mostrar as `custom_questions` configuradas (como no preview standard)
- Botão de submit estilizado

#### 2. `src/pages/CapturePage.tsx` — Remover CTA final

**Remover** o bloco "Proteção real — Preço justo / Pronto para proteger seu veículo?" (linhas 986-1001).

#### 3. Migration — Aumentar limite do bucket `quiz-images`

Executar migration SQL para aumentar o `file_size_limit` do bucket `quiz-images` para 52428800 (50MB), garantindo que o Supabase aceite uploads de vídeo nesse tamanho.

---

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/components/consultant/ConsultantSettings.tsx` | Adicionar formulário ao preview landing |
| `src/pages/CapturePage.tsx` | Remover seção CTA final "Proteção real" |
| Migration SQL | Aumentar file_size_limit do bucket quiz-images |

