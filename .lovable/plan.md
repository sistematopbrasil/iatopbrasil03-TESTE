

## Plano: Ajustar Landing Page — Textos, Logo, Ícones, Ordem do Settings

### Mudanças

#### 1. `src/pages/CapturePage.tsx`

**Hero Section (linhas 726-749)**:
- Atualizar textos padrão: badge = "PROTEÇÃO VEICULAR — CAMPINAS E REGIÃO" (já está OK)
- Título default = "Seu carro protegido do jeito certo.\nSem burocracia. Sem pegadinhas."
- Subtítulo default = "A Top Brasil Campinas oferece proteção veicular completa..."
- Botão default = "Quero proteger meu veículo agora →"
- Esses valores já estão como defaults no `captureForm` no Settings — OK

**Logo no header (linhas 715-719)**:
- Adicionar suporte a `config.logo_position` (`left` | `center` | `right`) — mudar `justify-center sm:justify-start` para dinâmico
- Adicionar suporte a `config.logo_size` (`small` | `medium` | `large`) — mapear para `h-8`, `h-12`, `h-16`
- Remover qualquer fundo escuro extra que a logo traz — garantir que o header não adiciona `bg-black/40` (isso está no **preview**, não na page real — mas verificar)

**Ícones de benefícios (linhas 760-779)**:
- Substituir os Lucide icons pelas 6 imagens enviadas pelo usuário
- Copiar as 6 imagens para `public/benefits/` como `benefit-1.png` até `benefit-6.png`
- Atualizar array de benefits para usar `<img>` com os arquivos copiados, com labels: "Proteção Furto e Roubo", "Assistência 24h por dia", "Reparo em Colisão", "Reboque ilimitado para colisão", "SPC e Serasa sem consulta", "Carro reserva"
- Grid: `grid-cols-3 sm:grid-cols-3 md:grid-cols-6` para 6 itens

#### 2. `src/components/consultant/ConsultantSettings.tsx`

**Reordenar campos para seguir a ordem da landing page**:
Ordem atual: Template → Galeria → Logo → Comparação → Link → Título → Subtítulo → Botão → Cor → Hero Image → Redirect → Email → Perguntas

Nova ordem (seguindo a página de cima para baixo):
1. **Link da Página** (primeiro, no topo)
2. **Template Selector**
3. **Logo** (com novos campos: posição e tamanho)
4. **Hero Image** (junto/próximo da logo)
5. **Título / Subtítulo / Texto do Botão / Cor**
6. **Comparação**
7. **Galeria**
8. **Redirect / Email / Perguntas**

**Logo config — novos campos**:
- Adicionar `logo_position` (`left` | `center` | `right`) — Select com 3 opções
- Adicionar `logo_size` (`small` | `medium` | `large`) — Select com 3 opções
- Adicionar esses campos ao `captureForm` state, defaults: `left`, `medium`
- Incluir no `handleSave` payload
- Logo preview na configuração: sem fundo escuro extra, mostrar com fundo transparente

**Hero image preview fix**:
- O preview (CapturePagePreview) usa `config.hero_image` para exibir — verificar que o config passado ao preview é sempre o `captureForm` atualizado (state), não o `existingConfig` do banco

#### 3. Assets — copiar 6 ícones de benefícios
- `user-uploads://1.png` → `public/benefits/benefit-1.png` (Proteção Furto e Roubo)
- `user-uploads://2.png` → `public/benefits/benefit-2.png` (Assistência 24h)
- `user-uploads://3.png` → `public/benefits/benefit-3.png` (Reparo em Colisão)
- `user-uploads://4.png` → `public/benefits/benefit-4.png` (Reboque ilimitado)
- `user-uploads://5.png` → `public/benefits/benefit-5.png` (SPC e Serasa sem consulta)
- `user-uploads://6.png` → `public/benefits/benefit-6.png` (Carro reserva)

#### 4. Database migration
- Adicionar colunas `logo_position` (text default 'left') e `logo_size` (text default 'medium') à tabela `capture_page_configs`

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| `public/benefits/benefit-1..6.png` | 6 ícones copiados |
| `src/pages/CapturePage.tsx` | Ícones com imagens reais, logo position/size dinâmicos |
| `src/components/consultant/ConsultantSettings.tsx` | Reordenar campos, adicionar logo position/size, fix preview |
| Migration SQL | `logo_position`, `logo_size` na tabela |

