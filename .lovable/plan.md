## Objetivo

1. Melhorar a página "Link na Bio" (renomear para **Top Bio**) com mais fontes, edição da foto, ícones por botão e URL pelo primeiro nome.
2. Criar uma aba **Instagram** no painel do consultor que mostra apenas o(s) perfil(s) vinculado(s) a ele, e mover o **Top Bio** para dentro dessa aba (removendo de Configurações).
3. No Super Admin, permitir vincular perfis Instagram já cadastrados a contas de consultor.

---

## Parte 1 — Top Bio (melhorias)

### 1.1 Mais fontes
Em `src/lib/bio-themes.ts`, expandir `BioTheme.font` para um conjunto bem diverso (sem opções parecidas):
- `inter` (sans neutra)
- `playfair` (serif clássica elegante)
- `space-grotesk` (sans geométrica tech)
- `dm-serif` (serif display marcante)
- `bebas` (display condensada, alto impacto)
- `poppins` (sans arredondada amigável)
- `lora` (serif de leitura)
- `manrope` (sans moderna)
- `archivo-black` (display peso máximo)
- `instrument-serif` (serif editorial fina)

Carregar via `<link>` no `index.html` (Google Fonts) e atualizar `FONT_FAMILIES`. No `BioEditor` trocar o `<Select>` por um grid visual com preview do nome em cada fonte.

### 1.2 Edição da foto (avatar)
Adicionar a `BioHeader` os campos:
- `avatar_size`: `sm | md | lg | xl`
- `avatar_shape`: `circle | rounded | square`
- `avatar_position`: `center | left`
- `avatar_border`: `none | thin | thick | glow`
- `avatar_border_color`: hex (default = accent)

Editor: novo painel "Foto" com switches/sliders e preview em tempo real. Renderer (`BioRenderer`) usa esses campos para calcular `width/height`, `borderRadius`, alinhamento e box-shadow.

### 1.3 Ícones por botão
Hoje só `link` lê `data.icon`. Vamos:
- Expandir `ICONS` em `BioRenderer.tsx` para ~30 ícones úteis (Star, Heart, Sparkles, Briefcase, Award, Users, Phone, Calendar, MessageCircle, ShoppingBag, Gift, Crown, Zap, Shield, Rocket, Target, TrendingUp, Globe, Mail, Music, Camera, Video, BookOpen, GraduationCap, Coffee, Home, Map, DollarSign, ThumbsUp, Flame, etc.).
- Por padrão, novos blocos `link` recebem ícone sugerido por palavras-chave do título (ex.: "whatsapp"→MessageCircle, "curso"→GraduationCap). Fallback `Star`.
- No `BioEditor`, para cada bloco `link`, adicionar **picker visual** (popover com grid pesquisável dos ícones).

### 1.4 URL pelo primeiro nome
- A URL passa de `/bio/:username` para `/bio/:firstName` (slug derivado do `full_name`, normalizado: minúsculo, sem acento, sem espaço).
- Em colisão entre consultores da mesma organização, sufixar `-2`, `-3`...
- Adicionar coluna `slug TEXT UNIQUE` em `bio_pages` (migração) — gerada na criação/atualização do nome via trigger `before insert/update`.
- Atualizar a RPC `get_bio_by_slug` para casar pelo novo `bio_pages.slug` (em vez de `consultants.username`).
- `BioEditor` exibe a URL final `…/bio/<primeiro_nome>` com botão para copiar.

---

## Parte 2 — Aba Instagram do Consultor

### 2.1 Vinculação (Super Admin)
Migração:
- Adicionar `consultant_id UUID` (nullable) em `insta_profiles`.
- Index parcial para busca rápida.
- Política RLS extra: consultor (não super admin) só pode `SELECT` em `insta_profiles` quando `consultant_id = get_current_consultant_id()`. As políticas existentes (org) continuam para super admin.
- Mesma regra propagada para `insta_follower_metrics` via EXISTS já existente (continua funcionando porque escopa por `insta_profiles`, então basta a nova política em `insta_profiles`).

UI Super Admin:
- Em `InstagramProfileCard`/`InstagramProfilesList`, adicionar dropdown "Vincular a consultor" listando consultores da organização. Ao escolher, faz `update insta_profiles set consultant_id=...`.
- Indicador visual de qual consultor está vinculado.

### 2.2 Nova aba Instagram no painel do consultor
- Nova rota `/admin/instagram` já existe — adaptar `AdminInstagram.tsx` para reagir ao papel:
  - **Super admin**: comportamento atual (3 sub-abas: Visão Geral, Perfis, Análises).
  - **Consultor**: nova versão com sub-abas: **Meus perfis**, **Análises**, **Top Bio**.
    - "Meus perfis" e "Análises" reusam `InstagramProfileDetail`/`InstagramAnalytics` filtrando por `consultant_id`.
    - "Top Bio" renderiza `<BioEditor … />` (movido de Configurações).
