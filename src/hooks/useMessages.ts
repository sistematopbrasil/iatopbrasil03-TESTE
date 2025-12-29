import { useState, useEffect, useRef, useCallback } from 'react';
import { crmService, Message } from '@/lib/crm-service';
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Audio element not needed - using inline data URI in playNotificationSound

  useEffect(() => {
    if (conversationId) {
      loadMessages();
      subscribeToMessages();
      // Mark as read when opening conversation
      crmService.markConversationAsRead(conversationId);
    } else {
      setMessages([]);
    }

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [conversationId]);

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

    channelRef.current = crmService.subscribeToMessages(conversationId, (payload) => {
      console.log('🔔 Nova mensagem:', payload);
      if (payload.eventType === 'INSERT') {
        const newMessage = payload.new as Message;
        setMessages((prev) => {
          // Avoid duplicates - check by id and also by temp id pattern
          if (prev.some(m => m.id === newMessage.id || m.message_id === newMessage.message_id)) {
            // Replace temp message with real one
            return prev.map(m => 
              m.message_id === newMessage.message_id ? newMessage : m
            );
          }
          // Remove any temp messages that match this new message
          const withoutTemp = prev.filter(m => !m.id.startsWith('temp-'));
          return [...withoutTemp, newMessage];
        });

        // Play sound and show notification for incoming messages
        if (newMessage.direction === 'incoming') {
          playNotificationSound();
          showBrowserNotification(newMessage);
        }
      }
    });
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

      // Não mostrar toast de sucesso para ser mais rápido - a mensagem aparecendo é feedback suficiente
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