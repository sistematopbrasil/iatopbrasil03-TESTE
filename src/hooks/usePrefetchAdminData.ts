import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentConsultant, isSuperAdmin } from '@/lib/consultant-context';

/**
 * Hook para pré-carregar dados das páginas de admin em background
 * Executa apenas UMA VEZ por sessão para evitar chamadas repetidas
 */
export function usePrefetchAdminData() {
  const queryClient = useQueryClient();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    const prefetchData = async () => {
      try {
        const currentUser = await getCurrentConsultant();
        if (!currentUser) return;

        const isSuperAdminUser = isSuperAdmin(currentUser.role);
        const userId = currentUser.id;
        const orgId = currentUser.organization_id;

        // =============================================
        // PREFETCH RANKING - com query key correta
        // =============================================
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setHours(23, 59, 59, 999);
        const periodEndStr = periodEnd.toISOString();

        supabase.functions.invoke('ranking-get', {
          body: { periodStart: null, periodEnd: periodEndStr }
        }).then(({ data }) => {
          if (data?.success) {
            // Query key do useRankingData: ['unified-ranking', periodStart, periodEnd]
            queryClient.setQueryData(['unified-ranking', null, periodEndStr], data);
          }
        });

        // =============================================
        // PREFETCH CURRENT USER SETTINGS (AdminSettings)
        // =============================================
        queryClient.setQueryData(['current-user-settings'], currentUser);

        // =============================================
        // PREFETCH QUIZ QUESTIONS (Settings)
        // =============================================
        (supabase.from('quiz_questions') as any)
          .select('*')
          .eq('consultant_id', userId)
          .order('order_index')
          .then(({ data }: { data: unknown }) => {
            if (data) {
              queryClient.setQueryData(['quiz-questions', userId], data);
            }
          });

        // =============================================
        // PREFETCH PIPELINE STAGES
        // =============================================
        supabase
          .from('pipeline_stages')
          .select('*')
          .order('order_index')
          .then(({ data }) => {
            if (data) {
              queryClient.setQueryData(['pipeline-stages'], data);
            }
          });

        // =============================================
        // PREFETCH PIPELINE LEADS
        // =============================================
        let leadsQuery = supabase
          .from('quiz_submissions_new')
          .select('*')
          .order('created_at', { ascending: false });

        if (!isSuperAdminUser) {
          leadsQuery = leadsQuery.eq('consultant_id', userId);
        } else {
          leadsQuery = leadsQuery.eq('organization_id', orgId);
        }

        leadsQuery.then(({ data }) => {
          if (data) {
            queryClient.setQueryData(['pipeline-leads', userId], data);
          }
        });

        // =============================================
        // PREFETCH ANALYTICS - Query key: ['quiz-submissions-analytics', period, userId]
        // =============================================
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let analyticsQuery = supabase
          .from('quiz_submissions_new')
          .select('*')
          .eq('organization_id', orgId)
          .gte('created_at', thirtyDaysAgo.toISOString());

        if (!isSuperAdminUser) {
          analyticsQuery = analyticsQuery.eq('consultant_id', userId);
        }

        analyticsQuery.then(({ data }) => {
          if (data) {
            queryClient.setQueryData(['quiz-submissions-analytics', '30', userId], data);
          }
        });

        // =============================================
        // PREFETCH APP SETTINGS
        // =============================================
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
        
        // Prefetch conversas do CRM - Query key: ['conversations', filter, searchQuery]
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

        // =============================================
        // PREFETCH INSTAGRAM DATA
        // =============================================
        supabase
          .from('insta_profiles')
          .select('*')
          .eq('organization_id', orgId)
          .then(({ data }) => {
            if (data) {
              queryClient.setQueryData(['insta-profiles'], data);
            }
          });

        supabase
          .from('insta_follower_metrics')
          .select('*')
          .order('recorded_date', { ascending: false })
          .limit(1000)
          .then(({ data }) => {
            if (data) {
              queryClient.setQueryData(['insta-metrics'], data);
            }
          });

        // =============================================
        // PREFETCH TRAFFIC DATA
        // =============================================
        supabase
          .from('ad_accounts')
          .select('*')
          .eq('organization_id', orgId)
          .then(({ data }) => {
            if (data) {
              queryClient.setQueryData(['ad-accounts', orgId], data);
            }
          });

        supabase
          .from('traffic_settings')
          .select('ai_enabled')
          .eq('organization_id', orgId)
          .single()
          .then(({ data }) => {
            if (data) {
              queryClient.setQueryData(['traffic-settings', orgId], data);
            }
          });

        // =============================================
        // PREFETCH SUPER ADMIN DATA
        // =============================================
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

        // =============================================
        // PREFETCH EVENTS
        // =============================================
        supabase
          .from('events')
          .select('*, event_attendees(count)')
          .eq('organization_id', orgId)
          .order('event_date', { ascending: false })
          .then(({ data }) => {
            if (data) {
              queryClient.setQueryData(['events', orgId], data);
            }
          });

        // =============================================
        // PREFETCH DASHBOARD STATS
        // =============================================
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        let dashQuery = supabase
          .from('quiz_submissions_new')
          .select('id, created_at, temperature, completion_percentage, lead_source')
          .eq('organization_id', orgId)
          .gte('created_at', sevenDaysAgo.toISOString());

        if (!isSuperAdminUser) {
          dashQuery = dashQuery.eq('consultant_id', userId);
        }

        dashQuery.then(({ data }) => {
          if (data) {
            queryClient.setQueryData(['dashboard-stats', userId], data);
          }
        });

      } catch (error) {
        console.error('Erro ao pré-carregar dados:', error);
      }
    };

    prefetchData();
  }, [queryClient]);
}
