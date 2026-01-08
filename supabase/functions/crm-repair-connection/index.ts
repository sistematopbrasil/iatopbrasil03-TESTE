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
  console.log('🔵 Evolution:', options.method || 'GET', endpoint);
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_KEY,
      ...options.headers,
    },
  });
  
  const data = await response.json();
  return { ok: response.ok, data };
}

// Extrai QR code de várias formas possíveis do response
function extractQrCode(data: any): string | null {
  // Ordem de prioridade:
  // 1. qrcode.base64 (formato antigo)
  // 2. base64 (direto)
  // 3. code (string para gerar QR no frontend)
  // 4. qrcode.code
  // 5. pairingCode
  
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

    const steps: string[] = [];
    let qrCode: string | null = null;
    
    // ✅ URL do webhook para garantir que está configurado corretamente
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/crm-webhook`;

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

      // ✅ 4. Forçar configuração do webhook
      try {
        console.log('🔧 Reconfigurando webhook...');
        const webhookResult = await evolutionRequest(`/webhook/set/${instance.instance_name}`, {
          method: 'POST',
          body: JSON.stringify({
            url: webhookUrl,
            webhook_by_events: false,
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

      // ✅ Verificar e reconfigurar webhook se necessário
      try {
        console.log('🔍 Verificando webhook...');
        const webhookCheck = await evolutionRequest(`/webhook/find/${instance.instance_name}`);
        
        const currentWebhook = webhookCheck.data?.url || webhookCheck.data?.webhook?.url;
        const isEnabled = webhookCheck.data?.enabled !== false && webhookCheck.data?.webhook?.enabled !== false;
        
        if (!isEnabled || currentWebhook !== webhookUrl) {
          console.log('⚠️ Webhook precisa ser reconfigurado:', { currentWebhook, expected: webhookUrl, isEnabled });
          const webhookResult = await evolutionRequest(`/webhook/set/${instance.instance_name}`, {
            method: 'POST',
            body: JSON.stringify({
              url: webhookUrl,
              webhook_by_events: false,
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
          }),
        });
          steps.push(`webhook_reconfig: ${webhookResult.ok ? 'ok' : 'failed'}`);
        } else {
          steps.push('webhook_check: ok');
        }
      } catch (e) {
        steps.push('webhook_check: error');
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
            console.log('⏳ QR não veio, aguardando 400ms...');
            await new Promise(r => setTimeout(r, 400));
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
