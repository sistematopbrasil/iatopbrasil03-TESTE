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

    console.log('🔍 Verificando conexão:', instance.instance_name);

    // Verificar estado real na Evolution API
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
    
    // Criar cliente admin para atualizar
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ✅ AUTO-CORREÇÃO: Sincronizar banco com estado real da Evolution
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
      console.log('🔄 Corrigindo: Evolution=connecting, DB=' + dbStatus + ' → connecting');
      await supabaseAdmin
        .from('whatsapp_instances')
        .update({
          status: 'connecting',
        })
        .eq('id', instance.id);
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
        success: true, // Retornar success para não quebrar frontend
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
