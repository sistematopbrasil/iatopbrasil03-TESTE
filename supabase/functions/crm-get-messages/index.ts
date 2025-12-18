import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const url = new URL(req.url);
    const conversationId = url.searchParams.get('conversationId');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    if (!conversationId) {
      throw new Error('ID da conversa é obrigatório');
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

    // Verificar se a conversa pertence ao usuário
    const { data: conversation, error: convError } = await supabase
      .from('crm_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', userData.id)
      .single();

    if (convError || !conversation) {
      throw new Error('Conversa não encontrada');
    }

    // Buscar mensagens
    const { data: messages, error: msgError } = await supabase
      .from('crm_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: true })
      .range(offset, offset + limit - 1);

    if (msgError) {
      throw new Error('Erro ao buscar mensagens');
    }

    // Marcar mensagens como lidas e zerar contador
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabaseAdmin
      .from('crm_conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          conversation,
          messages,
          pagination: {
            limit,
            offset,
            total: messages?.length || 0,
          },
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
