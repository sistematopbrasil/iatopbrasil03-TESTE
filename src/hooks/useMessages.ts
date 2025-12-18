import { useState, useEffect, useRef } from 'react';
import { crmService, Message } from '@/lib/crm-service';
import { toast } from 'sonner';

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

  useEffect(() => {
    // Create audio element for notifications
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.volume = 0.5;

    return () => {
      audioRef.current = null;
    };
  }, []);

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

  async function loadMessages() {
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
  }

  function subscribeToMessages() {
    if (!conversationId) return;

    channelRef.current = crmService.subscribeToMessages(conversationId, (payload) => {
      console.log('🔔 Nova mensagem:', payload);
      if (payload.eventType === 'INSERT') {
        const newMessage = payload.new as Message;
        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some(m => m.id === newMessage.id)) {
            return prev;
          }
          return [...prev, newMessage];
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
  ) {
    if (!conversationId) return false;

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
        toast.error(result.error || 'Erro ao enviar mensagem');
        return false;
      }

      toast.success('Mensagem enviada!');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar mensagem');
      return false;
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
