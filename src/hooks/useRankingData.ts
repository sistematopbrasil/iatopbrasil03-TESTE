import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentConsultant } from '@/lib/consultant-context';
import { LEAD_TEMPERATURE_POINTS, NOVOS_CONSULTORES_BONUS } from '@/lib/ranking-service';

export interface ConsultantRankingData {
  consultant_id: string;
  full_name: string;
  email: string;
  quiz_slug: string | null;
  profile_photo: string | null;
  is_active: boolean;
  total_leads: number;
  hot_leads: number;
  warm_leads: number;
  cold_leads: number;
  novos_consultores_count: number;
  total_points: number;
  ranking_position: number;
}

interface UseRankingDataOptions {
  periodStart?: string | null;
  periodEnd?: string | null;
  enabled?: boolean;
}

/**
 * Hook centralizado para buscar ranking de consultores
 * Uma única fonte de verdade para pontuação
 */
export function useRankingData(options: UseRankingDataOptions = {}) {
  const { periodStart = null, periodEnd = new Date().toISOString(), enabled = true } = options;
  const queryClient = useQueryClient();

  // Buscar usuário atual com tratamento de erro
  const { data: currentUser, isLoading: isLoadingUser, error: userError } = useQuery({
    queryKey: ['current-user-ranking'],
    queryFn: getCurrentConsultant,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  const organizationId = currentUser?.organization_id;

  // Query principal de ranking - só executa se tiver organizationId
  const { data: rankingData, isLoading: isLoadingRanking, error } = useQuery({
    queryKey: ['unified-ranking', organizationId, periodStart, periodEnd],
    queryFn: async () => {
      if (!organizationId) return [];

      // 1. Buscar todos consultores ativos da organização
      const { data: consultants, error: consultantsError } = await supabase
        .from('users')
        .select('id, full_name, email, quiz_slug, profile_photo, is_active')
        .eq('organization_id', organizationId)
        .in('role', ['admin', 'consultor'])
        .eq('is_active', true);

      if (consultantsError) throw consultantsError;
      if (!consultants?.length) return [];

      // 2. Buscar stage "Novos Consultores"
      const { data: novosStageId } = await supabase.rpc('get_novos_consultores_stage_id', {
        org_id: organizationId
      });

      // 3. Buscar TODOS os leads da organização (com filtro de período se aplicável)
      let leadsQuery = supabase
        .from('quiz_submissions_new')
        .select('id, consultant_id, temperature, pipeline_stage_id, created_at')
        .eq('organization_id', organizationId)
        .eq('completion_percentage', 100);

      if (periodStart) {
        leadsQuery = leadsQuery.gte('created_at', periodStart);
      }
      if (periodEnd) {
        leadsQuery = leadsQuery.lte('created_at', periodEnd);
      }

      const { data: leads, error: leadsError } = await leadsQuery;
      if (leadsError) throw leadsError;

      // 4. Agregar métricas por consultor
      const metricsMap = new Map<string, {
        total: number;
        hot: number;
        warm: number;
        cold: number;
        novosConsultores: number;
      }>();

      // Inicializar todos consultores
      consultants.forEach(c => {
        metricsMap.set(c.id, { total: 0, hot: 0, warm: 0, cold: 0, novosConsultores: 0 });
      });

      // Processar leads
      leads?.forEach(lead => {
        if (!lead.consultant_id) return;
        
        const metrics = metricsMap.get(lead.consultant_id);
        if (!metrics) return;

        metrics.total++;

        const isNovosConsultores = novosStageId && lead.pipeline_stage_id === novosStageId;

        if (isNovosConsultores) {
          metrics.novosConsultores++;
        } else {
          // Contagem por temperatura (excluindo leads em Novos Consultores para evitar dupla contagem)
          if (lead.temperature === 'hot') metrics.hot++;
          else if (lead.temperature === 'warm') metrics.warm++;
          else metrics.cold++;
        }
      });

      // 5. Calcular pontuação e criar ranking final
      const rankingList: ConsultantRankingData[] = consultants.map(consultant => {
        const m = metricsMap.get(consultant.id) || { total: 0, hot: 0, warm: 0, cold: 0, novosConsultores: 0 };

        // Fórmula de pontos:
        // - Leads por temperatura (excluindo os em Novos Consultores)
        // - Bônus por cada lead em "Novos Consultores"
        const temperaturePoints = 
          (m.hot * LEAD_TEMPERATURE_POINTS.hot) +
          (m.warm * LEAD_TEMPERATURE_POINTS.warm) +
          (m.cold * LEAD_TEMPERATURE_POINTS.cold);

        const novosConsultoresPoints = m.novosConsultores * NOVOS_CONSULTORES_BONUS;
        const totalPoints = temperaturePoints + novosConsultoresPoints;

        return {
          consultant_id: consultant.id,
          full_name: consultant.full_name,
          email: consultant.email,
          quiz_slug: consultant.quiz_slug,
          profile_photo: consultant.profile_photo,
          is_active: consultant.is_active,
          total_leads: m.total,
          hot_leads: m.hot,
          warm_leads: m.warm,
          cold_leads: m.cold,
          novos_consultores_count: m.novosConsultores,
          total_points: totalPoints,
          ranking_position: 0, // Será preenchido depois do sort
        };
      });

      // 6. Ordenar por pontos e atribuir posições
      rankingList.sort((a, b) => b.total_points - a.total_points);
      rankingList.forEach((entry, index) => {
        entry.ranking_position = index + 1;
      });

      return rankingList;
    },
    enabled: enabled && !!organizationId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });

  // Loading real: apenas quando está carregando ativamente
  // Se houve erro no usuário, não ficar em loading infinito
  const isLoading = isLoadingUser || (!!organizationId && isLoadingRanking);

  // Real-time updates
  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel('ranking-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_submissions_new',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          // Invalidar queries de ranking quando leads mudam
          queryClient.invalidateQueries({ queryKey: ['unified-ranking'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, queryClient]);

  // Métricas agregadas
  const totals = useMemo(() => {
    if (!rankingData?.length) return { leads: 0, hot: 0, warm: 0, cold: 0, points: 0, novosConsultores: 0 };
    
    return rankingData.reduce((acc, c) => ({
      leads: acc.leads + c.total_leads,
      hot: acc.hot + c.hot_leads,
      warm: acc.warm + c.warm_leads,
      cold: acc.cold + c.cold_leads,
      points: acc.points + c.total_points,
      novosConsultores: acc.novosConsultores + c.novos_consultores_count,
    }), { leads: 0, hot: 0, warm: 0, cold: 0, points: 0, novosConsultores: 0 });
  }, [rankingData]);

  // Pontos do usuário atual
  const myData = useMemo(() => {
    return rankingData?.find(r => r.consultant_id === currentUser?.id) || null;
  }, [rankingData, currentUser?.id]);

  return {
    ranking: rankingData || [],
    isLoading,
    error: error || userError,
    currentUser,
    totals,
    myData,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['unified-ranking'] }),
  };
}
