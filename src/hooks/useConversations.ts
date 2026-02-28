import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { crmService, Conversation } from '@/lib/crm-service';
import { supabase } from '@/integrations/supabase/client';

interface UseConversationsOptions {
  orgWide?: boolean; // Admin vê todas conversas da organização
  autoSync?: boolean; // Sincronizar automaticamente ao carregar
  instanceId?: string; // Filtrar por instância ativa
}

export function useConversations(options?: UseConversationsOptions) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'open' | 'closed' | 'unread'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const hasSyncedRef = useRef(false);

  // Build filters object
  const getFilters = useCallback(() => {
    const filters: any = {};
    if (filter === 'open') filters.status = 'open';
    if (filter === 'closed') filters.status = 'closed';
    if (filter === 'unread') filters.unread_only = true;
    if (searchQuery) filters.search = searchQuery;
    if (options?.orgWide) filters.orgWide = true;
    if (options?.instanceId) filters.instance_id = options.instanceId;
    return filters;
  }, [filter, searchQuery, options?.orgWide, options?.instanceId]);

  // Use React Query with caching
  const { data: conversations = [], isLoading, refetch } = useQuery({
    queryKey: ['conversations', filter, searchQuery, options?.orgWide, options?.instanceId],
    queryFn: () => crmService.getConversations(getFilters()),
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 15000,
    placeholderData: (previousData) => previousData,
  });

  // ✅ Auto-sync ao carregar o CRM e a cada 60s em background
  useEffect(() => {
    if (options?.autoSync === false) return;

    const doSync = async () => {
      try {
        const result = await crmService.syncRecentMessages({ limit: 30, messagesPerChat: 30 });
        if (result.success && (result.synced?.conversations || result.synced?.messages)) {
          console.log('✅ Auto-sync concluído:', result.synced);
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      } catch (err) {
        console.warn('⚠️ Auto-sync falhou:', err);
      }
    };

    // Sync inicial (uma vez por sessão)
    if (!hasSyncedRef.current) {
      hasSyncedRef.current = true;
      doSync();
    }

    // Sync periódico a cada 15s (primário - webhook não funciona)
    const intervalId = setInterval(doSync, 15000);

    return () => clearInterval(intervalId);
  }, [options?.autoSync, queryClient]);

  // Real-time subscriptions + window focus listener
  useEffect(() => {
    const conversationChannel = supabase
      .channel('crm-conversations-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crm_conversations' },
        (payload) => {
          console.log('🔔 Conversa atualizada (realtime):', payload);
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      )
      .subscribe();

    const messageChannel = supabase
      .channel('crm-messages-for-conversations')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'crm_messages' },
        (payload) => {
          console.log('🔔 Nova mensagem - atualizando conversas:', payload);
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      )
      .subscribe();

    // Refetch on window focus
    const handleFocus = () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      supabase.removeChannel(conversationChannel);
      supabase.removeChannel(messageChannel);
      window.removeEventListener('focus', handleFocus);
    };
  }, [queryClient]);

  async function markAsRead(conversationId: string) {
    await crmService.markConversationAsRead(conversationId);
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  }

  async function updateStatus(conversationId: string, status: 'open' | 'closed' | 'archived') {
    await crmService.updateConversationStatus(conversationId, status);
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  }

  async function togglePin(conversationId: string, isPinned: boolean) {
    await crmService.togglePinConversation(conversationId, isPinned);
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  }

  // Sync manual
  async function syncNow() {
    const result = await crmService.syncRecentMessages({ limit: 30, messagesPerChat: 30 });
    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
    return result;
  }

  const totalUnread = conversations.filter(conv => conv.unread_count > 0).length;

  return {
    conversations,
    isLoading,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    totalUnread,
    markAsRead,
    updateStatus,
    togglePin,
    syncNow,
    refresh: refetch,
  };
}
