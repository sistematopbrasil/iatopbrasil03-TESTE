## Objetivo

1. **Top Bio** (`BioEditor` + `BioRenderer`): remover link duplicado, preview realmente fixo, player de vídeo bonito (controles personalizados na cor da paleta), upload múltiplo na galeria, muito mais ícones (proteção veicular, carros, seguro etc.).
2. **Instagram do consultor**: renomear "Meus perfis" → "Meu perfil", ajustar a UI para um único perfil e **fundir as abas "Meu perfil" + "Análises"** em uma única tela, mantendo a aba **Top Bio** ao lado.

---

## 1) Top Bio — Editor

Arquivo: `src/components/consultant/BioEditor.tsx`

- **Remover o link duplicado**: hoje o link aparece tanto no card "URL + ações" (acima do preview, lado esquerdo) quanto no card "Seu link" (acima do preview, lado direito). Remover o card do lado direito (linhas ~570–587), mantendo apenas o card principal do editor com URL, copiar e abrir.
- **Preview realmente fixo**: hoje o container usa `lg:sticky lg:top-4` mas o conteúdo interno tem `max-h-[calc(100vh-12rem)] overflow-y-auto` dentro de uma coluna que cresce com o conteúdo do editor — quando o editor fica longo, o sticky "se solta". Solução:
  - Trocar o grid para usar `lg:items-start` e a coluna do preview para `lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]` com `overflow-hidden` e o `BioRenderer` em um wrapper interno com `overflow-y-auto`.
  - Reduzir um pouco a escala (`scale-[0.78]`) para caber melhor em telas médias.
  - Garantir que o `min-h-screen` do `BioRenderer` não force a coluna a crescer (envolver em wrapper com `min-h-0`).

## 2) Top Bio — Galeria com upload múltiplo

Arquivo: `src/components/consultant/BioEditor.tsx` (bloco `gallery`, ~linha 533)

- Adicionar `multiple` ao input de arquivo da galeria.
- Iterar `e.target.files`, fazer upload sequencial via `uploadBioAsset`, mostrar toast de progresso (`X de N enviadas`) e adicionar todas as URLs ao array `images` ao final.
- Limitar a ~10 fotos por seleção para evitar uploads gigantes.

## 3) Top Bio — Player de vídeo personalizado

Arquivos: `src/components/bio/BioRenderer.tsx` (substituir `VideoBlock`), novo componente `src/components/bio/BioVideoPlayer.tsx`.

- Criar `BioVideoPlayer` (player HTML5 customizado, sem `controls` nativo):
  - Botão play/pause central grande no estado pausado (estilo Instagram/TikTok).
  - Barra de progresso clicável + scrubbing por arrastar, na `theme.accent_color`.
  - Tempo decorrido / duração no canto.
  - Botão mute/unmute, botão fullscreen.
  - Visual: card com `borderRadius` do tema, fundo `theme.card_color`, controles em overlay com gradiente preto translúcido na base, ícones e barra na cor de destaque do tema.
  - Mobile-friendly: tap no vídeo alterna play/pause; controles somem após 2s sem interação (`auto-hide`).
  - Fallback YouTube continua via iframe quando não há `file_url`.
- `VideoBlock` no renderer passa a usar `BioVideoPlayer` quando `file_url` existir.

## 4) Top Bio — Mais ícones (proteção veicular, carros, seguro)

Arquivos: `src/lib/bio-themes.ts` (`ICON_KEYS`, `suggestIcon`) e `src/components/bio/BioRenderer.tsx` (mapa `ICONS`).

Adicionar ao catálogo (todos disponíveis no `lucide-react`):

- **Veículos / proteção veicular**: `car` (Car), `truck` (Truck), `bike` (Bike), `motorcycle` → usar `Bike` ou `Zap` (lucide tem `Bike`; para moto usar `Bike` rotulado), `caravan` (Caravan), `bus` (Bus), `key` (Key — chaveiro), `key-round` (KeyRound), `fuel` (Fuel), `gauge` (Gauge — painel), `wrench` (Wrench — oficina), `cog` (Cog — manutenção), `car-front` (CarFront), `car-taxi` (CarTaxi), `caravan` (Caravan).
- **Seguro / proteção**: `shield-check` (ShieldCheck), `shield-alert` (ShieldAlert), `lock` (Lock), `lock-keyhole` (LockKeyhole), `umbrella` (Umbrella), `life-buoy` (LifeBuoy), `hand-coins` (HandCoins), `piggy-bank` (PiggyBank), `file-text` (FileText — apólice), `clipboard-check` (ClipboardCheck), `badge-check` (BadgeCheck), `siren` (Siren — emergência), `headset` (Headset — atendimento 24h), `map-pinned` (MapPinned — guincho/localização), `route` (Route — rastreamento), `radar` (Radar).
- **Reforço comercial**: `percent` (Percent — desconto), `tag` (Tag), `bell` (Bell — alerta/oferta), `share-2` (Share2), `thumbs-up` (ThumbsUp), `handshake` (Handshake), `users-round` (UsersRound), `user-check` (UserCheck), `id-card` (IdCard).

