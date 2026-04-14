

## Plano: Corrigir placeholder do telefone, melhorar ajuda de placeholders e resolver PageView duplicado

### Problemas identificados

1. **PageView duplicado**: O código dispara `fbq('track', 'PageView')` na inicialização E a Meta dispara outro automaticamente via "Configuração de Eventos" (`ob3_plugin-set`). São 2 PageViews a cada visita.
2. **Placeholder do telefone feio na landing page**: A landing page usa `selectedCountry.mask` (`(##) #####-####`), enquanto o template standard já usa o formato legível `(00) 00000-0000`.
3. **Placeholders `{resposta_N}` difíceis de identificar**: O texto de ajuda mostra `{resposta_1}`, `{resposta_2}` sem indicar qual pergunta corresponde a cada número.

### Soluções

#### 1. Eliminar PageView duplicado do Pixel
- No `useMetaPixel.ts`, **remover** o `fbq('track', 'PageView')` manual do nosso código
- O script do Facebook já dispara PageView automaticamente quando carrega — não precisa de disparo manual
- Isso resolve a duplicação de PageView sem precisar mexer nas configurações da Meta
- O "SubscribedButtonClick" continua sendo do lado da Meta (ferramenta de configuração de eventos) — recomendação: desativar na Meta

#### 2. Melhorar placeholder do telefone na landing page
- Linha 890 de `CapturePage.tsx`: trocar `selectedCountry.mask` por formato legível
- Para BR: `(00) 00000-0000`, para outros: substituir `#` por `0`

#### 3. Mostrar nomes das perguntas nos placeholders
- Em `ConsultantSettings.tsx`, no texto de ajuda da mensagem WhatsApp (linhas 905-910), gerar dinamicamente a lista de placeholders baseada nas `captureForm.custom_questions` configuradas
- Ex: mostrar `{resposta_1} = "Qual a sua cidade?"`, `{resposta_2} = "Seu veículo tem proteção?"` em vez de apenas `{resposta_1}, {resposta_2}`

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useMetaPixel.ts` | Remover `fbq('track', 'PageView')` manual |
| `src/pages/CapturePage.tsx` | Placeholder do telefone: `(00) 00000-0000` na landing |
| `src/components/consultant/ConsultantSettings.tsx` | Listar nomes das perguntas junto aos placeholders |

