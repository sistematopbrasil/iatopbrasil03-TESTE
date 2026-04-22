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

async function evolutionRequest(endpoint: string, options: RequestInit = {}, timeoutMs = 12000) {
  const url = `${EVOLUTION_API_URL}${endpoint}`;
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
    let data: any = null;
    try { data = await response.json(); } catch { /* ignore */ }
    return { ok: response.ok, status: response.status, data };
  } catch (error: any) {
    clearTimeout(timeoutId);
    return { ok: false, status: 0, data: null, error: error?.message };
  }
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
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Apenas super_admin pode executar
    const { data: callerRow } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single();

    if (!callerRow || callerRow.role !== 'super_admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'Apenas super admin pode executar este reparo.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    await loadEvolutionCreds(supabaseAdmin);

    let body: any = {};
    try { body = await req.json(); } catch { /* ignore */ }
    const onlyConnected = body?.only_connected !== false; // default true

    const webhookSecret = (await getIntegrationValue('EVOLUTION_WEBHOOK_SECRET', supabaseAdmin)) || '';
    const webhookBase = `${Deno.env.get('SUPABASE_URL')}/functions/v1/crm-webhook`;
    const webhookUrl = webhookSecret
      ? `${webhookBase}?secret=${encodeURIComponent(webhookSecret)}`
      : webhookBase;

    let query = supabaseAdmin
      .from('whatsapp_instances')
      .select('id, instance_name, status, user_id');

    if (onlyConnected) {
      query = query.in('status', ['connected', 'connecting']);
    }

    const { data: instances, error: listError } = await query;
    if (listError) {
      return new Response(
        JSON.stringify({ success: false, error: listError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Array<{
      instance_name: string;
      status: string;
      ok: boolean;
      http_status: number;
      detail?: string;
    }> = [];

    for (const inst of instances || []) {
      const r = await evolutionRequest(`/webhook/set/${inst.instance_name}`, {
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

      results.push({
        instance_name: inst.instance_name,
        status: inst.status || 'unknown',
        ok: r.ok,
        http_status: r.status,
        detail: r.ok ? undefined : (typeof r.data === 'object' ? JSON.stringify(r.data) : String(r.data || '')).slice(0, 200),
      });
    }

    const okCount = results.filter(r => r.ok).length;
    const failCount = results.length - okCount;

    console.log(`✅ Rebind webhooks finalizado: ${okCount} ok, ${failCount} falhas (de ${results.length})`);

    return new Response(
      JSON.stringify({
        success: true,
        total: results.length,
        ok: okCount,
        failed: failCount,
        webhook_url: webhookUrl.replace(/secret=[^&]+/, 'secret=***'),
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Erro no rebind:', error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
