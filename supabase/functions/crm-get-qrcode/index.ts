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
    // Ler parâmetros do body
    let forceNewQR = false;
    try {
      const body = await req.json();
      forceNewQR = body?.forceNewQR === true;
    } catch {
      // Body vazio é OK
    }

    console.log('🔵 forceNewQR:', forceNewQR);

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

    // Buscar dados do usuário
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('id')
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
      throw new Error('Instância não encontrada. Crie uma instância primeiro.');
    }

    console.log('🔵 Buscando QR Code para:', instance.instance_name);

    // Buscar status da instância
    let connectionState = 'close';
    try {
      const statusResponse = await evolutionRequest(
        `/instance/connectionState/${instance.instance_name}`
      );
      connectionState = statusResponse?.instance?.state || 'close';
    } catch (e: any) {
      console.log('⚠️ Erro ao buscar status, tentando conectar:', e?.message);
    }

    console.log('🔵 Status da conexão:', connectionState);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Se forceNewQR, desconectar primeiro para gerar novo QR
    if (forceNewQR && connectionState === 'open') {
      console.log('🔄 forceNewQR: desconectando antes de gerar novo QR');
      try {
        await evolutionRequest(`/instance/logout/${instance.instance_name}`, {
          method: 'DELETE',
        });
        // Aguardar um pouco para o logout processar
        await new Promise(resolve => setTimeout(resolve, 1000));
        connectionState = 'close';
      } catch (e: any) {
        console.log('⚠️ Erro ao forçar logout:', e?.message);
      }
    }

    // Se já está conectado (e não forçamos novo QR)
    if (connectionState === 'open') {
      await supabaseAdmin
        .from('whatsapp_instances')
        .update({
          status: 'connected',
          last_connected_at: new Date().toISOString(),
          qr_code: null,
        })
        .eq('id', instance.id);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            status: 'connected',
            qr_code: null,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar QR Code
    const qrResponse = await evolutionRequest(`/instance/connect/${instance.instance_name}`);
    const qrCode = qrResponse?.qrcode?.base64 || qrResponse?.qrcode?.code || qrResponse?.base64;

    if (!qrCode) {
      console.log('⚠️ QR Code não disponível, resposta:', qrResponse);
      throw new Error('QR Code não disponível. Tente novamente.');
    }

    // Atualizar QR Code no banco
    await supabaseAdmin
      .from('whatsapp_instances')
      .update({
        qr_code: qrCode,
        status: 'connecting',
      })
      .eq('id', instance.id);

    console.log('✅ QR Code gerado com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          status: 'connecting',
          qr_code: qrCode,
        },
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
