import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { crmService, Conversation } from '@/lib/crm-service';
import { supabase } from '@/integrations/supabase/client';

export function useConversations() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'open' | 'closed' | 'unread'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Build filters object
  const getFilters = useCallback(() => {
    const filters: any = {};
    if (filter === 'open') filters.status = 'open';
    if (filter === 'closed') filters.status = 'closed';
    if (filter === 'unread') filters.unread_only = true;
    if (searchQuery) filters.search = searchQuery;
    return filters;
  }, [filter, searchQuery]);

  // Use React Query with caching - usando initialData do prefetch
  const { data: conversations = [], isLoading, refetch } = useQuery({
    queryKey: ['conversations', filter, searchQuery],
    queryFn: () => crmService.getConversations(getFilters()),
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
    refetchOnWindowFocus: false,
    // ✅ Usar dados do prefetch como placeholder para abertura instantânea
    placeholderData: (previousData) => previousData,
  });

  // Real-time subscriptions
  useEffect(() => {
    // Subscription for conversations changes
    const conversationChannel = supabase
      .channel('crm-conversations-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crm_conversations' },
        (payload) => {
          console.log('🔔 Conversa atualizada (realtime):', payload);
          // Invalidate cache to refetch
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      )
      .subscribe();

    // Subscription for new messages (to update conversation list)
    const messageChannel = supabase
      .channel('crm-messages-for-conversations')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'crm_messages' },
        (payload) => {
          console.log('🔔 Nova mensagem - atualizando conversas:', payload);
          // Invalidate cache to refetch conversations with new message preview
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationChannel);
      supabase.removeChannel(messageChannel);
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

  // Conta quantas CONVERSAS têm mensagens não lidas (não o total de mensagens)
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
    refresh: refetch,
  };
}
