import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || '';
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '';

async function evolutionRequest(endpoint: string, options: RequestInit = {}, instanceId?: string, supabaseAdmin?: any) {
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
    console.error('❌ Evolution API Error:', { status: response.status, data });
    
    // Detectar número inexistente no WhatsApp (exists: false)
    const responseMessages = data?.response?.message;
    if (Array.isArray(responseMessages)) {
      const invalidNumber = responseMessages.find((m: any) => m.exists === false);
      if (invalidNumber) {
        console.log('⚠️ Número não existe no WhatsApp:', invalidNumber.number);
        throw new Error('Este número não está registrado no WhatsApp. Verifique se o número está correto.');
      }
    }
    
    // Detectar erro "Connection Closed" e atualizar status no banco
    const errorMessage = data?.message || data?.response?.message || '';
    const errorStr = typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage);
    
    if (errorStr.includes('Connection Closed') || errorStr.includes('Disconnected')) {
      console.log('⚠️ WhatsApp desconectado detectado. Atualizando status no banco...');
      
      if (instanceId && supabaseAdmin) {
        await supabaseAdmin
          .from('whatsapp_instances')
          .update({ 
            status: 'disconnected',
            connection_state: { error: 'Connection Closed', detected_at: new Date().toISOString() },
            updated_at: new Date().toISOString()
          })
          .eq('id', instanceId);
        console.log('✅ Status da instância atualizado para disconnected');
      }
      
      throw new Error('WhatsApp desconectado. Por favor, reconecte escaneando o QR Code novamente na aba CRM.');
    }
    
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

    // Verificar status no banco
    if (instance.status !== 'connected') {
      throw new Error('WhatsApp não está conectado. Reconecte na aba CRM > WhatsApp.');
    }

    // Verificar conexão real na Evolution API antes de enviar
    try {
      const connectionUrl = `${EVOLUTION_API_URL}/instance/connectionState/${instance.instance_name}`;
      console.log('🔵 Verificando conexão:', connectionUrl);
      
      const connectionCheck = await fetch(connectionUrl, {
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
      });
      
      const connectionData = await connectionCheck.json();
      console.log('🔵 Status da conexão Evolution API:', connectionData);
      
      // Verificar se a conexão está aberta
      const connectionState = connectionData?.instance?.state || connectionData?.state;
      if (connectionState !== 'open' && connectionState !== 'connected') {
        console.log('❌ Conexão fechada. Atualizando status no banco...');
        
        // Atualizar status no banco para refletir desconexão
        const supabaseService = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        await supabaseService
          .from('whatsapp_instances')
          .update({ 
            status: 'disconnected',
            connection_state: connectionData,
            updated_at: new Date().toISOString()
          })
          .eq('id', instance.id);
        
        throw new Error(`WhatsApp desconectado (${connectionState || 'closed'}). Reconecte escaneando o QR Code novamente na aba CRM.`);
      }
    } catch (connError: any) {
      if (connError.message.includes('WhatsApp desconectado')) {
        throw connError;
      }
      console.warn('⚠️ Não foi possível verificar conexão, tentando enviar mesmo assim:', connError.message);
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

    evolutionResponse = await evolutionRequest(
      endpoint, 
      {
        method: 'POST',
        body: JSON.stringify(requestBody),
      },
      instance.id,
      supabaseAdmin
    );

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

    // Mover lead para "Primeiro Contato" se estiver no primeiro quadro
    if (conversation.lead_id) {
      try {
        // Buscar primeiro e segundo estágio do pipeline
        const { data: stages } = await supabaseAdmin
          .from('pipeline_stages')
          .select('id, order_index')
          .eq('organization_id', conversation.organization_id)
          .order('order_index', { ascending: true })
          .limit(2);

        if (stages && stages.length >= 2) {
          const firstStageId = stages[0].id;
          const secondStageId = stages[1].id;

          // Verificar se lead está no primeiro estágio
          const { data: lead } = await supabaseAdmin
            .from('quiz_submissions_new')
            .select('pipeline_stage_id')
            .eq('id', conversation.lead_id)
            .single();

          if (lead && lead.pipeline_stage_id === firstStageId) {
            console.log('🔄 Movendo lead para Primeiro Contato...');
            await supabaseAdmin
              .from('quiz_submissions_new')
              .update({ 
                pipeline_stage_id: secondStageId,
                stage: 'contatado',
                last_contact_at: new Date().toISOString()
              })
              .eq('id', conversation.lead_id);
            console.log('✅ Lead movido para Primeiro Contato');
          }
        }
      } catch (moveError) {
        console.warn('⚠️ Erro ao mover lead (não crítico):', moveError);
      }
    }

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
    
    // Melhorar mensagem de erro para o usuário
    let userMessage = error?.message || 'Erro desconhecido';
    
    // Detectar erros comuns e traduzir - incluindo resposta da Evolution API
    const errorStr = JSON.stringify(error).toLowerCase();
    
    if (userMessage.includes('not registered') || 
        userMessage.includes('not on whatsapp') || 
        userMessage.includes('invalid number') ||
        errorStr.includes('exists') && errorStr.includes('false')) {
      userMessage = 'Este número não está registrado no WhatsApp. Verifique se o número está correto e possui WhatsApp ativo.';
    } else if (userMessage.includes('Connection Closed') || 
               userMessage.includes('Disconnected') || 
               userMessage.includes('desconectado')) {
      userMessage = 'WhatsApp desconectado. Por favor, reconecte escaneando o QR Code na aba CRM > WhatsApp.';
    } else if (userMessage === 'Erro na Evolution API') {
      userMessage = 'Não foi possível enviar a mensagem. Verifique se o número possui WhatsApp ou reconecte seu WhatsApp.';
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: userMessage,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
