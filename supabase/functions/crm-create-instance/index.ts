import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || '';
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '';

async function evolutionRequest(endpoint: string, options: RequestInit = {}) {
  const baseUrl = EVOLUTION_API_URL.replace(/\/$/, '');
  const url = `${baseUrl}${endpoint}`;
  
  console.log('🔵 Evolution API Request:', { 
    url, 
    method: options.method || 'GET',
  });
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
        ...options.headers,
      },
    });
    
    console.log('🔵 Evolution API Response Status:', response.status);
    
    const responseText = await response.text();
    console.log('🔵 Evolution API Response:', responseText.substring(0, 500));
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse response as JSON');
      return { success: false, status: response.status, error: { message: 'Invalid JSON response' } };
    }
    
    if (!response.ok) {
      console.error('❌ Evolution API Error:', data);
      return { success: false, status: response.status, error: data };
    }
    
    console.log('✅ Evolution API Success');
    return { success: true, data };
  } catch (fetchError: any) {
    console.error('❌ Evolution API Fetch Error:', fetchError.message);
    return { success: false, status: 0, error: { message: fetchError.message, type: 'fetch_error' } };
  }
}

// Extrai QR code de várias formas possíveis
function extractQrCode(data: any): string | null {
  return (
    data?.qrcode?.base64 ||
    data?.base64 ||
    data?.code ||
    data?.qrcode?.code ||
    data?.pairingCode ||
    null
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🚀 CRM Create Instance - Iniciando...');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ No authorization header');
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
      console.error('❌ Auth error:', userError);
      throw new Error('Usuário não autenticado');
    }

    console.log('🔵 Usuário autenticado:', user.id);

    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('id, full_name, organization_id, username')
      .eq('auth_user_id', user.id)
      .single();

    if (userDataError || !userData) {
      console.error('❌ Erro ao buscar usuário:', userDataError);
      throw new Error('Dados do usuário não encontrados');
    }

    console.log('🔵 Dados do usuário:', { id: userData.id, name: userData.full_name });

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar se já existe instância
    const { data: existingInstance, error: existingError } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('*')
      .eq('user_id', userData.id)
      .maybeSingle();

    if (existingError) {
      console.error('❌ Erro ao verificar instância existente:', existingError);
    }

    // Se já existe instância, tentar conectar e retornar QR
    if (existingInstance) {
      console.log('✅ Instância já existe:', existingInstance.instance_name);
      
      // Tentar conectar e obter QR
      let qrCode: string | null = null;
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`🔗 Connect tentativa ${attempt}...`);
          const connectResponse = await evolutionRequest(`/instance/connect/${existingInstance.instance_name}`);
          
          if (connectResponse.success) {
            qrCode = extractQrCode(connectResponse.data);
            
            if (connectResponse.data?.instance?.state === 'open') {
              // Já conectado
              await supabaseAdmin
                .from('whatsapp_instances')
                .update({
                  status: 'connected',
                  qr_code: null,
                  last_connected_at: new Date().toISOString(),
                })
                .eq('id', existingInstance.id);
              
              return new Response(
                JSON.stringify({
                  success: true,
                  data: { ...existingInstance, status: 'connected', qr_code: null },
                  message: 'Já conectado',
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            
            if (qrCode) {
              await supabaseAdmin
                .from('whatsapp_instances')
                .update({
                  status: 'connecting',
                  qr_code: qrCode,
                })
                .eq('id', existingInstance.id);
              
              return new Response(
                JSON.stringify({
                  success: true,
                  data: { ...existingInstance, status: 'connecting', qr_code: qrCode },
                  message: 'QR Code gerado',
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
          
          if (attempt < 3) await new Promise(r => setTimeout(r, 400));
        } catch (e: any) {
          console.error(`❌ Erro connect tentativa ${attempt}:`, e.message);
        }
      }
      
      // Retornar instância mesmo sem QR (frontend vai fazer polling)
      await supabaseAdmin
        .from('whatsapp_instances')
        .update({ status: 'connecting' })
        .eq('id', existingInstance.id);
      
      return new Response(
        JSON.stringify({
          success: true,
          data: { ...existingInstance, status: 'connecting' },
          message: 'Instância reconectando',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar nova instância
    const instanceName = userData.username || (
      userData.full_name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 15) + Date.now()
    );
    console.log('🔵 Nome da instância:', instanceName);

    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/crm-webhook`;
    console.log('🔵 Webhook URL:', webhookUrl);

    // Criar instância na Evolution - incluir TODOS os eventos relevantes
    console.log('🔵 Criando instância na Evolution API...');
    const webhookEvents = [
      'QRCODE_UPDATED',
      'CONNECTION_UPDATE', 
      'MESSAGES_UPSERT',
      'MESSAGES_UPDATE',
      'MESSAGES_SET',
      'MESSAGES_DELETE',
      'SEND_MESSAGE',
      'MESSAGE_ACK',
    ];
    
    const evolutionResponse = await evolutionRequest('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        webhook: {
          url: webhookUrl,
          enabled: true,
          webhookByEvents: true,
          webhookBase64: true,
          events: webhookEvents,
        },
      }),
    });

    if (!evolutionResponse.success) {
      console.error('❌ Falha ao criar instância:', evolutionResponse);
      
      // Verificar se nome já existe
      const errorMessage = evolutionResponse.error?.message;
      const isNameInUse = 
        (typeof errorMessage === 'string' && errorMessage.includes('already in use')) ||
        (Array.isArray(errorMessage) && errorMessage.some((m: string) => m.includes('already in use')));

      if (isNameInUse) {
        console.log('⚠️ Nome em uso, tentando com sufixo...');
        const altInstanceName = `${instanceName}_${Math.random().toString(36).substring(2, 6)}`;
        
        const retryResponse = await evolutionRequest('/instance/create', {
          method: 'POST',
          body: JSON.stringify({
            instanceName: altInstanceName,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
            webhook: {
              url: webhookUrl,
              enabled: true,
              webhookByEvents: true,
              webhookBase64: true,
              events: webhookEvents,
            },
          }),
        });

        if (!retryResponse.success) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Não foi possível criar a instância. Tente novamente.',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Salvar com nome alternativo
        const { data: newInstance, error: insertError } = await supabaseAdmin
          .from('whatsapp_instances')
          .insert({
            user_id: userData.id,
            organization_id: userData.organization_id,
            instance_name: altInstanceName,
            instance_key: retryResponse.data.instance?.instanceName || altInstanceName,
            status: 'disconnected',
            webhook_url: webhookUrl,
          })
          .select()
          .single();

        if (insertError) {
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao salvar instância' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Tentar obter QR imediatamente
        let qrCode: string | null = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          const connectResponse = await evolutionRequest(`/instance/connect/${altInstanceName}`);
          if (connectResponse.success) {
            qrCode = extractQrCode(connectResponse.data);
            if (qrCode) {
              await supabaseAdmin
                .from('whatsapp_instances')
                .update({ qr_code: qrCode, status: 'connecting' })
                .eq('id', newInstance.id);
              break;
            }
          }
          if (attempt < 3) await new Promise(r => setTimeout(r, 400));
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: { ...newInstance, qr_code: qrCode, status: qrCode ? 'connecting' : 'disconnected' },
            message: 'Instância criada',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Erro ao criar instância. Tente novamente.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Salvar instância
    const { data: newInstance, error: insertError } = await supabaseAdmin
      .from('whatsapp_instances')
      .insert({
        user_id: userData.id,
        organization_id: userData.organization_id,
        instance_name: instanceName,
        instance_key: evolutionResponse.data.instance?.instanceName || instanceName,
        status: 'disconnected',
        webhook_url: webhookUrl,
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erro ao salvar instância:', insertError);
      throw new Error('Erro ao salvar instância');
    }

    // Tentar obter QR imediatamente após criar
    console.log('🔗 Tentando obter QR após criar...');
    let qrCode: string | null = null;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const connectResponse = await evolutionRequest(`/instance/connect/${instanceName}`);
        if (connectResponse.success) {
          qrCode = extractQrCode(connectResponse.data);
          if (qrCode) {
            console.log('✅ QR obtido na tentativa', attempt);
            await supabaseAdmin
              .from('whatsapp_instances')
              .update({ qr_code: qrCode, status: 'connecting' })
              .eq('id', newInstance.id);
            break;
          }
        }
        if (attempt < 3) await new Promise(r => setTimeout(r, 400));
      } catch (e: any) {
        console.error(`❌ Erro connect tentativa ${attempt}:`, e.message);
      }
    }

    // Criar log de auditoria
    try {
      await supabaseAdmin.rpc('create_audit_log', {
        p_user_id: userData.id,
        p_organization_id: userData.organization_id,
        p_action: 'create_instance',
        p_resource_type: 'whatsapp_instance',
        p_resource_id: newInstance.id,
        p_metadata: { instance_name: instanceName },
      });
    } catch (auditError) {
      console.warn('⚠️ Erro ao criar log de auditoria:', auditError);
    }

    console.log('✅ Instância criada:', newInstance.id, 'QR:', !!qrCode);

    return new Response(
      JSON.stringify({
        success: true,
        data: { ...newInstance, qr_code: qrCode, status: qrCode ? 'connecting' : 'disconnected' },
        message: 'Instância criada com sucesso',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Erro geral:', error?.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Erro desconhecido',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
