import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createWhatsAppInstanceForFunnel } from '../_shared/create-whatsapp-instance.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type FunnelType = 'consultor' | 'associado';
const VALID_FUNNELS: FunnelType[] = ['consultor', 'associado'];

function validateBody(body: any): { ok: true; data: { user_id: string; allowed_funnels: FunnelType[]; default_funnel: FunnelType } } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body inválido' };
  const { user_id, allowed_funnels, default_funnel } = body;

  if (typeof user_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(user_id)) {
    return { ok: false, error: 'user_id inválido' };
  }
  if (!Array.isArray(allowed_funnels) || allowed_funnels.length === 0 || allowed_funnels.length > 2) {
    return { ok: false, error: 'allowed_funnels deve ter 1 ou 2 valores' };
  }
  const uniq = Array.from(new Set(allowed_funnels));
  if (!uniq.every((f: any) => VALID_FUNNELS.includes(f))) {
    return { ok: false, error: 'allowed_funnels contém valor inválido' };
  }
  if (!VALID_FUNNELS.includes(default_funnel)) {
    return { ok: false, error: 'default_funnel inválido' };
  }
  if (!uniq.includes(default_funnel)) {
    return { ok: false, error: 'default_funnel deve estar em allowed_funnels' };
  }
  return { ok: true, data: { user_id, allowed_funnels: uniq as FunnelType[], default_funnel } };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar role do caller
    const { data: caller } = await supabaseAuth
      .from('users')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (caller?.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Acesso negado' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => null);
    const validation = validateBody(body);
    if (!validation.ok) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { user_id, allowed_funnels, default_funnel } = validation.data;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar estado atual para calcular o que ficará "invisível" e funis adicionados
    const { data: currentUser } = await supabaseAdmin
      .from('users')
      .select('allowed_funnels, default_funnel, full_name, username, organization_id')
      .eq('id', user_id)
      .single();

    if (!currentUser) {
      return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Funis removidos (estavam antes e não estão mais)
    const removedFunnels = (currentUser.allowed_funnels || []).filter(
      (f: FunnelType) => !allowed_funnels.includes(f)
    );

    // Contagem do que ficará invisível
    const impact: Record<string, { leads: number; conversations: number }> = {};
    for (const funnel of removedFunnels) {
      const { count: leadsCount } = await supabaseAdmin
        .from('quiz_submissions_new')
        .select('id', { count: 'exact', head: true })
        .eq('consultant_id', user_id)
        .eq('funnel_type', funnel);

      // conversations não tem funnel_type direto; contamos via instance
      const { data: instances } = await supabaseAdmin
        .from('whatsapp_instances')
        .select('id')
        .eq('user_id', user_id)
        .eq('funnel_type', funnel);

      let convCount = 0;
      if (instances?.length) {
        const { count } = await supabaseAdmin
          .from('crm_conversations')
          .select('id', { count: 'exact', head: true })
          .in('instance_id', instances.map((i: any) => i.id));
        convCount = count || 0;
      }

      impact[funnel] = { leads: leadsCount || 0, conversations: convCount };
    }

    // Atualizar
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        allowed_funnels,
        default_funnel,
      })
      .eq('id', user_id);

    if (updateError) {
      console.error('❌ Erro ao atualizar acesso:', updateError);
      return new Response(JSON.stringify({ error: 'Erro ao atualizar acesso' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        allowed_funnels,
        default_funnel,
        removed_funnels: removedFunnels,
        impact,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('❌ Erro:', err);
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
