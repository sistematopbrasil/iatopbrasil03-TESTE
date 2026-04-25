## O que vou entregar

Dois documentos PDF prontos para uso, salvos em `/mnt/documents/`:

1. **`top-brasil-plataforma-explicacao.pdf`** — Texto explicativo detalhado da ferramenta (para enviar por escrito aos consultores, servir de manual e base de FAQ).
2. **`top-brasil-roteiro-video.pdf`** — Roteiro completo de vídeo híbrido com timestamps, falas, ações na tela, ganchos de retenção e CTAs.

Os dois materiais cobrem **todos os módulos com peso igual**, e seguem a distinção correta entre **Funil de Consultores** (recrutamento de novos consultores) e **Funil de Associados** (proteção veicular para donos de veículo).

---

## Documento 1 — Texto explicativo detalhado

Estrutura em 10 seções:

1. **O que é a Top Brasil CRM** — visão geral, problema que resolve, diferencial.
2. **Os 2 funis** — Consultores (recrutamento) vs Associados (proteção veicular). Como escolher e alternar.
3. **Captação de leads — 3 portas de entrada:**
   - **Quiz personalizado** (`/quiz/:slug`) — qualificação automática por respostas
   - **Página de Captura** (`/c/:slug` e `/r/:slug`) — landing fixa otimizada (Hero, Benefícios, Comparação, Formulário, Galeria, Prova Social) com suporte a vídeo e até 50MB por mídia
   - **WhatsApp direto** — leads que chamam no zap entram como "morno"
4. **CRM e Pipeline (Kanban)** — estágios customizáveis, scroll horizontal, drag & drop, estágio "Consultor" como conversão final.
5. **WhatsApp integrado (Evolution API)** — conexão por QR Code, conversas em tempo real, áudio, imagens, respostas rápidas, criação de lead a partir de conversa.
6. **Agente de IA** — persona configurável, ativação manual ou automática, prompts por estágio do pipeline, follow-up automático por regras.
7. **Temperatura do lead e Lead Score** — Quente (30 pts), Morno (20), Frio (10); como a temperatura é calculada e o que faz subir.
8. **Ranking e Gamificação** — pontuação por temperatura e conversão, níveis, ranking entre consultores.
9. **Painel Super Admin** — visão consolidada, gestão de consultores, controle de acesso por funil, métricas globais, distribuição por origem (Q/C/W/R).
10. **Módulos complementares:**
    - **Instagram Analytics** (atualização 2x/dia, 8h e 23h50)
    - **Tráfego Meta Ads** (sincronização a cada 5 min, histórico cumulativo)
    - **Configurações** — Quiz, Pipeline, IA, Integrações, Pixel Meta individual por consultor

**Tom:** direto, objetivo, em português, com exemplos práticos do dia a dia do consultor. Sem jargão técnico desnecessário.

---

## Documento 2 — Roteiro de vídeo híbrido (estimado 14-16 min)

Formato: **Visão estratégica (3 min) → Tour prático (10 min) → Fechamento de impacto (2 min)**.

Cada bloco do roteiro contém:
- ⏱ **Timestamp**
- 🎬 **O que aparece na tela** (gravação, zoom, animação, texto)
- 🎙 **Fala literal** (script pronto para narrar)
- 💡 **Gancho de retenção** (curiosidade, prova, antecipação)

### Estrutura completa do roteiro:

**ATO 1 — ABERTURA QUE PRENDE (0:00 – 3:00)**
- 0:00 — Hook de 8 segundos: "Você sabia que 80% dos leads são perdidos por falta de organização? Hoje isso acaba pra você."
- 0:30 — Apresentação da plataforma (visão geral em 5 telas rápidas tipo trailer)
- 1:00 — Os 3 problemas que ela resolve (lead que esfria, falta de follow-up, falta de visão)
- 2:00 — Os 2 funis explicados com clareza (Consultores vs Associados) com analogia visual
- 2:45 — Promessa do vídeo: "nos próximos 12 minutos vou te mostrar tudo"

**ATO 2 — TOUR PRÁTICO POR MÓDULO (3:00 – 13:00)**
- 3:00 — Login e Dashboard (visão geral dos números)
- 3:45 — **Captação:** Quiz + Página de Captura + link de compartilhamento personalizado
- 5:30 — **CRM e Pipeline:** abas (Quiz, WhatsApp, Captura), card do lead, perfil completo, drag & drop no Kanban
- 7:30 — **WhatsApp integrado:** conectar instância, conversar dentro da plataforma, áudio, respostas rápidas
- 9:00 — **Agente de IA:** ativar IA na conversa, configurar persona, follow-up automático
- 10:30 — **Ranking e Gamificação:** "como você sobe de nível"
- 11:15 — **Instagram + Tráfego** (rápido, mostrando que dá visão completa)
- 12:00 — **Painel Super Admin** (para líderes): consultores ativos, conversão, origem dos leads
- 12:45 — Configurações essenciais: Pixel próprio, link próprio, integração Meta

**ATO 3 — FECHAMENTO DE IMPACTO (13:00 – 15:00)**
- 13:00 — Recapitulação visual (montagem rápida com legenda "tudo isso em 1 lugar")
- 13:30 — Caso de uso real ("imagina sua semana com isso")
- 14:00 — CTA: como começar hoje (login → conectar WhatsApp → compartilhar link → começar a captar)
- 14:30 — Frase de encerramento forte
- 14:45 — Tela final com instruções de suporte

### Recursos extras incluídos no roteiro:
- **Lista de B-rolls sugeridos** (cliques, zooms, animações de transição)
- **Frases-gancho** para usar nos cortes (evita queda de retenção)
- **Sugestões de texto na tela** (lower-thirds e callouts)
- **Variação curta de 90s** para Stories/Reels (bônus no fim)
- **Roteiro de descrição** pronto para postar junto do vídeo

---

## Como vou gerar

- Vou usar Python + ReportLab para gerar dois PDFs com tipografia limpa, paleta Top Brasil (laranja `#EB6608` + preto), capa, sumário e seções bem espaçadas.
- Sem mexer no código da aplicação — é puramente geração de artefato em `/mnt/documents/`.
- QA visual obrigatório: vou converter cada página em imagem e revisar antes de entregar.

Ao final você recebe os dois PDFs prontos para baixar e usar.