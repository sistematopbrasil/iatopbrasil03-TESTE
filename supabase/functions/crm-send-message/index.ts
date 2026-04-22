import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getIntegrationValue } from '../_shared/integration-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

let EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || '';
let EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '';

async function loadEvolutionCreds(supabaseAdmin: any) {
  const url = await getIntegrationValue('EVOLUTION_API_URL', supabaseAdmin);
  const key = await getIntegrationValue('EVOLUTION_API_KEY', supabaseAdmin);
  if (url) EVOLUTION_API_URL = url;
  if (key) EVOLUTION_API_KEY = key;
}


/**
 * Gera variantes do telefone brasileiro (com/sem 9 adicional após DDD)
 */
function getPhoneVariants(phone: string): string[] {
  const cleaned = phone.replace(/\D/g, '');
  const variants: string[] = [cleaned];
  
  // Formato esperado: 55 + DDD(2) + número(8 ou 9)
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    const ddd = cleaned.slice(2, 4);
    const rest = cleaned.slice(4);
    
    // Se tem 9 dígitos no número (total 13), criar variante sem o 9
    if (rest.length === 9 && rest.startsWith('9')) {
      const withoutNine = `55${ddd}${rest.slice(1)}`;
      variants.push(withoutNine);
    }
    // Se tem 8 dígitos no número (total 12), criar variante com o 9
    else if (rest.length === 8) {
      const withNine = `55${ddd}9${rest}`;
      variants.push(withNine);
    }
  }
  
  console.log('📱 Variantes de telefone geradas:', variants);
  return variants;
}

interface SendResult {
  success: boolean;
  response?: any;
  error?: string;
  usedPhone?: string;
}

