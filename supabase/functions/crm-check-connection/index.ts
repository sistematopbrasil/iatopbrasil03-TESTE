import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || '';
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '';

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
      return new Response(
        JSON.stringify({
          success: true,
          data: { status: 'no_instance', reallyConnected: false },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 Verificando conexão real para:', instance.instance_name);

    // Verificar estado real na Evolution API
    let realState = 'close';
    try {
      const url = `${EVOLUTION_API_URL}/instance/connectionState/${instance.instance_name}`;
      console.log('🔵 Chamando:', url);
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
      });
      
      const data = await response.json();
      console.log('🔵 Resposta Evolution API:', JSON.stringify(data));
      
      realState = data?.instance?.state || 'close';
    } catch (e: any) {
      console.error('❌ Erro ao verificar Evolution API:', e?.message);
    }

    const reallyConnected = realState === 'open';
    const dbStatus = instance.status;
    
    console.log(`📊 Estado: DB=${dbStatus}, Evolution=${realState}, reallyConnected=${reallyConnected}`);

    // Se o banco diz conectado mas a Evolution diz não, atualizar banco
    if (dbStatus === 'connected' && !reallyConnected) {
      console.log('⚠️ Divergência detectada! Atualizando banco para disconnected');
      
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      await supabaseAdmin
        .from('whatsapp_instances')
        .update({
          status: 'disconnected',
          qr_code: null,
        })
        .eq('id', instance.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          status: reallyConnected ? 'connected' : 'disconnected',
          reallyConnected,
          evolutionState: realState,
          dbStatus,
          instanceId: instance.id,
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
