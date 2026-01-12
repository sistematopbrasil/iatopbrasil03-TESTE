import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

interface RankingResponse {
  success: boolean;
  data?: ConsultantRankingData[];
  totals?: {
    leads: number;
    hot: number;
    warm: number;
    cold: number;
    points: number;
    novosConsultores: number;
  };
  currentUserId?: string;
  currentUserRole?: string;
  error?: string;
}

/**
 * Hook centralizado para buscar ranking de consultores
 * Usa backend function com permissão elevada para ver todos os dados
 */
export function useRankingData(options: UseRankingDataOptions = {}) {
  const { periodStart = null, periodEnd = new Date().toISOString(), enabled = true } = options;
  const queryClient = useQueryClient();

  // Query principal de ranking via backend
  const { data: response, isLoading, error, refetch } = useQuery({
    queryKey: ['unified-ranking', periodStart, periodEnd],
    queryFn: async (): Promise<RankingResponse> => {
      const { data, error } = await supabase.functions.invoke('ranking-get', {
        body: { periodStart, periodEnd },
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
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
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
  const totals = response?.totals || { leads: 0, hot: 0, warm: 0, cold: 0, points: 0, novosConsultores: 0 };

  // Pontos do usuário atual
  const myData = useMemo(() => {
    if (!response?.currentUserId || !response?.data) return null;
    return response.data.find(r => r.consultant_id === response.currentUserId) || null;
  }, [response]);

  return {
    ranking: response?.data || [],
    isLoading,
    error,
    currentUser,
    currentUserRole,
    totals,
    myData,
    refetch,
  };
}
