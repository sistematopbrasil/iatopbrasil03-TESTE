import { useState, useEffect } from 'react';
import { crmService, Conversation } from '@/lib/crm-service';

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed' | 'unread'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadConversations();
  }, [filter, searchQuery]);

  useEffect(() => {
    const channel = crmService.subscribeToConversations((payload) => {
      console.log('🔔 Conversa atualizada:', payload);
      loadConversations();
    });

    return () => {
      channel.unsubscribe();
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
