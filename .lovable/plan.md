

## Plano: Corrigir Pixel duplicado, otimizar carregamento e mensagem WhatsApp com dados do lead

### 1. Problema do Pixel duplicado

**Causa raiz**: O `useMetaPixel` usa `setTimeout(100ms)` que pode falhar em inicializar o pixel a tempo, e o `fbq('track', 'PageView')` é disparado pelo nosso código **e** pelo script automático do Facebook (que detecta botões via "Configuração de Eventos"). Resultado: PageView duplicado e CompleteRegistration duplicado (um do nosso `trackEvent` + um do "SubscribedButtonClick" automático do Facebook).

**Solução no código**:
- Remover o `setTimeout` e usar um approach mais robusto: verificar `window.fbq` imediatamente após inserir o script (o snippet do Facebook cria `fbq` como queue antes de carregar o script externo, então já está disponível)
- Adicionar `eventID` único ao `CompleteRegistration` para deduplicação nativa do Facebook
- O PageView do "Configuração de Eventos" automática do Facebook **não é bug do código** — é configuração feita pelo usuário na Meta. Recomendação: desativar o "SubscribedButtonClick" automático na ferramenta de configuração de eventos da Meta, já que o código já dispara `CompleteRegistration` manualmente.

**Mudanças em `src/hooks/useMetaPixel.ts`**:
- Remover `setTimeout` — inicializar `fbq` imediatamente após inserir o snippet (o snippet cria a queue sync)
- Adicionar `eventID` gerado com `crypto.randomUUID()` no `trackEvent` para deduplicação

### 2. Otimização de carregamento

A página já tem o guard `dataLoaded` mas pode ser mais rápida:

**Mudanças em `src/pages/CapturePage.tsx`**:
- Adicionar `<link rel="preconnect">` para domínios do Supabase no `useEffect` inicial para acelerar DNS
- Mover CSS crítico inline (background, fonts) para evitar FOUC

### 3. Mensagem WhatsApp com dados do lead

O cliente quer que a mensagem enviada ao WhatsApp inclua dados como nome e placa (resposta customizada).

**Mudanças em `src/pages/CapturePage.tsx`**:
- Na hora do redirect para WhatsApp, substituir placeholders na mensagem: `{nome}`, `{telefone}`, `{email}` e `{resposta_N}` (para perguntas customizadas)
- Exemplo de mensagem padrão sugerida: `Olá! Meu nome é {nome}, telefone {telefone}. Tenho interesse em proteção para o veículo placa {resposta_1}.`

**Mudanças em `src/components/consultant/ConsultantSettings.tsx`**:
- Adicionar texto de ajuda abaixo do campo "Mensagem padrão" explicando os placeholders disponíveis: `{nome}`, `{telefone}`, `{email}`, `{resposta_1}`, `{resposta_2}`, etc.

### Resumo de arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useMetaPixel.ts` | Remover setTimeout, init imediato, adicionar eventID para deduplicação |
| `src/pages/CapturePage.tsx` | Substituir placeholders na mensagem WhatsApp, preconnect DNS |
| `src/components/consultant/ConsultantSettings.tsx` | Texto de ajuda com placeholders disponíveis |

### Nota sobre o Pixel do David mostrando 0 eventos

O print mostra "Total de eventos: 0 / Últimos 28 dias" mas ao abrir mostra 853 PageViews. Isso é um comportamento da interface da Meta (o widget resumido pode ter delay). Com as correções de deduplicação e eventID, os eventos serão registrados corretamente e sem duplicação.

