import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ─── Helper: decrypt API key via DB function ───
async function decryptApiKey(supabaseAdmin: any, encryptedKey: string | null): Promise<string | null> {
  if (!encryptedKey) return null;
  try {
    const { data, error } = await supabaseAdmin.rpc('decrypt_api_key', { encrypted_key: encryptedKey });
    if (error) {
      console.warn('⚠️ Decrypt failed, using raw value (may be unencrypted legacy key):', error.message);
      return encryptedKey; // fallback for legacy unencrypted keys
    }
    return data as string;
  } catch {
    return encryptedKey; // fallback
  }
}

// ─── Helper: call Lovable AI gateway ───
async function callLovableAI(messages: any[], config: any): Promise<{ text: string; tokens: number }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

  const model = config.model || 'google/gemini-3-flash-preview';
  console.log('🧠 Chamando Lovable AI:', model);

  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: config.temperature || 0.7,
      max_tokens: config.max_tokens || 500,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error('❌ Erro Lovable AI:', resp.status, errText);
    throw new Error(`Lovable AI error: ${resp.status}`);
  }

  const data = await resp.json();
  return {
    text: data.choices?.[0]?.message?.content || '',
    tokens: data.usage?.total_tokens || 0,
  };
}

// ─── Helper: call OpenAI ───
async function callOpenAI(messages: any[], config: any, apiKey: string): Promise<{ text: string; tokens: number }> {
  const model = config.model || 'gpt-4o-mini';
  console.log('🧠 Chamando OpenAI:', model);

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: config.temperature || 0.7,
      max_tokens: config.max_tokens || 500,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OpenAI error ${resp.status}: ${errText.substring(0, 200)}`);
  }

  const data = await resp.json();
  return {
    text: data.choices?.[0]?.message?.content || '',
    tokens: data.usage?.total_tokens || 0,
  };
}

// ─── Helper: call Google Gemini directly ───
async function callGoogle(messages: any[], config: any, apiKey: string): Promise<{ text: string; tokens: number }> {
  const model = config.model || 'gemini-2.5-flash';
  console.log('🧠 Chamando Google Gemini:', model);

  // Convert OpenAI-format messages to Gemini format
  const systemInstruction = messages.find((m: any) => m.role === 'system')?.content || '';
  const contents = messages
    .filter((m: any) => m.role !== 'system')
    .map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        contents,
        generationConfig: {
          temperature: config.temperature || 0.7,
          maxOutputTokens: config.max_tokens || 500,
        },
      }),
    }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Google AI error ${resp.status}: ${errText.substring(0, 200)}`);
  }

  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const tokens = data.usageMetadata?.totalTokenCount || 0;
  return { text, tokens };
}

