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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Ler modo de reparo
    let mode = 'soft'; // soft ou hard
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

    // Buscar dados do usuário
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

    // Buscar instância
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

    if (mode === 'hard') {
      // HARD REPAIR: restart + logout + connect
      console.log('🔴 Iniciando HARD repair...');

      // 1. Restart da instância
      try {
        const restartResult = await evolutionRequest(`/instance/restart/${instance.instance_name}`, {
          method: 'PUT',
        });
        steps.push(`restart: ${restartResult.ok ? 'ok' : 'failed'}`);
        console.log('🔄 Restart:', restartResult.ok);
      } catch (e) {
        steps.push('restart: error');
        console.error('❌ Restart error:', e);
      }

      // Aguardar restart processar
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 2. Logout forçado
      try {
        const logoutResult = await evolutionRequest(`/instance/logout/${instance.instance_name}`, {
          method: 'DELETE',
        });
        steps.push(`logout: ${logoutResult.ok ? 'ok' : 'failed'}`);
        console.log('🔓 Logout:', logoutResult.ok);
      } catch (e) {
        steps.push('logout: error');
        console.error('❌ Logout error:', e);
      }

      // Aguardar logout processar
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

      // 4. Conectar novamente para gerar QR
      try {
        const connectResult = await evolutionRequest(`/instance/connect/${instance.instance_name}`);
        steps.push(`connect: ${connectResult.ok ? 'ok' : 'failed'}`);
        console.log('🔗 Connect:', connectResult.ok);
        
        qrCode = connectResult.data?.qrcode?.base64 || connectResult.data?.base64 || null;
        
        if (qrCode) {
          await supabaseAdmin
            .from('whatsapp_instances')
            .update({
              qr_code: qrCode,
              status: 'connecting',
            })
            .eq('id', instance.id);
          steps.push('qr_saved: ok');
        }
      } catch (e) {
        steps.push('connect: error');
        console.error('❌ Connect error:', e);
      }

    } else {
      // SOFT REPAIR: apenas connect
      console.log('🟡 Iniciando SOFT repair...');

      try {
        const connectResult = await evolutionRequest(`/instance/connect/${instance.instance_name}`);
        steps.push(`connect: ${connectResult.ok ? 'ok' : 'failed'}`);
        
        if (connectResult.data?.instance?.state === 'open') {
          // Já está conectado!
          await supabaseAdmin
            .from('whatsapp_instances')
            .update({
              status: 'connected',
              qr_code: null,
              last_connected_at: new Date().toISOString(),
            })
            .eq('id', instance.id);
          steps.push('already_connected: true');
        } else {
          qrCode = connectResult.data?.qrcode?.base64 || connectResult.data?.base64 || null;
          
          if (qrCode) {
            await supabaseAdmin
              .from('whatsapp_instances')
              .update({
                qr_code: qrCode,
                status: 'connecting',
              })
              .eq('id', instance.id);
            steps.push('qr_saved: ok');
          } else {
            // Marcar como connecting e aguardar webhook
            await supabaseAdmin
              .from('whatsapp_instances')
              .update({ status: 'connecting' })
              .eq('id', instance.id);
            steps.push('waiting_webhook: true');
          }
        }
      } catch (e: any) {
        steps.push('connect: error - ' + e?.message);
        console.error('❌ Connect error:', e);
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
