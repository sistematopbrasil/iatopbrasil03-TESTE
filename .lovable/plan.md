
# Plano: Link na Bio + Correções de Segurança Críticas

Dois entregáveis nesta etapa:
1. **Nova feature "Link na Bio"** — página pública por consultor, totalmente personalizável (estilo Linktree/Beacons/Campsite).
2. **Correções de segurança** — fechar os 4 erros críticos do scan. Os warnings ficam como passo seguinte.

---

## 1. Link na Bio — `/bio/:slug`

### Estrutura visual (inspirada nos prints + Linktree/Beacons)
- Topo: foto de perfil (logo opcional), nome (com destaque colorido na segunda palavra), bio curta, badges de redes (Instagram followers, etc. opcional).
- Corpo: lista vertical de blocos arrastáveis. Tipos de bloco:
  - **Botão de link** (com ícone à esquerda + título + subtítulo + URL).
  - **Botão de WhatsApp** (gera link `wa.me` com mensagem pré-preenchida).
  - **Vídeo** (YouTube/Vimeo embed com thumbnail).
  - **Carrossel de imagens** (galeria swipe).
  - **Mapa / Endereço** (texto + link Google Maps).
  - **Redes sociais** (linha de ícones: IG, TikTok, YouTube, Threads, Facebook).
  - **Divisor com título** (separador de seção).
- Rodapé: copyright "Top Brasil".

### Personalização (editor no painel do consultor)
- **Identidade**: foto/logo, nome, bio, cor de destaque do nome.
- **Paleta**: 6 presets (Top Brasil padrão laranja/preto, Dark minimal, Claro, Sépia, Roxo, Azul) + opção custom (picker para fundo, card, texto, accent).
- **Estilo de botão**: bordas (none / soft / pill), preenchimento (sólido / outline / glass), sombra (off / soft / glow).
- **Fundo**: cor sólida, gradiente ou pattern de pontos (como nos prints).
- **Fonte**: 3 opções (Inter sans, Playfair serif elegante, Space Grotesk moderna).
- **Reordenar / ativar / desativar** cada bloco com drag-and-drop.
- **Preview ao vivo** lado a lado no editor (mobile frame).

### Características técnicas
- Rota pública: `/bio/:slug` (slug = `users.username`).
- Carregamento via RPC `get_bio_by_slug(slug)` (SECURITY DEFINER, retorna apenas campos públicos).
- Rápida: pré-carrega só o necessário, imagens lazy, sem queries autenticadas.
- Responsiva: layout mobile-first (largura máx 480px), funciona em desktop com fundo amplo.
- Interativa: animações suaves de hover/tap, contagem de cliques por botão (analytics simples).
- SEO: `<title>`, OG tags com foto e bio.
- Compartilhamento: botão de copiar link no painel.

### Backend
- Migração: nova tabela `bio_pages` (1‑para‑1 com `users`):
  - `id`, `user_id` (unique), `organization_id`, `is_published`, `theme` (jsonb com paleta/fontes/estilo), `header` (jsonb: logo_url, name, bio, accent_color), `blocks` (jsonb array ordenado de blocos), `seo` (jsonb), `created_at`, `updated_at`.
- Tabela `bio_clicks` para analytics (block_id, clicked_at, user_agent_hash).
- RLS: SELECT público apenas via RPC; UPDATE/INSERT só do dono (`user_id = get_current_consultant_id()`).
- Storage: novo bucket privado `bio-assets` (logos/imagens dos blocos), com URLs assinadas geradas no SELECT da RPC pública (ou bucket público escopado por pasta = user_id, política restrita só nesse padrão de path).

### Frontend
- Página pública: `src/pages/BioPage.tsx`.
- Editor: `src/components/consultant/BioEditor.tsx` + sub-componentes por tipo de bloco. Aba nova "Link na Bio" no painel do consultor.
- Hook: `useBioPage(userId)` (TanStack Query) com mutation de salvar.
- Serviço de tracking: chamada `track_bio_click(block_id)` ao clicar.

