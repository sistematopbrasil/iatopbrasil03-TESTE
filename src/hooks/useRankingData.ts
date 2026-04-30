import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useFunnel } from '@/contexts/FunnelContext';

export interface ConsultantRankingData {
  consultant_id: string;
  full_name: string;
  email: string;
  quiz_slug: string | null;
  profile_photo: string | null;
  is_active: boolean;
  crm_enabled: boolean;
  ai_enabled: boolean;
  ranking_visible: boolean;
  instagram_visible: boolean;
  allowed_funnels?: ('consultor' | 'associado')[];
  default_funnel?: 'consultor' | 'associado';
  total_leads: number;
  hot_leads: number;
  warm_leads: number;
  cold_leads: number;
  novos_consultores_count: number;
  novos_associados_count: number;
  lead_sources?: { quiz: number; capture: number; whatsapp: number; recruitment: number };
  total_points: number;
  ranking_position: number;
}

interface UseRankingDataOptions {
  periodStart?: string | null;
  periodEnd?: string | null;
  enabled?: boolean;
}

interface FunnelTotals {
  leads: number;
  hot: number;
  warm: number;
  cold: number;
  points: number;
  novosConsultores: number;
  novosAssociados: number;
  sources?: { quiz: number; capture: number; whatsapp: number; recruitment: number };
}

interface RankingResponse {
  success: boolean;
  data?: ConsultantRankingData[];
  // Quando funnel_type === 'all' (super admin) o backend pode retornar grouped
  grouped?: { consultor: ConsultantRankingData[]; associado: ConsultantRankingData[] };
  groupedTotals?: { consultor: FunnelTotals; associado: FunnelTotals };
  totals?: FunnelTotals;
  currentUserId?: string;
  currentUserRole?: string;
  error?: string;
}

/**
 * Hook centralizado para buscar ranking de consultores
 * Usa backend function com permissão elevada para ver todos os dados
 */
export function useRankingData(options: UseRankingDataOptions = {}) {
  // IMPORTANTE: NÃO usar new Date().toISOString() como default direto
  // pois muda a cada render e invalida a queryKey constantemente
  const { periodStart = null, periodEnd = null, enabled = true } = options;
  const queryClient = useQueryClient();
  const { activeFunnel } = useFunnel();

  // Query principal de ranking via backend
  const { data: response, isLoading, isFetching, error, refetch } = useQuery({
    // QueryKey estável: usar 'now' como string em vez de timestamp dinâmico
    queryKey: ['unified-ranking', periodStart ?? 'all', periodEnd ?? 'now', activeFunnel],
    queryFn: async (): Promise<RankingResponse> => {
      // Resolver periodEnd no momento da chamada, não no render
      const effectivePeriodEnd = periodEnd ?? new Date().toISOString();

      const { data, error } = await supabase.functions.invoke('ranking-get', {
        body: { periodStart, periodEnd: effectivePeriodEnd, funnel_type: activeFunnel },
      });

      if (error) {
        console.error('Ranking fetch error:', error);
        throw new Error('Erro ao buscar ranking');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao buscar ranking');
      }

      return data;
    },
    enabled,
    staleTime: 30 * 1000, // Cache por 30 segundos - dados de ranking não mudam rápido
    gcTime: 5 * 60 * 1000,
    retry: 2,
    placeholderData: (prev) => prev, // Mantém dados antigos enquanto refaz (sem flash de zero)
    refetchOnMount: false, // Usa cache se houver
  });

  // Real-time updates - invalidate query when leads change
  useEffect(() => {
    const channel = supabase
      .channel('ranking-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_submissions_new',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['unified-ranking'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Role do usuário atual (exposto separadamente para super admin)
  const currentUserRole = response?.currentUserRole || null;

  // Dados do usuário atual - funciona mesmo se não estiver no array (super admin)
  const currentUser = useMemo(() => {
    if (!response?.currentUserId) return null;
    
    // Tenta encontrar no array (funciona para consultores)
    const userData = response.data?.find(r => r.consultant_id === response.currentUserId);
    
    // Retorna dados básicos mesmo se não encontrou (super admin não está no array)
    return {
      id: response.currentUserId,
      full_name: userData?.full_name || 'Super Admin',
      organization_id: '',
      role: response.currentUserRole || 'super_admin',
    };
  }, [response]);

  // Métricas agregadas
  const totals = response?.totals || { leads: 0, hot: 0, warm: 0, cold: 0, points: 0, novosConsultores: 0, novosAssociados: 0 };

  // Pontos do usuário atual
  const myData = useMemo(() => {
    if (!response?.currentUserId || !response?.data) return null;
    return response.data.find(r => r.consultant_id === response.currentUserId) || null;
  }, [response]);

  return {
    ranking: response?.data || [],
    grouped: response?.grouped || null,
    groupedTotals: response?.groupedTotals || null,
    isLoading,
    error,
    currentUser,
    currentUserRole,
    totals,
    myData,
    refetch,
  };
}
