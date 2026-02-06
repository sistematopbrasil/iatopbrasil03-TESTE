import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      agent_name,
      persona,
      objective,
      skills,
      products_info,
      restrictions,
      api_provider,
      api_key_encrypted,
      model,
      temperature,
      max_tokens,
      test_message,
    } = await req.json();

    // Build system prompt
    const systemParts: string[] = [];
    if (agent_name) systemParts.push(`Você é ${agent_name}.`);
    if (persona) systemParts.push(`\n[PERSONA]\n${persona}`);
    if (objective) systemParts.push(`\n[OBJETIVO]\n${objective}`);
    if (skills) systemParts.push(`\n[CONHECIMENTO E ROTEIRO]\n${skills}`);
    if (products_info) systemParts.push(`\n[PRODUTOS/SERVIÇOS]\n${products_info}`);
    if (restrictions) systemParts.push(`\n[RESTRIÇÕES]\n${restrictions}`);
    systemParts.push(`
[INSTRUÇÕES GERAIS]
- Responda de forma natural e humanizada como se fosse um atendente real
- Use o nome do lead quando possível
- NÃO mencione que você é uma IA ou assistente virtual
- Mantenha respostas curtas e objetivas (formato WhatsApp)
- Use emojis com moderação`);

    const messages = [
      { role: 'system', content: systemParts.join('\n') },
      { role: 'user', content: test_message || 'Olá!' },
    ];

    let aiResponse = '';

    // Decrypt API key if needed
    let apiKey = api_key_encrypted;
    if (apiKey && api_provider !== 'lovable') {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        const { data } = await supabaseAdmin.rpc('decrypt_api_key', { encrypted_key: apiKey });
        if (data) apiKey = data;
      } catch {
        // Use raw key as fallback (legacy unencrypted)
      }
    }

    if (api_provider === 'lovable') {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

      const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model || 'google/gemini-3-flash-preview',
          messages,
          temperature: temperature || 0.7,
          max_tokens: max_tokens || 500,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error('Lovable AI error:', resp.status, errText);
        if (resp.status === 429) throw new Error('Rate limit excedido. Aguarde alguns segundos.');
        if (resp.status === 402) throw new Error('Créditos insuficientes. Adicione créditos na sua conta.');
        throw new Error(`Erro na API: ${resp.status}`);
      }

      const data = await resp.json();
      aiResponse = data.choices?.[0]?.message?.content || '';
    } else if (api_provider === 'openai' && apiKey) {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages,
          temperature: temperature || 0.7,
          max_tokens: max_tokens || 500,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`OpenAI erro ${resp.status}: ${errText.substring(0, 200)}`);
      }

      const data = await resp.json();
      aiResponse = data.choices?.[0]?.message?.content || '';
    } else if (api_provider === 'google' && apiKey) {
      // Google Gemini direct
      const geminiModel = model || 'gemini-2.5-flash';
      const systemMsg = messages.find(m => m.role === 'system')?.content || '';
      const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: systemMsg ? { parts: [{ text: systemMsg }] } : undefined,
            contents,
            generationConfig: { temperature: temperature || 0.7, maxOutputTokens: max_tokens || 500 },
          }),
        }
      );

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Google AI erro ${resp.status}: ${errText.substring(0, 200)}`);
      }

      const data = await resp.json();
      aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (api_provider === 'anthropic' && apiKey) {
      const systemMsg = messages.find(m => m.role === 'system')?.content || '';
      const chatMessages = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }));

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model || 'claude-sonnet-4-20250514',
          system: systemMsg,
          messages: chatMessages,
          max_tokens: max_tokens || 500,
          temperature: temperature || 0.7,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Anthropic erro ${resp.status}: ${errText.substring(0, 200)}`);
      }

      const data = await resp.json();
      aiResponse = data.content?.[0]?.text || '';
    } else {
      throw new Error('Provedor não suportado ou API key ausente');
    }

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Test error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Erro desconhecido' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
