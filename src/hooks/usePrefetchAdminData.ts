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
        const userId = currentUser.id;
        const orgId = currentUser.organization_id;

        // Prefetch dados do ranking
        supabase.functions.invoke('ranking-get').then(({ data }) => {
          if (data) {
            queryClient.setQueryData(['ranking'], data);
          }
        });

        // Prefetch quiz questions (usado em Settings)
        // Usamos tipagem explícita para evitar erro de tipo profundo
        (supabase.from('quiz_questions') as any)
          .select('*')
          .eq('user_id', userId)
          .order('order_index')
          .then(({ data }: { data: unknown }) => {
            if (data) {
              queryClient.setQueryData(['quiz-questions', userId], data);
            }
          });

        // Prefetch pipeline stages
        supabase
          .from('pipeline_stages')
          .select('*')
          .order('order_index')
          .then(({ data }) => {
            if (data) {
              queryClient.setQueryData(['pipeline-stages'], data);
            }
          });

        // Prefetch app settings
        // Usamos tipagem explícita para evitar erro de tipo profundo
        (supabase.from('app_settings') as any)
          .select('*')
          .eq('user_id', userId)
          .maybeSingle()
          .then(({ data }: { data: unknown }) => {
            if (data) {
              queryClient.setQueryData(['app-settings', userId], data);
            }
          });

        // Prefetch para super admin
        if (isSuperAdminUser && orgId) {
          supabase
            .from('users')
            .select('*')
            .eq('organization_id', orgId)
            .in('role', ['admin', 'consultor'])
            .order('created_at', { ascending: false })
            .then(({ data }) => {
              if (data) {
                queryClient.setQueryData(['consultants', orgId], data);
              }
            });
        }

      } catch (error) {
        console.error('Erro ao pré-carregar dados:', error);
      }
    };

    prefetchData();
  }, [queryClient]);
}
