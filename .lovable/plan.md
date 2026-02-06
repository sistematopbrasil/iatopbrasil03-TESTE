

# Etapa 4: Testes, Polimento e Melhorias

Com a infraestrutura completa (DB + Edge Function + UI + Webhook), o proximo passo e garantir que tudo funciona corretamente e adicionar melhorias de experiencia.

---

## 1. Correcao: API Key salva em texto puro

Atualmente a API key e salva diretamente no campo `api_key_encrypted` sem criptografia real. O plano original previa uma edge function `ai-encrypt-key` para criptografar antes de salvar.

**Opcao pragmatica:** Usar Lovable AI (modelos suportados nativamente) ao inves de exigir API key do consultor. Isso elimina a necessidade de criptografia, reduz custo de implementacao e simplifica a UX.

**Mudancas:**
- Na edge function `ai-agent-respond`, adicionar opcao de usar Lovable AI (via proxy nativo) quando `api_provider = 'lovable'`
- No formulario `AdminAIConfig.tsx`, adicionar provider "Lovable AI (Gratis)" como opcao padrao
- Manter opcao de API key propria (OpenAI) para quem quiser
- Se usar API key propria, criar edge function `ai-encrypt-key` para criptografar com pgcrypto

## 2. Indicador visual de mensagens da IA no chat

Quando a IA envia uma mensagem, ela e salva com `metadata.sent_by_ai = true`. Precisamos mostrar isso visualmente no chat.

**Mudancas:**
- No `MessageList.tsx` ou componente de bolha de mensagem, verificar `metadata?.sent_by_ai`
- Exibir um icone discreto de Bot ou badge "IA" na bolha de mensagens enviadas pela IA
- Diferenciar visualmente (ex: borda sutil ou icone no canto)

## 3. Teste end-to-end do fluxo

Verificar que o fluxo completo funciona:
1. Super Admin ativa IA para um consultor
2. Consultor configura persona + API key (ou Lovable AI)
3. Lead envia mensagem pelo WhatsApp
4. Webhook recebe, dispara `ai-agent-respond`
5. IA responde automaticamente
6. Consultor ve a resposta no CRM com indicador de IA
7. Consultor envia mensagem manual -> IA pausa automaticamente
8. Consultor pode reativar pelo badge no chat

## 4. Tratamento de erros e feedback

- Se a edge function falhar, nao mostrar erro ao lead (ja implementado)
- No chat, se houver erro na IA, mostrar notificacao discreta ao consultor
- Na pagina de config, adicionar botao "Testar Configuracao" que envia um prompt de teste e mostra a resposta

## 5. Seguranca: Ignorar avisos restantes

- `quiz_submissions` sem policies: tabela legada, RLS habilitado sem policies = bloqueado. Seguro, ignorar aviso.

---

## Resumo de Arquivos

| Acao | Arquivo |
|------|---------|
| Criar | `supabase/functions/ai-encrypt-key/index.ts` (se manter API key propria) |
| Modificar | `supabase/functions/ai-agent-respond/index.ts` - suporte Lovable AI |
| Modificar | `src/pages/AdminAIConfig.tsx` - provider Lovable AI + botao teste |
| Modificar | `src/components/crm/MessageList.tsx` ou bolha - indicador IA |
| Ignorar | Security warning quiz_submissions |

---

## Prioridade sugerida

1. **Indicador de mensagens IA no chat** (UX essencial, rapido)
2. **Provider Lovable AI** (elimina barreira de API key, simplifica onboarding)
3. **Botao "Testar Configuracao"** (validacao antes de ativar em producao)
4. **Edge function de criptografia** (so se manter API key propria)
5. **Ignorar avisos de seguranca restantes**

