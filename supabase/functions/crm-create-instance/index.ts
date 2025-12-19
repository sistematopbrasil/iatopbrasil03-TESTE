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
    console.error('❌ Evolution API Error:', { status: response.status, error: response.statusText, response: data });
    return { success: false, status: response.status, error: data };
  }
  
  console.log('✅ Evolution API Success:', data);
  return { success: true, data };
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

    console.log('🔵 Criando instância para usuário:', user.id);

    // Buscar dados do usuário na tabela users
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('id, full_name, organization_id')
      .eq('auth_user_id', user.id)
      .single();

    if (userDataError || !userData) {
      console.error('❌ Erro ao buscar usuário:', userDataError);
      throw new Error('Dados do usuário não encontrados');
    }

    // Usar service role para operações administrativas
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar se já existe instância
    const { data: existingInstance } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('*')
      .eq('user_id', userData.id)
      .single();

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

    // Gerar nome único para instância usando timestamp
    const timestamp = Date.now();
    const baseName = userData.full_name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 15);
    
    const instanceName = `${baseName}_${timestamp}`;
    console.log('🔵 Nome da instância:', instanceName);

    // Criar webhook URL
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/crm-webhook`;

    // Criar instância na Evolution
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
      // Se o nome já existe, tentar com outro sufixo
      if (evolutionResponse.error?.message?.includes('already in use')) {
        console.log('⚠️ Nome em uso, tentando com sufixo alternativo...');
        const altInstanceName = `${baseName}_${timestamp}_${Math.random().toString(36).substring(2, 6)}`;
        
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
          throw new Error('Erro ao criar instância na Evolution API');
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
      
      throw new Error('Erro ao criar instância na Evolution API');
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
    await supabaseAdmin.rpc('create_audit_log', {
      p_user_id: userData.id,
      p_organization_id: userData.organization_id,
      p_action: 'create_instance',
      p_resource_type: 'whatsapp_instance',
      p_resource_id: newInstance.id,
      p_metadata: { instance_name: instanceName },
    });

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
