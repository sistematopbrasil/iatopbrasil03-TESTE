
# Etapa 6: Criptografia de API Keys + Suporte Multi-Provider + Farewell Message

O agente IA esta funcional com todas as etapas anteriores concluidas. Esta etapa foca em completar funcionalidades pendentes e robustez.

---

## Status Atual (Tudo OK)

- Seguranca: Todos os scans limpos (2 erros + 1 warning resolvidos/ignorados)
- Edge Functions: `ai-agent-respond`, `ai-agent-test`, `crm-webhook` registrados no config.toml
- Secrets: `EVOLUTION_API_KEY`, `EVOLUTION_API_URL`, `LOVABLE_API_KEY` configurados
- UI: Badge IA no chat, badge na lista de conversas, stats de uso, botao testar
- Lovable AI como provider padrao (sem necessidade de API key)
- Greeting message implementado
- Pausa automatica por intervencao humana
- Deteccao de horario comercial

---

## O Que Falta

### 1. Criptografia de API Keys (para providers externos)

Atualmente, quando o consultor escolhe OpenAI/Google/Anthropic e insere uma API key, ela e salva em texto puro no campo `api_key_encrypted`. Isso e um risco de seguranca.

**Solucao:** Criar edge function `ai-encrypt-key` que:
- Recebe a API key do frontend
- Criptografa usando `pgcrypto` (extensao ja disponivel no banco)
- Salva no campo `api_key_encrypted`
- Na `ai-agent-respond`, descriptografa antes de usar

**Arquivos:**
- Criar: `supabase/functions/ai-encrypt-key/index.ts`
- Modificar: `src/hooks/useAIConfig.ts` (chamar edge function ao salvar key)
- Modificar: `supabase/functions/ai-agent-respond/index.ts` (descriptografar key)
- Modificar: `supabase/config.toml` (registrar nova funcao)
- SQL: Criar funcoes `encrypt_api_key(text)` e `decrypt_api_key(text)` com pgcrypto

### 2. Suporte completo a Google e Anthropic no ai-agent-respond

Atualmente a edge function `ai-agent-respond` so suporta `lovable` e `openai`. Os providers `google` (Gemini direto) e `anthropic` (Claude) estao listados no formulario mas nao sao tratados na funcao.

**Mudancas em `ai-agent-respond`:**
- Adicionar caso para `google`: chamar `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- Adicionar caso para `anthropic`: chamar `https://api.anthropic.com/v1/messages`
- Mesma logica tambem no `ai-agent-test`

### 3. Farewell Message (Mensagem de despedida)

O campo `farewell_message` existe no config mas nao e usado. Implementar logica para enviar quando a conversa e marcada como "fechada".

**Mudancas:**
- Quando o consultor muda status da conversa para "closed" no CRM, verificar se ha `farewell_message` configurada
- Se houver e a IA estiver ativa, enviar a mensagem automaticamente via Evolution API
- Pode ser feito no frontend (ChatWindow) chamando a Evolution API via edge function existente (`crm-send-message`)

### 4. Transcrever audio e analisar imagem com Lovable AI

Atualmente, transcricao de audio (Whisper) e analise de imagem (Vision) so funcionam com API key OpenAI propria. Quando o provider e `lovable`, essas funcionalidades ficam desabilitadas silenciosamente.

**Solucao:**
- Para audio: usar modelo Gemini via Lovable AI gateway com prompt "Transcreva este audio"
- Para imagem: ja possivel - enviar imagem como content multimodal para Gemini via gateway
- Alternativa mais simples: usar Lovable AI (modelo com suporte multimodal) para descrever a imagem, pois Gemini suporta imagens nativamente

---

## Resumo de Arquivos

| Acao | Arquivo |
|------|---------|
| Criar | `supabase/functions/ai-encrypt-key/index.ts` |
| SQL | Funcoes pgcrypto para encrypt/decrypt |
| Modificar | `supabase/functions/ai-agent-respond/index.ts` - Google, Anthropic, decrypt, media com Lovable |
| Modificar | `supabase/functions/ai-agent-test/index.ts` - Google, Anthropic |
| Modificar | `src/hooks/useAIConfig.ts` - criptografar key ao salvar |
| Modificar | `src/components/crm/ChatWindow.tsx` - farewell message ao fechar conversa |
| Modificar | `supabase/config.toml` - registrar ai-encrypt-key |

---

## Prioridade

1. **Criptografia de API keys** (seguranca - corrige risco existente)
2. **Suporte Google + Anthropic** (completa funcionalidade prometida no formulario)
3. **Media com Lovable AI** (imagens/audio sem API key externa)
4. **Farewell message** (melhoria UX)
