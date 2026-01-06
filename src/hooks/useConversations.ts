import { useState, useEffect } from 'react';
import { crmService, Conversation } from '@/lib/crm-service';
import { supabase } from '@/integrations/supabase/client';

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed' | 'unread'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadConversations();
  }, [filter, searchQuery]);

  useEffect(() => {
    // Subscription para conversas
    const conversationChannel = crmService.subscribeToConversations((payload) => {
      console.log('🔔 Conversa atualizada:', payload);
      loadConversations();
    });

    // Subscription para mensagens novas (para atualizar lista de conversas)
    const messageChannel = supabase
      .channel('messages-for-conversations')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'crm_messages' },
        () => {
          console.log('🔔 Nova mensagem - atualizando conversas');
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      conversationChannel.unsubscribe();
      supabase.removeChannel(messageChannel);
    };
  }, []);

  async function loadConversations() {
    setIsLoading(true);
    try {
      const filters: any = {};

      if (filter === 'open') filters.status = 'open';
      if (filter === 'closed') filters.status = 'closed';
      if (filter === 'unread') filters.unread_only = true;
      if (searchQuery) filters.search = searchQuery;

      const data = await crmService.getConversations(filters);
      setConversations(data);
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function markAsRead(conversationId: string) {
    await crmService.markConversationAsRead(conversationId);
    await loadConversations();
  }

  async function updateStatus(conversationId: string, status: 'open' | 'closed' | 'archived') {
    await crmService.updateConversationStatus(conversationId, status);
    await loadConversations();
  }

  async function togglePin(conversationId: string, isPinned: boolean) {
    await crmService.togglePinConversation(conversationId, isPinned);
    await loadConversations();
  }

  const totalUnread = conversations.reduce((sum, conv) => sum + conv.unread_count, 0);

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
    refresh: loadConversations,
  };
}
