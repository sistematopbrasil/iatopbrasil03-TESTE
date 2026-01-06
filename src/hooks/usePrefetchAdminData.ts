import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentConsultant, isSuperAdmin } from '@/lib/consultant-context';

/**
 * Hook para pré-carregar dados das páginas de admin em background
 * Isso garante que Settings, Ranking e Analytics abram instantaneamente
 */
export function usePrefetchAdminData() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const prefetchData = async () => {
      try {
        const currentUser = await getCurrentConsultant();
        if (!currentUser) return;

        const isSuperAdminUser = isSuperAdmin(currentUser.role);

        // Prefetch dados do ranking
        queryClient.prefetchQuery({
          queryKey: ['ranking'],
          queryFn: async (): Promise<unknown> => {
            const { data } = await supabase.functions.invoke('ranking-get');
            return data;
          },
          staleTime: 5 * 60 * 1000,
        });

        // Prefetch quiz questions (usado em Settings)
        queryClient.prefetchQuery({
          queryKey: ['quiz-questions', currentUser.id],
          queryFn: async (): Promise<unknown[]> => {
            const { data } = await supabase
              .from('quiz_questions')
              .select('*')
              .eq('user_id', currentUser.id)
              .order('order_index', { ascending: true });
            return data || [];
          },
          staleTime: 5 * 60 * 1000,
        });

        // Prefetch pipeline stages
        queryClient.prefetchQuery({
          queryKey: ['pipeline-stages'],
          queryFn: async (): Promise<unknown[]> => {
            const { data } = await supabase
              .from('pipeline_stages')
              .select('*')
              .order('order_index', { ascending: true });
            return data || [];
          },
          staleTime: 5 * 60 * 1000,
        });

        // Prefetch app settings
        queryClient.prefetchQuery({
          queryKey: ['app-settings', currentUser.id],
          queryFn: async (): Promise<unknown> => {
            const { data } = await supabase
              .from('app_settings')
              .select('*')
              .eq('user_id', currentUser.id)
              .maybeSingle();
            return data;
          },
          staleTime: 5 * 60 * 1000,
        });

        // Prefetch para super admin
        if (isSuperAdminUser && currentUser.organization_id) {
          queryClient.prefetchQuery({
            queryKey: ['consultants', currentUser.organization_id],
            queryFn: async (): Promise<unknown[]> => {
              const { data } = await supabase
                .from('users')
                .select('*')
                .eq('organization_id', currentUser.organization_id)
                .in('role', ['admin', 'consultor'])
                .order('created_at', { ascending: false });
              return data || [];
            },
            staleTime: 5 * 60 * 1000,
          });
        }

      } catch (error) {
        console.error('Erro ao pré-carregar dados:', error);
      }
    };

    prefetchData();
  }, [queryClient]);
}
