import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || '';
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '';

async function evolutionRequest(endpoint: string, options: RequestInit = {}) {
  // Remover barra final da URL base se existir
  const baseUrl = EVOLUTION_API_URL.replace(/\/$/, '');
  const url = `${baseUrl}${endpoint}`;
  
  console.log('🔵 Evolution API Request:', { 
    url, 
    method: options.method || 'GET',
    baseUrl,
    endpoint,
    hasApiKey: !!EVOLUTION_API_KEY,
    apiKeyPrefix: EVOLUTION_API_KEY ? EVOLUTION_API_KEY.substring(0, 8) + '...' : 'N/A'
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
    
    console.log('🔵 Evolution API Response Status:', response.status, response.statusText);
    
    const responseText = await response.text();
    console.log('🔵 Evolution API Response Body (raw):', responseText.substring(0, 500));
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse Evolution API response as JSON:', parseError);
      return { success: false, status: response.status, error: { message: 'Invalid JSON response', raw: responseText.substring(0, 200) } };
    }
    
    if (!response.ok) {
      console.error('❌ Evolution API Error:', { 
        status: response.status, 
        statusText: response.statusText, 
        response: data 
      });
      return { success: false, status: response.status, error: data };
    }
    
    console.log('✅ Evolution API Success:', JSON.stringify(data).substring(0, 500));
    return { success: true, data };
  } catch (fetchError: any) {
    console.error('❌ Evolution API Fetch Error:', {
      message: fetchError.message,
      name: fetchError.name,
      stack: fetchError.stack?.substring(0, 300)
    });
    return { success: false, status: 0, error: { message: fetchError.message, type: 'fetch_error' } };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🚀 CRM Create Instance - Iniciando...');
    console.log('🔵 Environment check:', {
      hasEvolutionUrl: !!EVOLUTION_API_URL,
      evolutionUrl: EVOLUTION_API_URL ? EVOLUTION_API_URL.substring(0, 50) + '...' : 'NOT SET',
      hasEvolutionKey: !!EVOLUTION_API_KEY,
      hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
      hasSupabaseKey: !!Deno.env.get('SUPABASE_ANON_KEY'),
      hasServiceRole: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    });

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

    // Buscar dados do usuário na tabela users
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('id, full_name, organization_id, username')
      .eq('auth_user_id', user.id)
      .single();

    if (userDataError || !userData) {
      console.error('❌ Erro ao buscar usuário:', userDataError);
      throw new Error('Dados do usuário não encontrados');
    }

    console.log('🔵 Dados do usuário:', { id: userData.id, name: userData.full_name, username: userData.username });

    // Usar service role para operações administrativas
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

    if (existingInstance) {
      console.log('✅ Instância já existe:', existingInstance.instance_name);
      return new Response(
        JSON.stringify({
          success: true,
          data: existingInstance,
          message: 'Instância já existe',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Usar username como nome da instância, ou gerar baseado no nome
    const instanceName = userData.username || (
      userData.full_name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 15) + Date.now()
    );
    console.log('🔵 Nome da instância:', instanceName);

    // Criar webhook URL
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/crm-webhook`;
    console.log('🔵 Webhook URL:', webhookUrl);

    // Criar instância na Evolution
    console.log('🔵 Tentando criar instância na Evolution API...');
    const evolutionResponse = await evolutionRequest('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        webhook: {
          url: webhookUrl,
          events: [
            'QRCODE_UPDATED',
            'CONNECTION_UPDATE',
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'SEND_MESSAGE',
          ],
        },
      }),
    });

    if (!evolutionResponse.success) {
      console.error('❌ Falha ao criar instância:', evolutionResponse);
      
      // Se o nome já existe, tentar com outro sufixo
      if (evolutionResponse.error?.message?.includes('already in use') || 
          evolutionResponse.error?.response?.message?.includes('already in use')) {
        console.log('⚠️ Nome em uso, tentando com sufixo alternativo...');
        const altInstanceName = `${instanceName}_${Math.random().toString(36).substring(2, 6)}`;
        
        const retryResponse = await evolutionRequest('/instance/create', {
          method: 'POST',
          body: JSON.stringify({
            instanceName: altInstanceName,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
            webhook: {
              url: webhookUrl,
              events: [
                'QRCODE_UPDATED',
                'CONNECTION_UPDATE',
                'MESSAGES_UPSERT',
                'MESSAGES_UPDATE',
                'SEND_MESSAGE',
              ],
            },
          }),
        });

        if (!retryResponse.success) {
          console.error('❌ Retry também falhou:', retryResponse);
          throw new Error(`Erro ao criar instância na Evolution API: ${JSON.stringify(retryResponse.error)}`);
        }

        // Salvar instância no banco com nome alternativo
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
          console.error('❌ Erro ao salvar instância:', insertError);
          throw new Error('Erro ao salvar instância no banco');
        }

        console.log('✅ Instância criada com sucesso (nome alternativo):', newInstance);

        return new Response(
          JSON.stringify({
            success: true,
            data: newInstance,
            message: 'Instância criada com sucesso',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Erro ao criar instância na Evolution API: ${JSON.stringify(evolutionResponse.error)}`);
    }

    // Salvar instância no banco
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
      throw new Error('Erro ao salvar instância no banco');
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
      console.warn('⚠️ Erro ao criar log de auditoria (não crítico):', auditError);
    }

    console.log('✅ Instância criada com sucesso:', newInstance);

    return new Response(
      JSON.stringify({
        success: true,
        data: newInstance,
        message: 'Instância criada com sucesso',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Erro geral:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack?.substring(0, 500)
    });
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Erro desconhecido',
        details: error?.stack?.substring(0, 200)
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
