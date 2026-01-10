import { supabase } from "@/integrations/supabase/client";
import { normalizePhone, getPhoneVariants } from "@/lib/phone-utils";

export interface WhatsAppInstance {
  id: string;
  user_id: string;
  organization_id: string;
  instance_name: string;
  instance_key: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  qr_code: string | null;
  phone_number: string | null;
  webhook_url: string | null;
  last_connected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  instance_id: string;
  user_id: string;
  organization_id: string;
  lead_id: string | null;
  contact_phone: string;
  contact_name: string | null;
  contact_avatar: string | null;
  status: 'open' | 'closed' | 'archived';
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  lead?: any;
}

export interface Message {
  id: string;
  conversation_id: string;
  message_id: string;
  direction: 'incoming' | 'outgoing';
  type: 'text' | 'audio' | 'image' | 'video' | 'document' | 'sticker' | 'location' | 'contact';
  content: string | null;
  media_url: string | null;
  media_mimetype: string | null;
  media_filename: string | null;
  media_size: number | null;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
  error_message: string | null;
  timestamp: string;
  metadata: any;
  created_at: string;
}

class CRMService {
  // ============================================
  // INSTÂNCIA WHATSAPP
  // ============================================

  async createInstance(): Promise<{ success: boolean; data?: WhatsAppInstance; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('crm-create-instance', {
        method: 'POST',
      });

      // Extrair mensagem de erro do backend se houver FunctionsHttpError
      if (error) {
        const ctx = (error as any).context;
        let backendError = '';
        if (ctx && typeof ctx.json === 'function') {
          try {
            const jsonBody = await ctx.json();
            backendError = jsonBody?.error || '';
          } catch { /* ignore parse fail */ }
        }
        return {
          success: false,
          error: backendError || error.message || 'Erro ao criar instância',
        };
      }

      // Backend pode retornar success: false com status 200
      if (data && !data.success) {
        return {
          success: false,
          error: data.error || 'Erro ao criar instância',
        };
      }

      return data;
    } catch (error: any) {
      console.error('❌ Erro ao criar instância:', error);
      return {
        success: false,
        error: error.message || 'Erro ao criar instância',
      };
    }
  }

  async getQRCode(forceNewQR = false): Promise<{ success: boolean; data?: { status: string; qr_code: string | null; message?: string }; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('crm-get-qrcode', {
        method: 'POST',
        body: { forceNewQR },
      });

      // Tratar FunctionsHttpError para extrair mensagem real do backend
      if (error) {
        const ctx = (error as any).context;
        let backendError = '';
        if (ctx && typeof ctx.json === 'function') {
          try {
            const jsonBody = await ctx.json();
            backendError = jsonBody?.error || '';
          } catch { /* ignore parse fail */ }
        }
        return {
          success: false,
          error: backendError || error.message || 'Erro ao buscar QR Code',
        };
      }

      return data;
    } catch (error: any) {
      console.error('❌ Erro ao buscar QR Code:', error);
      return {
        success: false,
        error: error.message || 'Erro ao buscar QR Code',
      };
    }
  }

  async getInstance(): Promise<WhatsAppInstance | null> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return data as WhatsAppInstance;
    } catch (error: any) {
      console.error('❌ Erro ao buscar instância:', error);
      return null;
    }
  }

  // ============================================
  // CONVERSAS
  // ============================================

  async getConversations(filters?: {
    status?: 'open' | 'closed' | 'archived';
    unread_only?: boolean;
    search?: string;
    orgWide?: boolean; // ✅ Admin vê todas da organização
  }): Promise<Conversation[]> {
    try {
      // Se orgWide, buscar sem filtro de instance_id (RLS já garante organização)
      let query = supabase
        .from('crm_conversations')
        .select(`
          *,
          lead:quiz_submissions_new(*)
        `)
        .order('is_pinned', { ascending: false })
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.unread_only) {
        query = query.gt('unread_count', 0);
      }

      if (filters?.search) {
        query = query.or(`contact_name.ilike.%${filters.search}%,contact_phone.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []) as Conversation[];
    } catch (error: any) {
      console.error('❌ Erro ao buscar conversas:', error);
      return [];
    }
  }

  // ✅ NOVA: Sincronizar mensagens recentes do provedor
  async syncRecentMessages(options?: { limit?: number; messagesPerChat?: number }): Promise<{
    success: boolean;
    synced?: { conversations: number; messages: number };
    error?: string;
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('crm-sync-recent', {
        body: options || {},
      });

      if (error) {
        const ctx = (error as any).context;
        let backendError = '';
        if (ctx && typeof ctx.json === 'function') {
          try {
            const jsonBody = await ctx.json();
            backendError = jsonBody?.error || '';
          } catch { /* ignore */ }
        }
        return { success: false, error: backendError || error.message };
      }

      return data;
    } catch (error: any) {
      console.error('❌ Erro ao sincronizar:', error);
      return { success: false, error: error.message };
    }
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    try {
      const { data, error } = await supabase
        .from('crm_conversations')
        .select(`
          *,
          lead:quiz_submissions_new(*)
        `)
        .eq('id', conversationId)
        .single();

      if (error) throw error;

      return data as Conversation;
    } catch (error: any) {
      console.error('❌ Erro ao buscar conversa:', error);
      return null;
    }
  }

  // ✅ ATUALIZADO - Normaliza telefone e verifica duplicados
  async createConversation(data: {
    instance_id: string;
    user_id: string;
    organization_id: string;
    contact_phone: string;
    contact_name?: string;
    lead_id?: string;
  }): Promise<{ success: boolean; data?: Conversation; error?: string }> {
    try {
      // ✅ Normalizar telefone e gerar variantes
      const normalizedPhone = normalizePhone(data.contact_phone);
      const phoneVariants = getPhoneVariants(data.contact_phone);

      // ✅ Verificar se já existe conversa com QUALQUER variante do telefone
      let existingConv = null;
      for (const variant of phoneVariants) {
        const { data: conv } = await supabase
          .from('crm_conversations')
          .select('*')
          .eq('contact_phone', variant)
          .eq('instance_id', data.instance_id)
          .maybeSingle();
        
        if (conv) {
          existingConv = conv;
          break;
        }
      }

      if (existingConv) {
        console.log('📱 Conversa já existe para este telefone:', normalizedPhone);
        return { success: true, data: existingConv as Conversation };
      }

      // ✅ Buscar lead por QUALQUER variante do telefone para vincular automaticamente
      let leadId = data.lead_id;
      if (!leadId) {
        for (const variant of phoneVariants) {
          const { data: lead } = await supabase
            .from('quiz_submissions_new')
            .select('id')
            .eq('phone', variant)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lead) {
            leadId = lead.id;
            console.log('🔗 Lead encontrado com variante:', variant, '| ID:', leadId);
            break;
          }
        }
      }

      const { data: newConv, error } = await supabase
        .from('crm_conversations')
        .insert({
          instance_id: data.instance_id,
          user_id: data.user_id,
          organization_id: data.organization_id,
          contact_phone: normalizedPhone, // ✅ Telefone normalizado
          contact_name: data.contact_name || null,
          lead_id: leadId || null, // ✅ Lead vinculado automaticamente
          status: 'open',
          unread_count: 0,
        })
        .select(`
          *,
          lead:quiz_submissions_new(*)
        `)
        .single();

      if (error) throw error;

      return { success: true, data: newConv as Conversation };
    } catch (error: any) {
      console.error('❌ Erro ao criar conversa:', error);
      return { success: false, error: error.message };
    }
  }

  async markConversationAsRead(conversationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('crm_conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId);

      if (error) throw error;

      return true;
    } catch (error: any) {
      console.error('❌ Erro ao marcar conversa como lida:', error);
      return false;
    }
  }

  async updateConversationStatus(
    conversationId: string,
    status: 'open' | 'closed' | 'archived'
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('crm_conversations')
        .update({ status })
        .eq('id', conversationId);

      if (error) throw error;

      return true;
    } catch (error: any) {
      console.error('❌ Erro ao atualizar status da conversa:', error);
      return false;
    }
  }

  async togglePinConversation(conversationId: string, isPinned: boolean): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('crm_conversations')
        .update({ is_pinned: isPinned })
        .eq('id', conversationId);

      if (error) throw error;

      return true;
    } catch (error: any) {
      console.error('❌ Erro ao fixar/desafixar conversa:', error);
      return false;
    }
  }

  // ============================================
  // MENSAGENS
  // ============================================

  async getMessages(conversationId: string, limit = 100): Promise<Message[]> {
    try {
      const { data, error } = await supabase
        .from('crm_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: true })
        .limit(limit);

      if (error) throw error;

      return (data || []) as Message[];
    } catch (error: any) {
      console.error('❌ Erro ao buscar mensagens:', error);
      return [];
    }
  }

  async sendMessage(
    conversationId: string,
    type: 'text' | 'audio' | 'image' | 'video' | 'document',
    content: string,
    mediaUrl?: string,
    fileName?: string
  ): Promise<{ success: boolean; data?: Message; error?: string; needsReconnect?: boolean }> {
    try {
      const { data, error } = await supabase.functions.invoke('crm-send-message', {
        body: {
          conversation_id: conversationId,
          type,
          content,
          media_url: mediaUrl,
          file_name: fileName,
          // Para imagem, vídeo e documento, enviar caption separadamente
          caption: (type === 'image' || type === 'video' || type === 'document') ? content : undefined,
        },
      });

      // SDK throws FunctionsHttpError for non-2xx, so error may already be populated
      if (error) {
        // Try to extract backend-provided message from error context
        const ctx = (error as any).context;
        let backendError = '';
        let needsReconnect = false;
        if (ctx && typeof ctx.json === 'function') {
          try {
            const jsonBody = await ctx.json();
            backendError = jsonBody?.error || '';
            needsReconnect = jsonBody?.needsReconnect || false;
          } catch { /* ignore parse fail */ }
        }
        return {
          success: false,
          error: backendError || error.message || 'Erro ao enviar mensagem',
          needsReconnect,
        };
      }

      // Backend returns { success, error, needsReconnect } – propagate if present
      if (data && !data.success) {
        return {
          success: false,
          error: data.error || 'Erro ao enviar mensagem',
          needsReconnect: data.needsReconnect || false,
        };
      }

      return { success: true, data };
    } catch (error: any) {
      console.error('❌ Erro ao enviar mensagem:', error);
      return {
        success: false,
        error: error.message || 'Erro ao enviar mensagem',
      };
    }
  }

  // ============================================
  // REALTIME
  // ============================================

  subscribeToConversations(callback: (payload: any) => void) {
    return supabase
      .channel('crm_conversations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crm_conversations',
        },
        callback
      )
      .subscribe();
  }

  subscribeToMessages(conversationId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`crm_messages_${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'crm_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        callback
      )
      .subscribe();
  }
}

export const crmService = new CRMService();