import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || '';
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '';

async function evolutionRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${EVOLUTION_API_URL}${endpoint}`;
  console.log('🔵 Evolution API Request:', { url, method: options.method || 'GET' });
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_KEY,
      ...options.headers,
    },
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error('❌ Evolution API Error:', data);
    throw new Error(data.message || 'Erro na Evolution API');
  }
  
  console.log('✅ Evolution API Success:', data);
  return data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autorizado');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Usuário não autenticado');
    }

    const body = await req.json();
    const { conversation_id, type = 'text', content, media_url, file_name, caption } = body;

    if (type === 'text' && !content) {
      throw new Error('Conteúdo da mensagem é obrigatório');
    }

    // Buscar dados do usuário
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('id, organization_id')
      .eq('auth_user_id', user.id)
      .single();

    if (userDataError || !userData) {
      throw new Error('Dados do usuário não encontrados');
    }

    // Buscar instância do usuário
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('user_id', userData.id)
      .single();

    if (instanceError || !instance) {
      throw new Error('Instância não encontrada');
    }

    if (instance.status !== 'connected') {
      throw new Error('WhatsApp não está conectado');
    }

    // Buscar conversa para obter o telefone
    if (!conversation_id) {
      throw new Error('ID da conversa é obrigatório');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: conversation, error: convError } = await supabaseAdmin
      .from('crm_conversations')
      .select('*')
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      throw new Error('Conversa não encontrada');
    }

    const phone = conversation.contact_phone;
    if (!phone) {
      throw new Error('Número de telefone não encontrado na conversa');
    }

    console.log('🔵 Enviando mensagem para:', phone);

    // Formatar número (remover caracteres especiais, adicionar @s.whatsapp.net)
    const formattedPhone = phone.replace(/\D/g, '') + '@s.whatsapp.net';

    let evolutionResponse;
    let endpoint;
    let requestBody;

    switch (type) {
      case 'text':
        endpoint = `/message/sendText/${instance.instance_name}`;
        requestBody = {
          number: formattedPhone,
          text: content,
        };
        break;
      case 'audio':
        endpoint = `/message/sendWhatsAppAudio/${instance.instance_name}`;
        requestBody = {
          number: formattedPhone,
          audio: media_url,
        };
        break;
      case 'image':
        endpoint = `/message/sendMedia/${instance.instance_name}`;
        requestBody = {
          number: formattedPhone,
          mediatype: 'image',
          media: media_url,
          caption: caption || '',
        };
        break;
      case 'video':
        endpoint = `/message/sendMedia/${instance.instance_name}`;
        requestBody = {
          number: formattedPhone,
          mediatype: 'video',
          media: media_url,
          caption: caption || '',
        };
        break;
      case 'document':
        endpoint = `/message/sendMedia/${instance.instance_name}`;
        requestBody = {
          number: formattedPhone,
          mediatype: 'document',
          media: media_url,
          fileName: file_name || 'document',
        };
        break;
      default:
        throw new Error('Tipo de mensagem não suportado');
    }

    evolutionResponse = await evolutionRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    // Salvar mensagem no banco
    const messageId = evolutionResponse?.key?.id || `sent-${Date.now()}`;
    
    const { error: msgError } = await supabaseAdmin
      .from('crm_messages')
      .insert({
        conversation_id: conversation.id,
        message_id: messageId,
        direction: 'outgoing',
        type,
        content: type === 'text' ? content : caption || null,
        media_url: media_url || null,
        media_filename: file_name || null,
        status: 'sent',
        timestamp: new Date().toISOString(),
        metadata: evolutionResponse,
      });

    if (msgError) {
      console.error('❌ Erro ao salvar mensagem:', msgError);
    }

    // Atualizar conversa
    await supabaseAdmin
      .from('crm_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: type === 'text' ? content.substring(0, 100) : `📎 ${type}`,
      })
      .eq('id', conversation.id);

    console.log('✅ Mensagem enviada com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          messageId,
          conversationId: conversation.id,
        },
        message: 'Mensagem enviada com sucesso',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Erro desconhecido',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
