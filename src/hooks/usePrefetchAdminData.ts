import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentConsultant, isSuperAdmin } from '@/lib/consultant-context';

/**
 * Hook para pré-carregar dados das páginas de admin em background
 * Isso garante que Settings, Ranking, Analytics e CRM abram instantaneamente
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
        (supabase.from('app_settings') as any)
          .select('*')
          .eq('user_id', userId)
          .maybeSingle()
          .then(({ data }: { data: unknown }) => {
            if (data) {
              queryClient.setQueryData(['app-settings', userId], data);
            }
          });

        // =============================================
        // PREFETCH CRM DATA
        // =============================================
        
        // Prefetch conversas do CRM
        supabase
          .from('crm_conversations')
          .select('*, lead:quiz_submissions_new(*)')
          .order('last_message_at', { ascending: false })
          .limit(50)
          .then(({ data }) => {
            if (data) {
              queryClient.setQueryData(['conversations', 'all', ''], data);
            }
          });

        // Prefetch instância WhatsApp
        supabase
          .from('whatsapp_instances')
          .select('*')
          .limit(1)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              queryClient.setQueryData(['whatsapp-instance'], data);
            }
          });

        // Prefetch respostas rápidas
        supabase
          .from('crm_quick_replies')
          .select('*')
          .order('order_index')
          .then(({ data }) => {
            if (data) {
              queryClient.setQueryData(['quick-replies'], data);
            }
          });

        // Prefetch configurações do CRM
        (supabase.from('crm_settings') as any)
          .select('*')
          .maybeSingle()
          .then(({ data }: { data: unknown }) => {
            if (data) {
              queryClient.setQueryData(['crm-settings'], data);
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