### Rota
Adicionar `<Route path="/bio/:slug" element={<BioPage />} />` em `src/App.tsx`.

---

## 2. Correções de Segurança (4 erros críticos)

### 2.1 Bucket `crm-media` público
- Migração: tornar bucket privado (`update storage.buckets set public = false where id = 'crm-media'`).
- Substituir SELECT policy permissiva por uma que verifica que o `auth.uid()` é dono da instância referenciada no path do arquivo (`messages/{instanceName}/...`), via join com `whatsapp_instances` e `users`.
- No frontend (ChatWindow, MessageItem, AudioPlayer, ImageModal): trocar URL pública por **signed URL** (`supabase.storage.from('crm-media').createSignedUrl(path, 3600)`) e renovar quando expirar.

### 2.2 `quiz_submissions_new` — UPDATE público abusável
- Drop da policy "Public can update recent submissions".
- Criar 2 policies:
  - **anon UPDATE limitado** escopado por `session_id` (já existe na tabela): só permite atualizar quando `session_id = NEW.session_id` e WITH CHECK só permite alteração de `completion_percentage`, `current_question`, `last_activity_at` (validado via trigger `BEFORE UPDATE` que rejeita mudança em campos sensíveis: name, phone, email, pipeline_stage_id, assigned_to, lead_score, notes).
  - **authenticated UPDATE total** apenas para usuários da mesma organização (`organization_id = get_user_organization_id()`).

### 2.3 `quiz_submissions` legado — UPDATE público
- Drop da policy "Public can update recent quiz submissions". Tabela é legado; manter só leitura/insert se necessário, ou bloquear UPDATE para `anon` completamente. Authenticated continua podendo atualizar dentro da org.

### 2.4 Realtime sem RLS em `crm_conversations` / `crm_messages`
- Adicionar policies em `realtime.messages` (a tabela de subscriptions do Supabase Realtime) restringindo:
  - SELECT só quando o tópico corresponde a uma conversa cuja `instance_id` pertence a uma instância do `auth.uid()` (via `whatsapp_instances.user_id`).
- Alternativa segura adicional: trocar canais broadcast genéricos por canais privados nomeados por `instance_id` e validar membership na policy.

---

## Detalhes técnicos resumidos

**Arquivos a criar**
- `supabase/migrations/<ts>_bio_pages.sql` — tabela, RLS, RPC `get_bio_by_slug`, RPC `track_bio_click`, bucket `bio-assets`.
- `supabase/migrations/<ts>_security_hardening.sql` — privatização `crm-media` + policies, fix `quiz_submissions*`, RLS `realtime.messages`.
- `src/pages/BioPage.tsx`
- `src/components/consultant/BioEditor.tsx`
- `src/components/consultant/bio/` (BlockEditorLink, BlockEditorWhatsApp, BlockEditorVideo, BlockEditorGallery, BlockEditorMap, BlockEditorSocial, ThemePicker, MobilePreview)
- `src/hooks/useBioPage.ts`
- `src/lib/bio-themes.ts` (presets de paleta/fonte/estilo)

**Arquivos a editar**
- `src/App.tsx` — adicionar rota `/bio/:slug`.
- `src/components/consultant/ConsultantSettings.tsx` — adicionar aba "Link na Bio".
- `src/components/crm/MessageItem.tsx`, `ChatWindow.tsx`, `AudioPlayer.tsx`, `ImageModal.tsx` — usar signed URL.
- `supabase/functions/crm-webhook/index.ts` — gravar `media_path` (já grava) e o frontend resolve via signed URL em vez de `media_url` público.

**Não inclui nesta etapa** (warnings — abrir como follow-up se quiser):
- Validação de magic bytes no upload do webhook.
- Remoção do modo de transição do webhook secret.
- Migração do encryption key para Supabase Vault.
- Escopo por organização no bucket `insta-profile-pictures`.
- Mover extensões fora do schema `public`.

Quer que eu comece já pela feature Link na Bio + as correções de segurança juntas, ou prefere separar em duas levas (segurança primeiro, bio depois)?
