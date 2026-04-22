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


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
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
        JSON.stringify({
          success: true,
          data: { status: 'no_instance', reallyConnected: false },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 Verificando conexão:', instance.instance_name);

    let realState = 'close';
    let evolutionError = null;
    
    try {
      const url = `${EVOLUTION_API_URL}/instance/connectionState/${instance.instance_name}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
      });
      const data = await response.json();
      realState = data?.instance?.state || 'close';
      console.log('📊 Evolution state:', realState);
    } catch (e: any) {
      evolutionError = e?.message;
      console.error('❌ Erro Evolution API:', evolutionError);
    }

    const reallyConnected = realState === 'open';
    const dbStatus = instance.status;
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ✅ AUTO-CORREÇÃO: Sincronizar banco com estado real
    if (reallyConnected && dbStatus !== 'connected') {
      console.log('🔄 Corrigindo: Evolution=open, DB=' + dbStatus + ' → connected');
      await supabaseAdmin
        .from('whatsapp_instances')
        .update({
          status: 'connected',
          qr_code: null,
          last_connected_at: new Date().toISOString(),
        })
        .eq('id', instance.id);
    } else if (!reallyConnected && dbStatus === 'connected') {
      console.log('🔄 Corrigindo: Evolution=' + realState + ', DB=connected → disconnected');
      await supabaseAdmin
        .from('whatsapp_instances')
        .update({
          status: 'disconnected',
          qr_code: null,
        })
        .eq('id', instance.id);
    } else if (realState === 'connecting' && dbStatus !== 'connecting') {
      await supabaseAdmin
        .from('whatsapp_instances')
        .update({ status: 'connecting' })
        .eq('id', instance.id);
    }

    // ✅ VERIFICAR WEBHOOK — só reconfigurar se eventos faltando ou secret header ausente
    if (reallyConnected) {
      try {
        const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/crm-webhook`;
        const webhookSecret = Deno.env.get('EVOLUTION_WEBHOOK_SECRET') || '';
        
        const webhookCheckResponse = await fetch(`${EVOLUTION_API_URL}/webhook/find/${instance.instance_name}`, {
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY,
          },
        });
        const currentWebhook = await webhookCheckResponse.json();
        console.log('📋 Webhook atual:', JSON.stringify(currentWebhook).substring(0, 500));
        
        const requiredEvents = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED', 'SEND_MESSAGE'];
        const configuredEvents = currentWebhook?.webhook?.events || currentWebhook?.events || [];
        const missingEvents = requiredEvents.filter(e => !configuredEvents.includes(e));
        
        const currentHeaders = currentWebhook?.webhook?.headers || currentWebhook?.headers || {};
        const hasSecretHeader = !!currentHeaders['x-webhook-secret'];
        const webhookSecretConfigured = !!webhookSecret;
        
        // ✅ FIX: Only reconfigure if events are missing or secret header is needed
        // Do NOT fight webhookByEvents — true is correct (sub-paths work in Edge Functions)
        const needsReconfigure = missingEvents.length > 0 || (webhookSecretConfigured && !hasSecretHeader);
        
        if (needsReconfigure) {
          console.log('🔧 Reconfigurando webhook (eventos faltando ou secret)...', { missingEvents });
          
          const setResponse = await fetch(`${EVOLUTION_API_URL}/webhook/set/${instance.instance_name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
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
                  'SEND_MESSAGE',
                  'MESSAGE_ACK',
                ],
              },
            }),
          });
          const setResult = await setResponse.text();
          console.log('📝 Set webhook response:', setResponse.status, setResult.substring(0, 300));
          
          // If webhook set failed, don't retry on next health check (will be fixed by repair-connection)
          if (setResponse.status >= 400) {
            console.log('⚠️ Webhook set falhou, não tentar novamente no health check');
          }
        } else {
          console.log('✅ Webhook OK, nenhuma reconfiguração necessária');
        }
      } catch (e: any) {
        console.warn('⚠️ Erro ao verificar/reconfigurar webhook:', e?.message);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          status: reallyConnected ? 'connected' : (realState === 'connecting' ? 'connecting' : 'disconnected'),
          reallyConnected,
          evolutionState: realState,
          dbStatus,
          instanceId: instance.id,
          evolutionError,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          status: 'unknown',
          reallyConnected: false,
          error: error?.message,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