Atualizações:

- Importar todos no mapa `ICONS` do `BioRenderer.tsx` (chaves estáveis em snake/kebab simples).
- Adicionar as mesmas chaves a `ICON_KEYS` em `bio-themes.ts`.
- Estender `suggestIcon` com regex novas: `/carro|veicul|auto/` → `car`, `/moto/` → `bike`, `/caminhao|truck/` → `truck`, `/segur|prote[çc]/` → `shield-check`, `/apolice|contrato/` → `file-text`, `/rastrea|gps/` → `route`, `/guinch|sos|emerg/` → `siren`, `/24h|atend/` → `headset`, `/desconto|promo/` → `percent`, `/oficina|mecan/` → `wrench`, `/cota[cç]ao|or[çc]amento|simul/` → `dollar`.
- O `IconPicker` já mostra todos via grid + busca, então ganha essas opções automaticamente.

## 5) Instagram do consultor — unificar abas e singular

Arquivos: `src/pages/ConsultantInstagram.tsx`, novo `src/components/instagram/ConsultantSingleProfileView.tsx`.

- Em `ConsultantInstagram.tsx`:
  - Quando `instagramVisible`, mostrar **apenas 2 abas**: "Meu perfil" e "Top Bio" (em vez de 3).
  - A aba "Meu perfil" passa a renderizar o novo `ConsultantSingleProfileView` (substitui `InstagramProfilesList` + `InstagramAnalytics`).
  - Atualizar copy do header para "Acompanhe o crescimento do seu perfil e personalize seu Top Bio".
  - Limpar `validTabs` para `["meu-perfil", "top-bio"]` e migrar valor antigo `profiles`/`analytics` → `meu-perfil` (compat de URL).

- Novo componente `ConsultantSingleProfileView`:
  - Carrega `useInstagramProfiles` e `useInstagramMetrics`.
  - Caso 0 perfis: estado vazio "Nenhum perfil vinculado pelo administrador" (consultor não cria perfis sozinho — `canManage=false`).
  - Caso 1+ perfis: pega o **primeiro perfil ativo** (cenário esperado para consultor) e renderiza diretamente `InstagramProfileDetail` inline (sem Sheet/modal), encimado por:
    - Cabeçalho compacto: avatar, @username, nome, badge ativo/arquivado, botão "Atualizar agora" (`useInstagramUpdate.updateAll`).
    - Cards de resumo (Total Seguidores, Crescimento no Período, Média/Dia) — reaproveitar layout dos cards atuais de `InstagramAnalytics`.
    - `DatePeriodFilter` (chips Hoje / Ontem / 7d / 30d / Total) controlando os cards e o gráfico do detalhe.
  - Caso o consultor tenha mais de um perfil (raro), mostrar um seletor compacto (chips com `@username`) acima do detalhe — sem o grid completo nem as opções "Adicionar"/"Arquivados"/ordenação que faziam sentido só para múltiplos perfis no admin.
  - Remover botão "Adicionar perfil" (já era escondido por `canManage=false`, mas explicitamos a ausência).

- O componente reutiliza `InstagramProfileDetail`, `MiniSparkline`, `DatePeriodFilter`, `formatNumber/formatChange`. Nenhum dos componentes existentes é apagado — eles continuam usados na página de admin.

## 6) Limpeza

- Remover imports não usados em `ConsultantInstagram.tsx` (`UserCircle`, `TrendingUp` substituídos pelos novos rótulos/ícones).
- Manter `InstagramProfilesList` e `InstagramAnalytics` intactos — eles continuam usados em `AdminInstagram` (super admin).

---

## Resumo de arquivos editados/criados

- editar `src/components/consultant/BioEditor.tsx` — remove link duplicado, preview fixo, galeria múltipla
- editar `src/components/bio/BioRenderer.tsx` — usa novo player, expande mapa de ícones
- criar `src/components/bio/BioVideoPlayer.tsx` — player customizado tematizado
- editar `src/lib/bio-themes.ts` — `ICON_KEYS` + `suggestIcon` ampliados
- editar `src/pages/ConsultantInstagram.tsx` — 2 abas, copy singular
- criar `src/components/instagram/ConsultantSingleProfileView.tsx` — visão unificada de perfil único

Sem mudanças de banco de dados, sem novas dependências.
