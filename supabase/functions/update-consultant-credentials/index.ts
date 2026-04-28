import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: claimsErr } = await supabaseAuth.auth.getClaims(
      authHeader.replace('Bearer ', '')
    );
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar caller é super_admin
    const { data: caller } = await supabaseAdmin
      .from('users')
      .select('id, role, organization_id')
      .eq('auth_user_id', claims.claims.sub)
      .single();

    if (!caller || caller.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Acesso negado: requer super admin' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { consultant_id, new_email, new_password } = body || {};

    if (!consultant_id) {
      return new Response(JSON.stringify({ error: 'consultant_id obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const wantsEmail = typeof new_email === 'string' && new_email.trim() !== '';
    const wantsPassword = typeof new_password === 'string' && new_password.trim() !== '';

    if (!wantsEmail && !wantsPassword) {
      return new Response(JSON.stringify({ error: 'Informe novo email ou nova senha' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (wantsEmail) {
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(new_email.trim());
      if (!emailOk) {
        return new Response(JSON.stringify({ error: 'Email inválido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    if (wantsPassword && new_password.length < 8) {
      return new Response(JSON.stringify({ error: 'Senha deve ter no mínimo 8 caracteres' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar o consultor — deve estar na MESMA organização
    const { data: target, error: targetErr } = await supabaseAdmin
      .from('users')
      .select('id, auth_user_id, email, organization_id')
      .eq('id', consultant_id)
      .single();

    if (targetErr || !target) {
      return new Response(JSON.stringify({ error: 'Consultor não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (target.organization_id !== caller.organization_id) {
      return new Response(JSON.stringify({ error: 'Consultor de outra organização' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!target.auth_user_id) {
      return new Response(JSON.stringify({ error: 'Consultor sem usuário de autenticação' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Atualizar Auth
    const updatePayload: { email?: string; password?: string; email_confirm?: boolean } = {};
    if (wantsEmail) {
      updatePayload.email = new_email.trim();
      updatePayload.email_confirm = true;
    }
    if (wantsPassword) updatePayload.password = new_password;

    const { error: authUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(
      target.auth_user_id,
      updatePayload
    );

    if (authUpdateErr) {
      console.error('Auth update error:', authUpdateErr);
      const msg = authUpdateErr.message?.includes('already')
        ? 'Este email já está em uso por outro usuário'
        : 'Erro ao atualizar credenciais';
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sincronizar tabela users quando email mudar
    if (wantsEmail) {
      await supabaseAdmin
        .from('users')
        .update({ email: new_email.trim() })
        .eq('id', consultant_id);
    }

    // Auditoria (não bloqueante)
    try {
      await supabaseAdmin.rpc('create_audit_log', {
        p_user_id: caller.id,
        p_organization_id: caller.organization_id,
        p_action: 'consultant.credentials.updated',
        p_resource_type: 'user',
        p_resource_id: consultant_id,
        p_metadata: {
          email_changed: wantsEmail,
          password_changed: wantsPassword,
        },
      });
    } catch (e) {
      console.warn('Audit failed:', e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        email_changed: wantsEmail,
        password_changed: wantsPassword,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
