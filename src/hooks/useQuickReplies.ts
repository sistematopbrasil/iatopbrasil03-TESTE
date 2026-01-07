import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface QuickReply {
  id: string;
  shortcut: string;
  content: string | null;
  description: string | null;
  type: string;
  media_url: string | null;
  media_filename: string | null;
  order_index: number;
}

interface CRMSettings {
  quick_replies_enabled: boolean;
}

/**
 * Hook unificado para respostas rápidas com atualização em tempo real
 * Usado tanto no MessageInput quanto no QuickRepliesManager
 */
export function useQuickReplies() {
  const queryClient = useQueryClient();
  const [consultantId, setConsultantId] = useState<string | null>(null);

  // Buscar ID do consultor uma única vez
  useEffect(() => {
    async function fetchConsultantId() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (userData) {
        setConsultantId(userData.id);
      }
    }

    fetchConsultantId();
  }, []);

  // Query para buscar respostas rápidas
  const {
    data: quickReplies = [],
    isLoading: isLoadingReplies,
    refetch: refetchReplies,
  } = useQuery<QuickReply[]>({
    queryKey: ['quick-replies', consultantId],
    queryFn: async () => {
      if (!consultantId) return [];

      const { data, error } = await supabase
        .from('crm_quick_replies')
        .select('id, shortcut, content, description, type, media_url, media_filename, order_index')
        .eq('user_id', consultantId)
        .order('order_index');

      if (error) throw error;

      return (data || []).map((r, i) => ({
        ...r,
        order_index: r.order_index ?? i,
      }));
    },
    enabled: !!consultantId,
    staleTime: 30 * 1000, // 30 segundos
  });

  // Query para configurações
  const { data: settings } = useQuery<CRMSettings | null>({
    queryKey: ['crm-settings', consultantId],
    queryFn: async () => {
      if (!consultantId) return null;

      const { data } = await supabase
        .from('crm_settings')
        .select('quick_replies_enabled')
        .eq('user_id', consultantId)
        .maybeSingle();

      return data || { quick_replies_enabled: true };
    },
    enabled: !!consultantId,
    staleTime: 60 * 1000, // 1 minuto
  });

  const quickRepliesEnabled = settings?.quick_replies_enabled ?? true;

  // Subscription em tempo real para atualizações
  useEffect(() => {
    if (!consultantId) return;

    const channel = supabase
      .channel(`quick-replies-${consultantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'crm_quick_replies',
        filter: `user_id=eq.${consultantId}`,
      }, () => {
        // Invalidar cache para forçar refetch
        queryClient.invalidateQueries({ queryKey: ['quick-replies', consultantId] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'crm_settings',
        filter: `user_id=eq.${consultantId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['crm-settings', consultantId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [consultantId, queryClient]);

  // Função para invalidar cache manualmente (útil após operações CRUD)
  const invalidateCache = () => {
    if (consultantId) {
      queryClient.invalidateQueries({ queryKey: ['quick-replies', consultantId] });
    }
  };

  return {
    quickReplies,
    quickRepliesEnabled,
    isLoading: isLoadingReplies || !consultantId,
    consultantId,
    refetch: refetchReplies,
    invalidateCache,
  };
}