async function trySendMessage(
  instanceName: string,
  endpoint: string,
  requestBody: any,
  phoneVariants: string[]
): Promise<SendResult> {
  for (const phone of phoneVariants) {
    const formattedPhone = phone + '@s.whatsapp.net';
    const bodyWithPhone = { ...requestBody, number: formattedPhone };
    
    console.log(`🔵 Tentando enviar para: ${phone}`);
    
    const url = `${EVOLUTION_API_URL}${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
      },
      body: JSON.stringify(bodyWithPhone),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ Mensagem enviada com sucesso para: ${phone}`);
      return { success: true, response: data, usedPhone: phone };
    }
    
    // Verificar se é erro de número inexistente
    const responseMessages = data?.response?.message;
    if (Array.isArray(responseMessages)) {
      const invalidNumber = responseMessages.find((m: any) => m.exists === false);
      if (invalidNumber) {
        console.log(`⚠️ Número ${phone} não existe no WhatsApp, tentando próxima variante...`);
        continue; // Tenta próxima variante
      }
    }
    
    // Verificar erro de conexão
    const errorMessage = data?.message || data?.response?.message || '';
    const errorStr = typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage);
    
    if (errorStr.includes('Connection Closed') || errorStr.includes('Disconnected')) {
      return { success: false, error: 'CONNECTION_CLOSED', response: data };
    }
    
    // Outro erro - não tentar mais variantes
    console.error('❌ Erro no envio:', data);
    return { success: false, error: data.message || 'Erro na Evolution API', response: data };
  }
  
  // Nenhuma variante funcionou
  return { 
    success: false, 
    error: 'Este número não está registrado no WhatsApp. Verifique se o número está correto.' 
  };
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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    await loadEvolutionCreds(supabaseAdmin);

    // ⚡ PRIMEIRO: Verificar conexão real na Evolution API ANTES de checar o banco
    let realConnectionState = 'unknown';
    try {
      const connectionUrl = `${EVOLUTION_API_URL}/instance/connectionState/${instance.instance_name}`;
      console.log('🔵 Verificando conexão real:', connectionUrl);
      
      const connectionCheck = await fetch(connectionUrl, {
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
      });
      
      const connectionData = await connectionCheck.json();
      console.log('🔵 Status da conexão Evolution API:', connectionData);
      
      realConnectionState = connectionData?.instance?.state || connectionData?.state || 'unknown';
      
      // Se está realmente conectado, atualizar banco para 'connected' se necessário
      if (realConnectionState === 'open' || realConnectionState === 'connected') {
        if (instance.status !== 'connected') {
          console.log('✅ Conexão OK, atualizando status no banco para connected');
          await supabaseAdmin
            .from('whatsapp_instances')
            .update({ 
              status: 'connected',
              connection_state: connectionData,
              updated_at: new Date().toISOString()
            })
            .eq('id', instance.id);
        }
      } else {
        // Conexão não está open - atualizar banco e retornar erro estruturado
        console.log('❌ Conexão não está open. Estado real:', realConnectionState);
        
        await supabaseAdmin
          .from('whatsapp_instances')
          .update({ 
            status: realConnectionState === 'close' ? 'disconnected' : 'connecting',
            connection_state: connectionData,
            updated_at: new Date().toISOString()
          })
          .eq('id', instance.id);
        
        return new Response(
          JSON.stringify({
            success: false,
            error: `WhatsApp desconectado (${realConnectionState}). Escaneie o QR Code novamente.`,
            errorCode: 'WHATSAPP_NOT_CONNECTED',
            needsReconnect: true,
            connectionState: realConnectionState,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    } catch (connError: any) {
      console.warn('⚠️ Não foi possível verificar conexão, verificando status no banco:', connError.message);
      
      // Fallback: checar status no banco
      if (instance.status !== 'connected') {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'WhatsApp não está conectado. Reconecte na aba CRM > WhatsApp.',
            errorCode: 'WHATSAPP_NOT_CONNECTED',
            needsReconnect: true,
            connectionState: instance.status,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Buscar conversa para obter o telefone
    if (!conversation_id) {
      throw new Error('ID da conversa é obrigatório');
    }

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

    console.log('🔵 Telefone original da conversa:', phone);

    // Gerar variantes do telefone (com/sem 9)
    const phoneVariants = getPhoneVariants(phone);

    // Preparar endpoint e body base (sem número, será adicionado pelo trySendMessage)
    let endpoint: string;
    let baseRequestBody: any;

    switch (type) {
      case 'text':
        endpoint = `/message/sendText/${instance.instance_name}`;
        baseRequestBody = { text: content };
        break;
      case 'audio':
        endpoint = `/message/sendWhatsAppAudio/${instance.instance_name}`;
        baseRequestBody = { audio: media_url };
        break;
      case 'image':
        endpoint = `/message/sendMedia/${instance.instance_name}`;
        baseRequestBody = { mediatype: 'image', media: media_url, caption: caption || content || '' };
        break;
      case 'video':
        endpoint = `/message/sendMedia/${instance.instance_name}`;
        baseRequestBody = { mediatype: 'video', media: media_url, caption: caption || content || '' };
        break;
      case 'document':
        endpoint = `/message/sendMedia/${instance.instance_name}`;
        baseRequestBody = { mediatype: 'document', media: media_url, fileName: file_name || 'document', caption: caption || content || '' };
        break;
      default:
        throw new Error('Tipo de mensagem não suportado');
    }

    // Tentar enviar com fallback de variantes
    const sendResult = await trySendMessage(instance.instance_name, endpoint, baseRequestBody, phoneVariants);

    if (!sendResult.success) {
      if (sendResult.error === 'CONNECTION_CLOSED') {
        await supabaseAdmin
          .from('whatsapp_instances')
          .update({ 
            status: 'disconnected',
            connection_state: { error: 'Connection Closed', detected_at: new Date().toISOString() },
            updated_at: new Date().toISOString()
          })
          .eq('id', instance.id);
        
        return new Response(
          JSON.stringify({
            success: false,
            error: 'WhatsApp desconectado. Escaneie o QR Code novamente.',
            errorCode: 'WHATSAPP_NOT_CONNECTED',
            needsReconnect: true,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      throw new Error(sendResult.error || 'Erro ao enviar mensagem');
    }

    // Se usou um telefone diferente do original, atualizar a conversa
    if (sendResult.usedPhone && sendResult.usedPhone !== phone.replace(/\D/g, '')) {
      console.log(`📱 Atualizando telefone da conversa de ${phone} para ${sendResult.usedPhone}`);
      await supabaseAdmin
        .from('crm_conversations')
        .update({ contact_phone: sendResult.usedPhone })
        .eq('id', conversation.id);
    }

    // Salvar mensagem no banco com instance_id
    const messageId = sendResult.response?.key?.id || `sent-${Date.now()}`;
    
    const { error: msgError } = await supabaseAdmin
      .from('crm_messages')
      .upsert({
        conversation_id: conversation.id,
        instance_id: instance.id,
        message_id: messageId,
        direction: 'outgoing',
        type,
        content: type === 'text' ? content : caption || null,
        media_url: media_url || null,
        media_filename: file_name || null,
        status: 'sent',
        timestamp: new Date().toISOString(),
        metadata: sendResult.response,
      }, { onConflict: 'instance_id,message_id' });

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
        const { data: stages } = await supabaseAdmin
          .from('pipeline_stages')
          .select('id, order_index')
          .eq('organization_id', conversation.organization_id)
          .order('order_index', { ascending: true })
          .limit(2);

        if (stages && stages.length >= 2) {
          const firstStageId = stages[0].id;
          const secondStageId = stages[1].id;

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
    
    let userMessage = error?.message || 'Erro desconhecido';
    let needsReconnect = false;
    
    const errorStr = JSON.stringify(error).toLowerCase();
    
    if (userMessage.includes('not registered') || 
        userMessage.includes('not on whatsapp') || 
        userMessage.includes('invalid number') ||
        errorStr.includes('exists') && errorStr.includes('false')) {
      userMessage = 'Este número não está registrado no WhatsApp. Verifique se o número está correto e possui WhatsApp ativo.';
    } else if (userMessage.includes('Connection Closed') || 
               userMessage.includes('Disconnected') || 
               userMessage.includes('desconectado')) {
      userMessage = 'WhatsApp desconectado. Escaneie o QR Code novamente.';
      needsReconnect = true;
    } else if (userMessage === 'Erro na Evolution API') {
      userMessage = 'Não foi possível enviar a mensagem. Verifique se o número possui WhatsApp ou reconecte seu WhatsApp.';
      needsReconnect = true;
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: userMessage,
        needsReconnect,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
