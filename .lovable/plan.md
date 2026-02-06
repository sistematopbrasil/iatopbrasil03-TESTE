
# Correcoes e Melhorias no CRM e Agente IA

Voce levantou varios pontos importantes. Vou explicar primeiro o que pediu e depois detalhar as correcoes.

---

## Explicacoes

**Tokens Usados:** Tokens sao a "moeda" da IA. Cada palavra ou pedaco de palavra conta como um token. O numero mostrado (ex: 7.523) e a soma de tudo que a IA processou (sua pergunta + contexto + resposta). Serve para voce acompanhar o consumo do servico de IA.

**Testar Configuracao:** Esse botao permite que voce envie uma pergunta de teste para o agente IA ali mesmo na tela de configuracao, **sem enviar mensagem real para o WhatsApp do cliente**. Ele simula como a IA responderia usando a Persona e os Conhecimentos que voce configurou. Ideal para ajustar o tom de voz antes de ativar.

---

## Problemas Identificados e Correcoes

### 1. IA pausa sozinha apos enviar mensagem (BUG CRITICO)

**Causa:** Quando a IA envia uma mensagem, ela salva no banco com `metadata: { sent_by_ai: true }`. Porem, o WhatsApp confirma o envio e dispara um webhook de volta. O webhook faz um `upsert` na mensagem e sobrescreve o metadata com os dados crus do WhatsApp (que nao tem `sent_by_ai`). Logo apos, o webhook detecta uma mensagem outgoing sem flag de IA e conclui que foi um humano, ativando a pausa automatica.

**Correcao no arquivo `supabase/functions/crm-webhook/index.ts`:**
- Na construcao do `messageData` (linha 672), antes de definir `metadata: message`, verificar se ja existe uma mensagem com esse `message_id` no banco e se ela tem `sent_by_ai: true`. Se sim, preservar o metadata original (nao sobrescrever).
- Na deteccao de intervencao humana (linhas 746-780), adicionar uma verificacao extra: buscar a mensagem recem-inserida no banco e checar se o `metadata.sent_by_ai` e true. So pausar se **nao** for mensagem da IA.

### 2. Mensagens nao aparecem em tempo real

**Causa:** O Supabase Realtime pode nao estar habilitado para as tabelas `crm_messages` e `crm_conversations`. 

**Correcao:** Executar migracao SQL para garantir que as tabelas estejam na publicacao realtime:
```text
ALTER PUBLICATION supabase_realtime ADD TABLE crm_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE crm_conversations;
```

### 3. IA envia tudo em uma unica mensagem (humanizacao)

**Correcao no arquivo `supabase/functions/ai-agent-respond/index.ts`:**
- Apos receber a resposta da IA, dividir o texto por `\n\n` (paragrafos)
- Enviar cada parte como mensagem separada via Evolution API com um delay de 1-2 segundos entre elas
- Salvar cada parte como mensagem individual no banco com `sent_by_ai: true`

### 4. Aproveitamento de tela na pagina Agente IA

**Correcao no arquivo `src/pages/AdminAIConfig.tsx`:**
- Remover `max-w-4xl` do container principal para usar a largura total disponivel, ou aumentar para `max-w-6xl`

### 5. Aproveitamento de tela no CRM (chat)

**Correcao no arquivo `src/pages/AdminCRM.tsx`:**
- Reduzir o padding do container de conteudo de `p-3` para `p-2` ou `p-1`
- Isso dara mais espaco vertical para a area de mensagens

### 6. Mostrar tempo restante de pausa e mais opcoes de duracao

**Correcao no arquivo `src/components/crm/AIStatusBadge.tsx`:**
- Quando status for `paused`, calcular e exibir o tempo restante (ex: "IA Pausada (1h 15m)")
- Adicionar mais opcoes de tempo de pausa no menu: 30 min, 1h, 2h, 4h, 8h, 24h

### 7. Opcao de pausa configuravel pelo atendente

O menu do AIStatusBadge ja permite pausar manualmente. Sera expandido com mais opcoes de duracao conforme item 6.

---

## Resumo dos Arquivos Alterados

| Arquivo | O que muda |
|:---|:---|
| `supabase/functions/crm-webhook/index.ts` | Preservar metadata `sent_by_ai` no upsert; corrigir deteccao de intervencao humana |
| `supabase/functions/ai-agent-respond/index.ts` | Quebrar resposta em multiplas mensagens separadas |
| `src/pages/AdminAIConfig.tsx` | Aumentar largura maxima da pagina |
| `src/pages/AdminCRM.tsx` | Reduzir padding para melhor aproveitamento |
| `src/components/crm/AIStatusBadge.tsx` | Mostrar tempo restante da pausa + mais opcoes de duracao |
| Migracao SQL | Habilitar realtime para `crm_messages` e `crm_conversations` |

---

## Ordem de Execucao

1. Migracao SQL (realtime)
2. Correcao do webhook (bug critico da pausa)
3. Correcao do ai-agent-respond (mensagens separadas)
4. Melhorias de UI (layout + AIStatusBadge)
