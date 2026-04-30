import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Points configuration (must match frontend ranking-service.ts)
const LEAD_TEMPERATURE_POINTS = {
  hot: 30,
  warm: 15,
  cold: 5,
};
const NOVOS_CONSULTORES_BONUS = 100; // Lead em "Novos Consultores" = 100 pts fixo

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🏆 Ranking Get - Starting...');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autorizado');
    }

    // Parse request body for period filters and optional funnel_type
    // funnel_type: 'consultor' | 'associado' | 'all' | undefined
    //   - undefined: comportamento legado (soma de todos os funis) — RETROCOMPAT
    //   - 'consultor' / 'associado': filtra leads por funil
    //   - 'all': retorna { consultor: [...], associado: [...] } separadamente (super_admin)
    let periodStart: string | null = null;
    let periodEnd: string | null = null;
    let funnelFilter: 'consultor' | 'associado' | 'all' | null = null;
    try {
      const body = await req.json();
      periodStart = body.periodStart || null;
      periodEnd = body.periodEnd || new Date().toISOString();
      if (body.funnel_type === 'consultor' || body.funnel_type === 'associado' || body.funnel_type === 'all') {
        funnelFilter = body.funnel_type;
      }
    } catch {
      periodEnd = new Date().toISOString();
    }

    // Create user-scoped client to get their organization
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('❌ Auth error:', userError);
      throw new Error('Usuário não autenticado');
    }

    // Get user's organization and role
    const { data: userData, error: userDataError } = await supabaseUser
      .from('users')
      .select('id, organization_id, role')
      .eq('auth_user_id', user.id)
      .single();

    if (userDataError || !userData) {
      console.error('❌ User data error:', userDataError);
      throw new Error('Dados do usuário não encontrados');
    }

    const organizationId = userData.organization_id;
    const currentUserId = userData.id;
    const currentUserRole = userData.role;
    console.log('🔵 User:', currentUserId, 'Org:', organizationId, 'Role:', currentUserRole);

    // Use service role for elevated access to read all leads
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Se periodStart não veio, usa o início da competição corrente da organização
    // (assim "Resetar ranking" zera o placar visível sem perder os leads)
    if (!periodStart) {
      const { data: compStart } = await supabaseAdmin.rpc('get_current_competition_start', {
        p_org_id: organizationId,
      });
      if (compStart) {
        periodStart = compStart as string;
        console.log('🏁 Usando início da competição corrente:', periodStart);
      }
    }

    // 1. Fetch all consultants in the organization (including email for display)
    // Filter by allowed_funnels when funnelFilter is single
    let consultantsQuery = supabaseAdmin
      .from('users')
      .select('id, full_name, email, quiz_slug, profile_photo, is_active, crm_enabled, ai_enabled, ranking_visible, instagram_visible, allowed_funnels, default_funnel')
      .eq('organization_id', organizationId)
      .in('role', ['admin', 'consultor']);

    if (funnelFilter === 'consultor' || funnelFilter === 'associado') {
      // Postgres array contains: only consultores que têm o funil ativo nos seus allowed_funnels
      consultantsQuery = consultantsQuery.contains('allowed_funnels', [funnelFilter]);
    }

    const { data: consultants, error: consultantsError } = await consultantsQuery;

    if (consultantsError) {
      console.error('❌ Consultants error:', consultantsError);
      throw consultantsError;
    }

    if (!consultants?.length) {
      console.log('📭 No consultants found');
      return new Response(
        JSON.stringify({ success: true, data: [], totals: { leads: 0, hot: 0, warm: 0, cold: 0, points: 0, novosConsultores: 0 } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Get conversion stage IDs for BOTH funnels
    // Consultor → stage "Consultor" / Associado → stage "Novos Associados"
    const [{ data: consultorStageId }, { data: associadoStageId }] = await Promise.all([
      supabaseAdmin.rpc('get_conversion_stage_id_by_funnel', { org_id: organizationId, p_funnel: 'consultor' }),
      supabaseAdmin.rpc('get_conversion_stage_id_by_funnel', { org_id: organizationId, p_funnel: 'associado' }),
    ]);
    // Backward-compat: stage usado para "novosConsultores" no modo legado/consultor
    const novosStageId = consultorStageId;

    // 3. Fetch leads with optional funnel filter
    // IMPORTANTE: Não filtrar por completion_percentage para incluir leads frios
    let leadsQuery = supabaseAdmin
      .from('quiz_submissions_new')
      .select('id, consultant_id, temperature, pipeline_stage_id, created_at, funnel_type, lead_source')
      .eq('organization_id', organizationId)
      .not('consultant_id', 'is', null); // ✅ excluir órfãos sempre

    if (periodStart) {
      leadsQuery = leadsQuery.gte('created_at', periodStart);
    }
    if (periodEnd) {
      leadsQuery = leadsQuery.lte('created_at', periodEnd);
    }

    // ✅ Aplicar filtro de funil quando informado (modo single)
    if (funnelFilter === 'consultor' || funnelFilter === 'associado') {
      leadsQuery = leadsQuery.eq('funnel_type', funnelFilter);
    }

    const { data: leads, error: leadsError } = await leadsQuery;
    if (leadsError) {
      console.error('❌ Leads error:', leadsError);
      throw leadsError;
    }

    console.log('📊 Found', consultants.length, 'consultants and', leads?.length || 0, 'leads (funnelFilter:', funnelFilter, ')');

    // ✅ Helper: aggregate ranking from a leads array
    function buildRanking(leadsArr: any[]) {
      const metricsMap = new Map<string, {
        total: number; hot: number; warm: number; cold: number;
        novosConsultores: number; novosAssociados: number;
        sources: { quiz: number; capture: number; whatsapp: number; recruitment: number };
      }>();

      consultants!.forEach(c => {
        metricsMap.set(c.id, {
          total: 0, hot: 0, warm: 0, cold: 0,
          novosConsultores: 0, novosAssociados: 0,
          sources: { quiz: 0, capture: 0, whatsapp: 0, recruitment: 0 },
        });
      });

      const globalMetrics = {
        total: 0, hot: 0, warm: 0, cold: 0,
        novosConsultores: 0, novosAssociados: 0,
        sources: { quiz: 0, capture: 0, whatsapp: 0, recruitment: 0 },
      };

      leadsArr.forEach(lead => {
        if (!lead.consultant_id) return;

        const leadFunnel = lead.funnel_type ?? 'consultor';
        const conversionStageId = leadFunnel === 'associado' ? associadoStageId : consultorStageId;
        const isConvertido = conversionStageId && lead.pipeline_stage_id === conversionStageId;
        const src = (lead.lead_source ?? 'quiz') as 'quiz' | 'capture' | 'whatsapp' | 'recruitment';

        // 1) Globais
        globalMetrics.total++;
        if (globalMetrics.sources[src] !== undefined) globalMetrics.sources[src]++;
        if (isConvertido) {
          if (leadFunnel === 'associado') globalMetrics.novosAssociados++;
          else globalMetrics.novosConsultores++;
        } else {
          if (lead.temperature === 'hot') globalMetrics.hot++;
          else if (lead.temperature === 'warm') globalMetrics.warm++;
          else globalMetrics.cold++;
        }

        // 2) Por consultor
        const metrics = metricsMap.get(lead.consultant_id);
        if (!metrics) return;
        metrics.total++;
        if (metrics.sources[src] !== undefined) metrics.sources[src]++;
        if (isConvertido) {
          if (leadFunnel === 'associado') metrics.novosAssociados++;
          else metrics.novosConsultores++;
        } else {
          if (lead.temperature === 'hot') metrics.hot++;
          else if (lead.temperature === 'warm') metrics.warm++;
          else metrics.cold++;
        }
      });

      const list = consultants!.map(consultant => {
        const m = metricsMap.get(consultant.id) || {
          total: 0, hot: 0, warm: 0, cold: 0,
          novosConsultores: 0, novosAssociados: 0,
          sources: { quiz: 0, capture: 0, whatsapp: 0, recruitment: 0 },
        };
        const temperaturePoints =
          (m.hot * LEAD_TEMPERATURE_POINTS.hot) +
          (m.warm * LEAD_TEMPERATURE_POINTS.warm) +
          (m.cold * LEAD_TEMPERATURE_POINTS.cold);
        const novosPoints = (m.novosConsultores + m.novosAssociados) * NOVOS_CONSULTORES_BONUS;
        const totalPoints = temperaturePoints + novosPoints;
        return {
          consultant_id: consultant.id,
          full_name: consultant.full_name,
          email: consultant.email,
          quiz_slug: consultant.quiz_slug,
          profile_photo: consultant.profile_photo,
          is_active: consultant.is_active,
          crm_enabled: consultant.crm_enabled ?? false,
          ai_enabled: consultant.ai_enabled ?? false,
          ranking_visible: consultant.ranking_visible ?? true,
          instagram_visible: (consultant as any).instagram_visible ?? true,
          allowed_funnels: (consultant as any).allowed_funnels ?? ['consultor'],
          default_funnel: (consultant as any).default_funnel ?? 'consultor',
          total_leads: m.total,
          hot_leads: m.hot,
          warm_leads: m.warm,
          cold_leads: m.cold,
          novos_consultores_count: m.novosConsultores,
          novos_associados_count: m.novosAssociados,
          lead_sources: m.sources,
          total_points: totalPoints,
          ranking_position: 0,
        };
      });

      list.sort((a, b) => b.total_points - a.total_points);
      list.forEach((entry, index) => { entry.ranking_position = index + 1; });

      const totals = {
        leads: globalMetrics.total,
        hot: globalMetrics.hot,
        warm: globalMetrics.warm,
        cold: globalMetrics.cold,
        novosConsultores: globalMetrics.novosConsultores,
        novosAssociados: globalMetrics.novosAssociados,
        sources: globalMetrics.sources,
        points: list.reduce((s, c) => s + c.total_points, 0),
      };

      return { list, totals };
    }

    // ✅ Modo "all" — retorna funis separados (super_admin)
    if (funnelFilter === 'all') {
      const consultorLeads = (leads || []).filter(l => (l.funnel_type ?? 'consultor') === 'consultor');
      const associadoLeads = (leads || []).filter(l => l.funnel_type === 'associado');
      const consultorRanking = buildRanking(consultorLeads);
      const associadoRanking = buildRanking(associadoLeads);

      // Combined view (também retornamos um data único agregado para tabelas/gráficos legados)
      const combined = buildRanking(leads || []);

      console.log('✅ Ranking by funnel:', consultorRanking.list.length, 'consultor /', associadoRanking.list.length, 'associado');

      return new Response(
        JSON.stringify({
          success: true,
          mode: 'all',
          // ➜ formato novo (UI por funil)
          grouped: {
            consultor: consultorRanking.list,
            associado: associadoRanking.list,
          },
          groupedTotals: {
            consultor: consultorRanking.totals,
            associado: associadoRanking.totals,
          },
          // ➜ retrocompat — manter campos antigos consultor/associado
          consultor: { data: consultorRanking.list, totals: consultorRanking.totals },
          associado: { data: associadoRanking.list, totals: associadoRanking.totals },
          // ➜ visão combinada (necessária para tabela única e métricas agregadas)
          data: combined.list,
          totals: combined.totals,
          currentUserId,
          currentUserRole,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ Modo padrão (sem filtro OU com filtro single) — formato legado preservado
    const { list: rankingList, totals } = buildRanking(leads || []);

    console.log('✅ Ranking calculated:', rankingList.length, 'entries');

    return new Response(
      JSON.stringify({
        success: true,
        data: rankingList,
        totals,
        currentUserId,
        currentUserRole,
        funnel_type: funnelFilter, // null se não filtrou (legado)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Ranking error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Erro ao buscar ranking',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
