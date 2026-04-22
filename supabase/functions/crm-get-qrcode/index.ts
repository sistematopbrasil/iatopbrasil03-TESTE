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
  
  console.log('✅ Evolution API Success:', JSON.stringify(data).substring(0, 300));
  return data;
}

// Extrai QR code de várias formas possíveis do response
function extractQrCode(data: any): string | null {
  const qr = 
    data?.qrcode?.base64 ||
    data?.base64 ||
    data?.code ||
    data?.qrcode?.code ||
    data?.pairingCode ||
    null;
  
  if (qr) {
    console.log('✅ QR extraído, tipo:', 
      data?.qrcode?.base64 ? 'qrcode.base64' :
      data?.base64 ? 'base64' :
      data?.code ? 'code' :
      data?.qrcode?.code ? 'qrcode.code' :
      data?.pairingCode ? 'pairingCode' : 'unknown'
    );
  }
  
  return qr;
}

// Helper para aguardar QR Code no banco
async function waitForQRCodeInDB(supabaseAdmin: any, instanceId: string, maxAttempts = 10, delayMs = 300): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    
    const { data } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('qr_code, status')
      .eq('id', instanceId)
      .single();
    
    if (data?.qr_code) {
      console.log(`✅ QR Code encontrado no banco na tentativa ${i + 1}`);
      return data.qr_code;
    }
    
    if (data?.status === 'connected') {
      console.log('✅ Instância já conectada');
      return null;
    }
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
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
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (userDataError || !userData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Dados do usuário não encontrados' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('user_id', userData.id)
      .single();

    if (instanceError || !instance) {
      return new Response(
        JSON.stringify({ success: false, error: 'Instância não encontrada. Crie uma instância primeiro.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔵 Buscando QR Code para:', instance.instance_name);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

    // Se forceNewQR, desconectar primeiro
    if (forceNewQR && connectionState === 'open') {
      console.log('🔄 forceNewQR: desconectando antes de gerar novo QR');
      try {
        await evolutionRequest(`/instance/logout/${instance.instance_name}`, {
          method: 'DELETE',
        });
        await new Promise(resolve => setTimeout(resolve, 1500));
        connectionState = 'close';
        
        await supabaseAdmin
          .from('whatsapp_instances')
          .update({ status: 'disconnected', qr_code: null })
          .eq('id', instance.id);
      } catch (e: any) {
        console.log('⚠️ Erro ao forçar logout:', e?.message);
      }
    }

    // Se já está conectado
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

    // Tentar gerar QR Code com até 3 tentativas
    let qrCode: string | null = null;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`🔗 Connect tentativa ${attempt}...`);
        const qrResponse = await evolutionRequest(`/instance/connect/${instance.instance_name}`);
        
        // Verificar se conectou
        if (qrResponse?.instance?.state === 'open') {
          console.log('✅ Instância conectou sem QR Code');
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
        
        qrCode = extractQrCode(qrResponse);
        
        if (qrCode) break;
        
        // Aguardar antes de próxima tentativa
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 400));
        }
      } catch (e: any) {
        console.log(`⚠️ Erro ao chamar connect (tentativa ${attempt}):`, e?.message);
      }
    }

    // Se não veio QR, verificar no banco
    if (!qrCode) {
      console.log('⏳ QR Code não veio no response, verificando banco...');
      
      await supabaseAdmin
        .from('whatsapp_instances')
        .update({ status: 'connecting' })
        .eq('id', instance.id);
      
      qrCode = await waitForQRCodeInDB(supabaseAdmin, instance.id, 10, 300);
    }

    // Se ainda não tem QR
    if (!qrCode) {
      console.log('⏳ QR Code ainda não disponível');
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            status: 'connecting',
            qr_code: null,
            message: 'Aguardando QR Code. O sistema tentará obter automaticamente.',
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
