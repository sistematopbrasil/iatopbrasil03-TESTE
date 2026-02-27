import { useState, useEffect, useRef, useCallback } from 'react';
import { crmService, Message } from '@/lib/crm-service';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

// Request notification permission on load
if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const channelRef = useRef<any>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeActiveRef = useRef(false);

  // Cleanup polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Start polling as safety net (always runs)
  const startPolling = useCallback((intervalMs = 5000) => {
    if (pollingRef.current || !conversationId) return;
    console.log(`📡 Iniciando polling de segurança (${intervalMs / 1000}s)`);
    pollingRef.current = setInterval(() => {
      if (conversationId) {
        crmService.getMessages(conversationId).then(data => {
          setMessages(prev => {
            // Merge: keep temp messages, update with new data
            const tempMessages = prev.filter(m => m.id.startsWith('temp-'));
            const merged = [...data];
            tempMessages.forEach(temp => {
              if (!merged.some(m => m.message_id === temp.message_id)) {
                merged.push(temp);
              }
            });
            return merged.sort((a, b) => 
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
          });
        }).catch(console.error);
      }
    }, 3000);
  }, [conversationId]);

  useEffect(() => {
    if (conversationId) {
      loadMessages();
      subscribeToMessages();
      startPolling(5000); // Always poll as safety net
      crmService.markConversationAsRead(conversationId);
    } else {
      setMessages([]);
    }

    // Refetch on window focus
    const handleFocus = () => {
      if (conversationId) loadMessages();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
      stopPolling();
      window.removeEventListener('focus', handleFocus);
    };
  }, [conversationId, stopPolling, startPolling]);

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;

    setIsLoading(true);
    try {
      const data = await crmService.getMessages(conversationId);
      setMessages(data);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  function subscribeToMessages() {
    if (!conversationId) return;

    console.log('🔔 Configurando subscription realtime para:', conversationId);

    channelRef.current = supabase
      .channel(`messages-${conversationId}-${Date.now()}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'crm_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          console.log('🔔 Mensagem realtime recebida:', payload.eventType, payload);
          realtimeActiveRef.current = true;
          realtimeActiveRef.current = true;
          
          if (payload.eventType === 'INSERT') {
            const newMessage = payload.new as Message;
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some(m => m.id === newMessage.id || m.message_id === newMessage.message_id)) {
                return prev.map(m => 
                  m.message_id === newMessage.message_id ? newMessage : m
                );
              }
              // Remove temp messages
              const withoutTemp = prev.filter(m => !m.id.startsWith('temp-'));
              return [...withoutTemp, newMessage].sort((a, b) => 
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              );
            });

            if (newMessage.direction === 'incoming') {
              playNotificationSound();
              showBrowserNotification(newMessage);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedMessage = payload.new as Message;
            setMessages((prev) => 
              prev.map(m => m.id === updatedMessage.id ? updatedMessage : m)
            );
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime conectado com sucesso');
          realtimeActiveRef.current = true;
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.warn('⚠️ Realtime desconectado, iniciando polling fallback');
          realtimeActiveRef.current = false;
        }
      });

    // Polling já está rodando como safety net via useEffect
  }

  function playNotificationSound() {
    try {
      // Use Web Audio API as fallback
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleVBjqNGDOQEAAAA');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch (err) {
      // Silent fail - notification sound is optional
    }
  }

  function showBrowserNotification(message: Message) {
    if ('Notification' in window && Notification.permission === 'granted') {
      const body = message.type === 'text' 
        ? message.content || 'Nova mensagem'
        : message.type === 'image' ? '📷 Imagem'
        : message.type === 'audio' ? '🎤 Áudio'
        : message.type === 'video' ? '🎥 Vídeo'
        : message.type === 'document' ? '📄 Documento'
        : 'Nova mensagem';

      new Notification('Nova mensagem no CRM', {
        body,
        icon: '/logo_topbr.png',
        tag: 'crm-message',
      });
    }
  }

  async function sendMessage(
    type: 'text' | 'audio' | 'image' | 'video' | 'document',
    content: string,
    mediaUrl?: string,
    fileName?: string
  ): Promise<{ success: boolean; needsReconnect?: boolean }> {
    if (!conversationId) return { success: false };

    // Generate temp ID for optimistic update
    const tempId = `temp-${Date.now()}`;
    const tempMessageId = `sending-${uuidv4()}`;

    // Optimistic update - add message immediately
    const optimisticMessage: Message = {
      id: tempId,
      conversation_id: conversationId,
      message_id: tempMessageId,
      direction: 'outgoing',
      type,
      content: type === 'text' ? content : null,
      media_url: mediaUrl || null,
      media_mimetype: null,
      media_filename: fileName || null,
      media_size: null,
      status: 'sending',
      error_message: null,
      timestamp: new Date().toISOString(),
      metadata: null,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setIsSending(true);

    try {
      const result = await crmService.sendMessage(
        conversationId,
        type,
        content,
        mediaUrl,
        fileName
      );

      if (!result.success) {
        // Update temp message to error state
        setMessages((prev) => 
          prev.map(m => 
            m.id === tempId 
              ? { ...m, status: 'error' as const, error_message: result.error || 'Erro ao enviar' }
              : m
          )
        );
        
        // Mostrar mensagem de erro específica
        if (result.needsReconnect) {
          toast.error(result.error || 'WhatsApp desconectado. Reconecte para enviar mensagens.');
        } else {
          toast.error(result.error || 'Erro ao enviar mensagem');
        }
        
        return { success: false, needsReconnect: result.needsReconnect };
      }

      // Mark as sent (will be replaced by real message from realtime)
      setMessages((prev) => 
        prev.map(m => 
          m.id === tempId 
            ? { ...m, status: 'sent' as const, message_id: result.data?.message_id || tempMessageId }
            : m
        )
      );

      // Refetch messages after sending to ensure we have the latest
      setTimeout(() => loadMessages(), 1500);
      return { success: true };
    } catch (error: any) {
      // Update temp message to error state
      setMessages((prev) => 
        prev.map(m => 
          m.id === tempId 
            ? { ...m, status: 'error' as const, error_message: error.message || 'Erro ao enviar' }
            : m
        )
      );
      toast.error(error.message || 'Erro ao enviar mensagem');
      return { success: false };
    } finally {
      setIsSending(false);
    }
  }

  return {
    messages,
    isLoading,
    isSending,
    sendMessage,
    refresh: loadMessages,
  };
}