// ─── Helper: call Anthropic Claude ───
async function callAnthropic(messages: any[], config: any, apiKey: string): Promise<{ text: string; tokens: number }> {
  const model = config.model || 'claude-sonnet-4-20250514';
  console.log('🧠 Chamando Anthropic:', model);

  const systemMsg = messages.find((m: any) => m.role === 'system')?.content || '';
  const chatMessages = messages
    .filter((m: any) => m.role !== 'system')
    .map((m: any) => ({ role: m.role, content: m.content }));

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system: systemMsg,
      messages: chatMessages,
      max_tokens: config.max_tokens || 500,
      temperature: config.temperature || 0.7,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Anthropic error ${resp.status}: ${errText.substring(0, 200)}`);
  }

  const data = await resp.json();
  const text = data.content?.[0]?.text || '';
  const tokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
  return { text, tokens };
}

// ─── Helper: process media with Lovable AI (audio/image) ───
async function processMediaWithLovableAI(mediaUrl: string, type: 'audio' | 'image'): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return type === 'audio' ? '[Áudio recebido]' : '[Imagem recebida]';

  try {
    if (type === 'image') {
      // Gemini supports image URLs natively via multimodal
      const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Descreva esta imagem brevemente em português. Se houver texto, transcreva.' },
                { type: 'image_url', image_url: { url: mediaUrl } },
              ],
            },
          ],
          max_tokens: 200,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        return data.choices?.[0]?.message?.content || '[Imagem sem descrição]';
      }
    } else if (type === 'audio') {
      // Download audio and send as base64 to Gemini
      const audioResp = await fetch(mediaUrl);
      if (!audioResp.ok) return '[Áudio não acessível]';
      const audioBuffer = await audioResp.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

      const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Transcreva este áudio em português. Retorne apenas o texto transcrito.' },
                {
                  type: 'input_audio',
                  input_audio: { data: base64Audio, format: 'ogg' },
                },
              ],
            },
          ],
          max_tokens: 500,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        return data.choices?.[0]?.message?.content || '[Áudio não transcrito]';
      }
    }
  } catch (e) {
    console.error(`⚠️ Erro ao processar ${type} com Lovable AI:`, e);
  }

  return type === 'audio' ? '[Mensagem de áudio recebida]' : '[Imagem recebida]';
}

// ─── Main handler ───
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      conversation_id,
      instance_id,
      user_id,
      message,
      message_type,
      media_url,
      instance_name,
      contact_phone,
    } = await req.json();

    console.log('🤖 AI Agent chamado:', { conversation_id, user_id, message_type });

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Verificar se consultor tem IA habilitada
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, ai_enabled, organization_id')
      .eq('id', user_id)
      .single();

    if (!user?.ai_enabled) {
      console.log('⏭️ IA não habilitada para este consultor');
      return new Response(JSON.stringify({ skipped: true, reason: 'ai_not_enabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Buscar configuração do agente
    const { data: config } = await supabaseAdmin
      .from('ai_agent_configs')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (!config || !config.auto_reply) {
      console.log('⏭️ Sem config ou auto_reply desativado');
      return new Response(JSON.stringify({ skipped: true, reason: 'no_config_or_auto_reply_off' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Verificar estado da IA nesta conversa
    let { data: aiState } = await supabaseAdmin
      .from('ai_conversation_state')
      .select('*')
      .eq('conversation_id', conversation_id)
      .maybeSingle();

    const isNewConversation = !aiState;
    if (!aiState) {
      const { data: newState } = await supabaseAdmin
        .from('ai_conversation_state')
        .insert({ conversation_id, user_id, is_active: true })
        .select()
        .single();
      aiState = newState;
    }

    if (!aiState?.is_active || aiState.permanently_disabled) {
      console.log('⏭️ IA desativada nesta conversa');
      return new Response(JSON.stringify({ skipped: true, reason: 'disabled_for_conversation' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar pausa temporária
    if (aiState.paused_until && new Date(aiState.paused_until) > new Date()) {
      console.log('⏸️ IA pausada até:', aiState.paused_until);
      return new Response(JSON.stringify({ skipped: true, reason: 'paused' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Verificar horário comercial
    if (config.working_hours_only) {
      const now = new Date();
      const brTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const hours = brTime.getHours();
      const minutes = brTime.getMinutes();
      const currentTime = hours * 60 + minutes;

      const [startH, startM] = (config.working_hours_start || '08:00').split(':').map(Number);
      const [endH, endM] = (config.working_hours_end || '18:00').split(':').map(Number);
      const startTime = startH * 60 + startM;
      const endTime = endH * 60 + endM;

      if (currentTime < startTime || currentTime > endTime) {
        console.log('⏰ Fora do horário comercial');
        return new Response(JSON.stringify({ skipped: true, reason: 'outside_working_hours' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 5. Rate limiting
    if (aiState.last_ai_message_at) {
      const diff = Date.now() - new Date(aiState.last_ai_message_at).getTime();
      if (diff < 3000) {
        console.log('⏱️ Rate limit: muito rápido');
        return new Response(JSON.stringify({ skipped: true, reason: 'rate_limit' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 6. Buscar histórico de mensagens (últimas 20)
    const { data: history } = await supabaseAdmin
      .from('crm_messages')
      .select('direction, type, content, timestamp')
      .eq('conversation_id', conversation_id)
      .order('timestamp', { ascending: false })
      .limit(20);

    const conversationHistory = (history || []).reverse().map((msg: any) => ({
      role: msg.direction === 'incoming' ? 'user' : 'assistant',
      content: msg.content || (msg.type === 'audio' ? '[Áudio]' : msg.type === 'image' ? '[Imagem]' : '[Mídia]'),
    }));

    // 7. Processar mídia (transcrição de áudio, descrição de imagem)
    let processedMessage = message || '';
    const apiKey = await decryptApiKey(supabaseAdmin, config.api_key_encrypted);

    if (message_type === 'audio' && config.transcribe_audio && media_url) {
      if (config.api_provider === 'lovable' || !apiKey) {
        // Use Lovable AI for transcription
        processedMessage = await processMediaWithLovableAI(media_url, 'audio');
        console.log('✅ Áudio transcrito via Lovable AI:', processedMessage.substring(0, 50));
      } else if (apiKey && (config.api_provider === 'openai')) {
        try {
          console.log('🎤 Transcrevendo áudio via Whisper...');
          const audioResp = await fetch(media_url);
          if (audioResp.ok) {
            const audioBlob = await audioResp.blob();
            const formData = new FormData();
            formData.append('file', audioBlob, 'audio.ogg');
            formData.append('model', 'whisper-1');
            formData.append('language', 'pt');

            const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
              method: 'POST',
              headers: { Authorization: `Bearer ${apiKey}` },
              body: formData,
            });

            if (whisperResp.ok) {
              const whisperData = await whisperResp.json();
              processedMessage = whisperData.text || '[Áudio não transcrito]';
              console.log('✅ Áudio transcrito:', processedMessage.substring(0, 50));
            }
          }
        } catch (e) {
          console.error('⚠️ Erro ao transcrever áudio:', e);
          processedMessage = '[Mensagem de áudio recebida]';
        }
      }
    }

    if (message_type === 'image' && config.analyze_images && media_url) {
      if (config.api_provider === 'lovable' || !apiKey) {
        const description = await processMediaWithLovableAI(media_url, 'image');
        processedMessage = `[Imagem: ${description}]${message ? ' ' + message : ''}`;
        console.log('✅ Imagem analisada via Lovable AI');
      } else if (apiKey && config.api_provider === 'openai') {
        try {
          console.log('📷 Analisando imagem via OpenAI Vision...');
          const visionResp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: 'Descreva esta imagem brevemente em português. Se houver texto, transcreva.' },
                    { type: 'image_url', image_url: { url: media_url } },
                  ],
                },
              ],
              max_tokens: 200,
            }),
          });

          if (visionResp.ok) {
            const visionData = await visionResp.json();
            const description = visionData.choices?.[0]?.message?.content;
            processedMessage = `[Imagem: ${description || 'sem descrição'}]${message ? ' ' + message : ''}`;
            console.log('✅ Imagem analisada');
          }
        } catch (e) {
          console.error('⚠️ Erro ao analisar imagem:', e);
          processedMessage = `[Imagem recebida]${message ? ' ' + message : ''}`;
        }
      }
    }

    // 8. Montar prompt do sistema
    const systemParts: string[] = [];
    if (config.agent_name) systemParts.push(`Você é ${config.agent_name}.`);
    if (config.persona) systemParts.push(`\n[PERSONA]\n${config.persona}`);
    if (config.objective) systemParts.push(`\n[OBJETIVO]\n${config.objective}`);
    if (config.skills) systemParts.push(`\n[CONHECIMENTO E ROTEIRO]\n${config.skills}`);
    if (config.products_info) systemParts.push(`\n[PRODUTOS/SERVIÇOS]\n${config.products_info}`);
    if (config.restrictions) systemParts.push(`\n[RESTRIÇÕES]\n${config.restrictions}`);

    systemParts.push(`
[INSTRUÇÕES GERAIS]
- Responda de forma natural e humanizada como se fosse um atendente real
- Use o nome do lead quando possível
- NÃO mencione que você é uma IA ou assistente virtual
- Mantenha respostas curtas e objetivas (formato WhatsApp)
- Use emojis com moderação
- Se não souber algo, diga que vai verificar e retornar
- Nunca invente informações sobre preços ou condições`);

    // 8.5. Greeting message para conversa nova
    if (isNewConversation && config.greeting_message?.trim()) {
      console.log('👋 Conversa nova - enviando greeting message');

      const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
      const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

      if (evolutionApiUrl && evolutionApiKey) {
        const jid = contact_phone.includes('@') ? contact_phone : `${contact_phone}@s.whatsapp.net`;

        await fetch(`${evolutionApiUrl}/message/sendText/${instance_name}`, {
          method: 'POST',
          headers: { apikey: evolutionApiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: jid, text: config.greeting_message }),
        });

        await supabaseAdmin.from('crm_messages').insert({
          conversation_id,
          instance_id,
          message_id: `ai-greeting-${Date.now()}`,
          direction: 'outgoing',
          type: 'text',
          content: config.greeting_message,
          status: 'sent',
          timestamp: new Date().toISOString(),
          metadata: { sent_by_ai: true, ai_agent: config.agent_name, is_greeting: true },
        });

        await supabaseAdmin.from('crm_conversations').update({
          last_message_at: new Date().toISOString(),
          last_message_preview: config.greeting_message.substring(0, 100),
          status: 'open',
        }).eq('id', conversation_id);
      }
    }

    // 9. Montar mensagens para a API
    const apiMessages = [
      { role: 'system', content: systemParts.join('\n') },
      ...conversationHistory,
    ];
    if (processedMessage) {
      apiMessages.push({ role: 'user', content: processedMessage });
    }

    // 10. Chamar API de IA baseado no provider
    let aiResponse = '';
    let tokensUsed = 0;

    const provider = config.api_provider;

    if (provider === 'lovable') {
      const result = await callLovableAI(apiMessages, config);
      aiResponse = result.text;
      tokensUsed = result.tokens;
    } else if (provider === 'openai' && apiKey) {
      const result = await callOpenAI(apiMessages, config, apiKey);
      aiResponse = result.text;
      tokensUsed = result.tokens;
    } else if (provider === 'google' && apiKey) {
      const result = await callGoogle(apiMessages, config, apiKey);
      aiResponse = result.text;
      tokensUsed = result.tokens;
    } else if (provider === 'anthropic' && apiKey) {
      const result = await callAnthropic(apiMessages, config, apiKey);
      aiResponse = result.text;
      tokensUsed = result.tokens;
    } else {
      console.log('⏭️ Provedor não suportado ou sem API key:', provider);
      return new Response(JSON.stringify({ skipped: true, reason: 'no_api_key_or_unsupported_provider' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`✅ Resposta (${provider}):`, aiResponse.substring(0, 80), '| Tokens:', tokensUsed);

    // Update token counters
    await supabaseAdmin
      .from('ai_conversation_state')
      .update({
        last_ai_message_at: new Date().toISOString(),
        messages_sent: (aiState?.messages_sent || 0) + 1,
        total_tokens_used: (aiState?.total_tokens_used || 0) + tokensUsed,
        updated_at: new Date().toISOString(),
      })
      .eq('conversation_id', conversation_id);

    if (!aiResponse.trim()) {
      console.log('⏭️ Resposta vazia da IA');
      return new Response(JSON.stringify({ skipped: true, reason: 'empty_response' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 11. Enviar resposta via Evolution API
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!evolutionApiUrl || !evolutionApiKey) {
      console.error('❌ Evolution API não configurada');
      return new Response(JSON.stringify({ error: 'Evolution API not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jid = contact_phone.includes('@') ? contact_phone : `${contact_phone}@s.whatsapp.net`;
    console.log('📤 Enviando mensagem via Evolution API para:', jid);

    const sendResp = await fetch(`${evolutionApiUrl}/message/sendText/${instance_name}`, {
      method: 'POST',
      headers: { apikey: evolutionApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: jid, text: aiResponse }),
    });

    if (!sendResp.ok) {
      const errText = await sendResp.text();
      console.error('❌ Erro ao enviar via Evolution:', sendResp.status, errText);
      return new Response(JSON.stringify({ error: 'Failed to send message' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sendData = await sendResp.json();
    const sentMessageId = sendData?.key?.id || `ai-${Date.now()}`;
    console.log('✅ Mensagem enviada! ID:', sentMessageId);

    // 12. Salvar mensagem no banco
    await supabaseAdmin.from('crm_messages').insert({
      conversation_id,
      instance_id,
      message_id: sentMessageId,
      direction: 'outgoing',
      type: 'text',
      content: aiResponse,
      status: 'sent',
      timestamp: new Date().toISOString(),
      metadata: { sent_by_ai: true, ai_agent: config.agent_name, model: config.model },
    });

    console.log('✅ Mensagem salva no banco');

    // 13. Atualizar conversa
    await supabaseAdmin.from('crm_conversations').update({
      last_message_at: new Date().toISOString(),
      last_message_preview: aiResponse.substring(0, 100),
      status: 'open',
    }).eq('id', conversation_id);

    return new Response(
      JSON.stringify({ success: true, message_id: sentMessageId, response_length: aiResponse.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Erro no AI Agent:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