- Em `AdminLayout.tsx`, adicionar item `Instagram` no `consultantNavItems` (ícone `Instagram` da lucide).
- Em `ConsultantSettings.tsx`, **remover** a `TabsTrigger value="bio"` e respectivo `TabsContent` (mover para a aba Instagram).

### 2.3 Hook
Atualizar `useInstagramProfiles`/`useInstagramMetrics` para aceitar filtro `consultantId` e, quando o usuário não é super admin, aplicar `eq('consultant_id', currentConsultantId)`.

---

## Detalhes técnicos

### Migração SQL
```sql
-- Top Bio: slug por primeiro nome
ALTER TABLE public.bio_pages ADD COLUMN slug TEXT;
CREATE UNIQUE INDEX bio_pages_slug_uniq ON public.bio_pages(slug);

CREATE OR REPLACE FUNCTION public.bio_pages_set_slug() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE base TEXT; candidate TEXT; n INT := 1;
BEGIN
  base := lower(regexp_replace(unaccent(coalesce(NEW.header->>'name','')), '[^a-z0-9]+', '-', 'gi'));
  base := trim(both '-' from split_part(base,'-',1)); -- primeiro nome
  IF base = '' THEN base := substring(NEW.user_id::text,1,8); END IF;
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.bio_pages WHERE slug=candidate AND id <> coalesce(NEW.id,'00000000-0000-0000-0000-000000000000'::uuid)) LOOP
    n := n+1; candidate := base || '-' || n;
  END LOOP;
  NEW.slug := candidate;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_bio_slug BEFORE INSERT OR UPDATE OF header ON public.bio_pages
FOR EACH ROW EXECUTE FUNCTION public.bio_pages_set_slug();

-- Backfill slugs existentes
UPDATE public.bio_pages SET header = header; -- dispara trigger

-- Atualizar RPC get_bio_by_slug para usar bio_pages.slug
CREATE OR REPLACE FUNCTION public.get_bio_by_slug(p_slug text) ...
  WHERE bp.slug = p_slug AND bp.is_published = true ...

-- Instagram: vincular a consultor
ALTER TABLE public.insta_profiles ADD COLUMN consultant_id UUID;
CREATE INDEX insta_profiles_consultant_idx ON public.insta_profiles(consultant_id);

CREATE POLICY "Consultants view own insta profiles"
ON public.insta_profiles FOR SELECT TO authenticated
USING (consultant_id = get_current_consultant_id());
```

### Arquivos a editar/criar
- `supabase/migrations/<novo>.sql` — alterações acima
- `src/lib/bio-themes.ts` — novas fontes + tipos `BioHeader.avatar_*`
- `index.html` — `<link>` Google Fonts adicionais
- `src/components/bio/BioRenderer.tsx` — render foto editável, mais ícones
- `src/components/consultant/BioEditor.tsx` — picker de ícone, painel de foto, grid de fontes, URL com primeiro nome
- `src/hooks/useBioPage.ts` — retornar `slug` da linha
- `src/pages/BioPage.tsx` — usa `slug` (já passa `:slug` para a RPC, sem mudança)
- `src/components/consultant/ConsultantSettings.tsx` — remover aba Link na Bio
- `src/components/admin/AdminLayout.tsx` — adicionar item Instagram em `consultantNavItems`
- `src/pages/AdminInstagram.tsx` — split por papel + sub-aba Top Bio para consultor
- `src/hooks/useInstagramProfiles.ts` (e relacionados) — filtro por `consultant_id`
- `src/components/instagram/InstagramProfilesList.tsx` (super admin) — dropdown vincular consultor

### Compatibilidade
- URLs antigas `/bio/<username>` deixam de funcionar; o link gerado para os consultores passa a ser `/bio/<primeiro-nome>`. O backfill cria o slug para todos os bio_pages existentes automaticamente.
- Perfis Instagram já cadastrados ficam com `consultant_id = NULL` até o super admin vincular — nesse estado nenhum consultor os vê.

---

## Ordem de implementação
1. Migração SQL (slug, trigger, RPC, coluna `consultant_id` em `insta_profiles`, política RLS).
2. Top Bio: fontes, foto editável, ícones, URL por primeiro nome.
3. AdminLayout: novo item "Instagram" para consultor.
4. AdminInstagram: separar render por papel + integrar BioEditor.
5. Super Admin: vincular perfil Instagram a consultor.
6. Remover aba Link na Bio das Configurações.