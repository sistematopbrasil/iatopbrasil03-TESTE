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


async function evolutionRequest(endpoint: string, options: RequestInit = {}, timeoutMs = 15000) {
  const url = `${EVOLUTION_API_URL}${endpoint}`;
  console.log('🔵 Evolution:', options.method || 'GET', endpoint);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
        ...options.headers,
      },
    });
    
    clearTimeout(timeoutId);
    const data = await response.json();
    return { ok: response.ok, data };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error('⏰ Timeout na Evolution API:', endpoint);
      return { ok: false, data: null, timeout: true };
    }
    throw error;
  }
}

// Verifica se a instância existe na Evolution API
async function checkInstanceExists(instanceName: string): Promise<boolean> {
  try {
    const result = await evolutionRequest(`/instance/fetchInstances?instanceName=${instanceName}`);
    if (result.ok && Array.isArray(result.data) && result.data.length > 0) {
      console.log('✅ Instância existe na Evolution:', instanceName);
      return true;
    }
    console.log('⚠️ Instância NÃO existe na Evolution:', instanceName);
    return false;
  } catch (e) {
    console.error('Erro ao verificar instância:', e);
    return false;
  }
}

// Cria uma nova instância na Evolution API
async function createInstanceInEvolution(instanceName: string, webhookUrl: string): Promise<boolean> {
  try {
    console.log('🆕 Criando instância na Evolution:', instanceName);
    const result = await evolutionRequest('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName: instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        webhook: {
          url: webhookUrl,
          webhook_by_events: true,
          webhook_base64: true,
          events: [
            'QRCODE_UPDATED',
            'CONNECTION_UPDATE',
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'MESSAGES_SET',
            'MESSAGES_DELETE',
            'MESSAGE_ACK',
            'SEND_MESSAGE',
          ],
        },
      }),
    });
    
    if (result.ok) {
      console.log('✅ Instância criada na Evolution');
      return true;
    } else {
      console.error('❌ Falha ao criar instância:', result.data);
      return false;
    }
  } catch (e) {
    console.error('❌ Erro ao criar instância:', e);
    return false;
  }
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let mode = 'soft';
    try {
      const body = await req.json();
      mode = body?.mode || 'soft';
    } catch {
      // Body vazio é OK
    }

    console.log('🔧 Repair mode:', mode);

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

    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (!userData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('user_id', userData.id)
      .single();

    if (!instance) {
      return new Response(
        JSON.stringify({ success: false, error: 'Instância não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    await loadEvolutionCreds(supabaseAdmin);

    const steps: string[] = [];
    let qrCode: string | null = null;
    
    // URL do webhook
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/crm-webhook`;

    // ✅ VERIFICAR SE A INSTÂNCIA EXISTE NA EVOLUTION ANTES DE TUDO
    const instanceExists = await checkInstanceExists(instance.instance_name);
    steps.push(`instance_check: ${instanceExists ? 'exists' : 'not_found'}`);

    if (!instanceExists) {
      console.log('⚠️ Instância não existe na Evolution, recriando...');
      const created = await createInstanceInEvolution(instance.instance_name, webhookUrl);
      steps.push(`instance_recreate: ${created ? 'ok' : 'failed'}`);
      
      if (!created) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Falha ao recriar instância. Tente novamente ou entre em contato com o suporte.',
            steps,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Aguardar a instância ser criada
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (mode === 'hard') {
      console.log('🔴 Iniciando HARD repair...');

      // 1. Restart
      try {
        const restartResult = await evolutionRequest(`/instance/restart/${instance.instance_name}`, {
          method: 'PUT',
        });
        steps.push(`restart: ${restartResult.ok ? 'ok' : 'failed'}`);
      } catch (e) {
        steps.push('restart: error');
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      // 2. Logout
      try {
        const logoutResult = await evolutionRequest(`/instance/logout/${instance.instance_name}`, {
          method: 'DELETE',
        });
        steps.push(`logout: ${logoutResult.ok ? 'ok' : 'failed'}`);
      } catch (e) {
        steps.push('logout: error');
      }

      await new Promise(resolve => setTimeout(resolve, 1500));

      // 3. Limpar banco
      await supabaseAdmin
        .from('whatsapp_instances')
        .update({
          status: 'disconnected',
          qr_code: null,
          connection_state: null,
        })
        .eq('id', instance.id);
      steps.push('db_cleanup: ok');

      // 4. Forçar configuração do webhook
      try {
        console.log('🔧 Reconfigurando webhook...');
        const webhookSecret = (await getIntegrationValue('EVOLUTION_WEBHOOK_SECRET', supabaseAdmin)) || '';
        const webhookResult = await evolutionRequest(`/webhook/set/${instance.instance_name}`, {
          method: 'POST',
          body: JSON.stringify({
            webhook: {
              enabled: true,
              url: webhookUrl,
              webhookByEvents: false,
              webhookBase64: true,
              headers: webhookSecret ? { 'x-webhook-secret': webhookSecret } : undefined,
              events: [
                'QRCODE_UPDATED',
                'CONNECTION_UPDATE',
                'MESSAGES_UPSERT',
                'MESSAGES_UPDATE',
                'MESSAGES_SET',
                'MESSAGES_DELETE',
                'MESSAGE_ACK',
                'SEND_MESSAGE',
              ],
            },
          }),
        });
        steps.push(`webhook_set: ${webhookResult.ok ? 'ok' : 'failed'}`);
      } catch (e) {
        steps.push('webhook_set: error');
      }

      // 5. Conectar com retry
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`🔗 Connect tentativa ${attempt}...`);
          const connectResult = await evolutionRequest(`/instance/connect/${instance.instance_name}`);
          steps.push(`connect_${attempt}: ${connectResult.ok ? 'ok' : 'failed'}`);
          
          qrCode = extractQrCode(connectResult.data);
          
          if (qrCode) {
            await supabaseAdmin
              .from('whatsapp_instances')
              .update({
                qr_code: qrCode,
                status: 'connecting',
              })
              .eq('id', instance.id);
            steps.push('qr_saved: ok');
            break;
          }
          
          if (attempt < 3) {
            await new Promise(r => setTimeout(r, 500));
          }
        } catch (e) {
          steps.push(`connect_${attempt}: error`);
        }
      }

    } else {
      // SOFT REPAIR
      console.log('🟡 Iniciando SOFT repair...');
      
      await supabaseAdmin
        .from('whatsapp_instances')
        .update({ status: 'connecting' })
        .eq('id', instance.id);
      steps.push('status_set_connecting: ok');

      // SEMPRE reconfigurar webhook para garantir eventos corretos
      try {
        console.log('🔧 Reconfigurando webhook com todos os eventos...');
        const webhookSecret2 = (await getIntegrationValue('EVOLUTION_WEBHOOK_SECRET', supabaseAdmin)) || '';
        const webhookResult = await evolutionRequest(`/webhook/set/${instance.instance_name}`, {
          method: 'POST',
          body: JSON.stringify({
            webhook: {
              enabled: true,
              url: webhookUrl,
              webhookByEvents: false,
              webhookBase64: true,
              headers: webhookSecret2 ? { 'x-webhook-secret': webhookSecret2 } : undefined,
              events: [
                'QRCODE_UPDATED',
                'CONNECTION_UPDATE',
                'MESSAGES_UPSERT',
                'MESSAGES_UPDATE',
                'MESSAGES_SET',
                'MESSAGES_DELETE',
                'MESSAGE_ACK',
                'SEND_MESSAGE',
              ],
            },
          }),
        });
        steps.push(`webhook_reconfig: ${webhookResult.ok ? 'ok' : 'failed'}`);
        console.log('✅ Webhook reconfigurado:', webhookResult.ok ? 'sucesso' : 'falha');
      } catch (e) {
        console.error('❌ Erro ao reconfigurar webhook:', e);
        steps.push('webhook_reconfig: error');
      }

      // Tentar connect com até 3 tentativas
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`🔗 Connect tentativa ${attempt}...`);
          const connectResult = await evolutionRequest(`/instance/connect/${instance.instance_name}`);
          steps.push(`connect_${attempt}: ${connectResult.ok ? 'ok' : 'failed'}`);
          
          // Verificar se já conectou
          if (connectResult.data?.instance?.state === 'open') {
            await supabaseAdmin
              .from('whatsapp_instances')
              .update({
                status: 'connected',
                qr_code: null,
                last_connected_at: new Date().toISOString(),
              })
              .eq('id', instance.id);
            steps.push('already_connected: true');
            
            return new Response(
              JSON.stringify({
                success: true,
                data: {
                  mode,
                  steps,
                  status: 'connected',
                  qr_code: null,
                },
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          qrCode = extractQrCode(connectResult.data);
          
          if (qrCode) {
            await supabaseAdmin
              .from('whatsapp_instances')
              .update({
                qr_code: qrCode,
                status: 'connecting',
              })
              .eq('id', instance.id);
            steps.push('qr_saved: ok');
            break;
          }
          
          // Se não veio QR, esperar e tentar novamente
          if (attempt < 3) {
            console.log('⏳ QR não veio, aguardando 500ms...');
            await new Promise(r => setTimeout(r, 500));
          }
        } catch (e: any) {
          steps.push(`connect_${attempt}: error - ${e?.message}`);
        }
      }
      
      if (!qrCode) {
        steps.push('waiting_webhook: true');
      }
    }

    // Buscar estado atualizado
    const { data: updatedInstance } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('status, qr_code')
      .eq('id', instance.id)
      .single();

    console.log('✅ Repair completo:', steps);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          mode,
          steps,
          status: updatedInstance?.status || 'unknown',
          qr_code: updatedInstance?.qr_code || qrCode,
          hasQrCode: !!(updatedInstance?.qr_code || qrCode),
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Erro no repair:', error);
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