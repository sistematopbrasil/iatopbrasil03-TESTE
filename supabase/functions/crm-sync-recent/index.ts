import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || '';
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '';

// ✅ Normalizar telefone brasileiro
function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    return cleaned;
  }
  if (cleaned.length === 11 || cleaned.length === 10) {
    return `55${cleaned}`;
  }
  return cleaned;
}

// ✅ Gerar variantes do telefone (com/sem 9)
function getPhoneVariants(phone: string): string[] {
  const normalized = normalizePhone(phone);
  const variants: string[] = [normalized];
  
  if (normalized.startsWith('55') && normalized.length >= 12) {
    const ddd = normalized.slice(2, 4);
    const rest = normalized.slice(4);
    
    if (rest.length === 9 && rest.startsWith('9')) {
      variants.push(`55${ddd}${rest.slice(1)}`);
    } else if (rest.length === 8) {
      variants.push(`55${ddd}9${rest}`);
    }
  }
  
  return variants;
}

async function evolutionRequest(endpoint: string, options: RequestInit = {}) {
  const baseUrl = EVOLUTION_API_URL.replace(/\/$/, '');
  const url = `${baseUrl}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
        ...options.headers,
      },
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data };
    }
    
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: { message: error.message } };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔄 CRM Sync Recent - Iniciando...');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autorizado');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Usuário não autenticado');
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, organization_id, role')
      .eq('auth_user_id', user.id)
      .single();

    if (!userData) {
      throw new Error('Dados do usuário não encontrados');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body for options
    let body: any = {};
    try {
      body = await req.json();
    } catch { /* empty body is fine */ }
    
    const { limit = 30, messagesPerChat = 20, instanceId } = body;
    const isAdmin = userData.role === 'admin' || userData.role === 'super_admin';

    // Buscar instâncias - admin pode ver todas da org, consultor só a sua
    let instancesQuery = supabaseAdmin
      .from('whatsapp_instances')
      .select('*')
      .eq('organization_id', userData.organization_id)
      .eq('status', 'connected');
    
    if (!isAdmin) {
      instancesQuery = instancesQuery.eq('user_id', userData.id);
    } else if (instanceId) {
      instancesQuery = instancesQuery.eq('id', instanceId);
    }

    const { data: instances, error: instancesError } = await instancesQuery;

    if (instancesError || !instances || instances.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhuma instância conectada encontrada',
          synced: { conversations: 0, messages: 0 },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📱 ${instances.length} instância(s) para sincronizar`);

    let totalConversations = 0;
    let totalMessages = 0;
    const errors: string[] = [];

    for (const instance of instances) {
      console.log(`🔄 Sincronizando instância: ${instance.instance_name}`);
      
      // 1. Buscar chats recentes do provedor
      const chatsResult = await evolutionRequest(`/chat/findChats/${instance.instance_name}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      if (!chatsResult.success) {
        console.error(`❌ Erro ao buscar chats de ${instance.instance_name}:`, chatsResult.error);
        errors.push(`${instance.instance_name}: Erro ao buscar chats`);
        continue;
      }

      const chats = Array.isArray(chatsResult.data) 
        ? chatsResult.data.slice(0, limit) 
        : [];
      
      console.log(`📬 ${chats.length} chats encontrados`);

      for (const chat of chats) {
        try {
          // Ignorar grupos
          const remoteJid = chat.id || chat.remoteJid;
          if (!remoteJid || remoteJid.endsWith('@g.us')) continue;

          const rawPhone = remoteJid.replace('@s.whatsapp.net', '');
          const normalizedPhone = normalizePhone(rawPhone);
          const phoneVariants = getPhoneVariants(rawPhone);

          // 2. Buscar/criar conversa
          let conversation = null;
          for (const variant of phoneVariants) {
            const { data: foundConv } = await supabaseAdmin
              .from('crm_conversations')
              .select('*')
              .eq('instance_id', instance.id)
              .eq('contact_phone', variant)
              .single();
            
            if (foundConv) {
              conversation = foundConv;
              break;
            }
          }

          // Buscar lead
          let lead = null;
          for (const variant of phoneVariants) {
            const { data: foundLead } = await supabaseAdmin
              .from('quiz_submissions_new')
              .select('id, name')
              .eq('phone', variant)
              .eq('organization_id', instance.organization_id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (foundLead) {
              lead = foundLead;
              break;
            }
          }

          if (!conversation) {
            // Criar conversa
            const { data: newConv, error: convError } = await supabaseAdmin
              .from('crm_conversations')
              .insert({
                instance_id: instance.id,
                user_id: instance.user_id,
                organization_id: instance.organization_id,
                contact_phone: normalizedPhone,
                contact_name: chat.name || chat.pushName || lead?.name || normalizedPhone,
                lead_id: lead?.id || null,
                status: 'open',
              })
              .select()
              .single();
            
            if (convError) {
              console.error(`❌ Erro ao criar conversa para ${normalizedPhone}:`, convError);
              continue;
            }
            
            conversation = newConv;
            totalConversations++;
          } else if (lead && !conversation.lead_id) {
            // Vincular lead
            await supabaseAdmin
              .from('crm_conversations')
              .update({ lead_id: lead.id, contact_name: lead.name || conversation.contact_name })
              .eq('id', conversation.id);
          }

          // 3. Buscar mensagens recentes do chat
          const messagesResult = await evolutionRequest(`/chat/findMessages/${instance.instance_name}`, {
            method: 'POST',
            body: JSON.stringify({
              where: { key: { remoteJid } },
              limit: messagesPerChat,
            }),
          });

          if (!messagesResult.success) continue;

          const messages = messagesResult.data?.messages || messagesResult.data || [];
          
          for (const msg of messages) {
            try {
              const key = msg.key;
              if (!key?.id) continue;

              const direction = key.fromMe ? 'outgoing' : 'incoming';
              
              // Determinar tipo e conteúdo
              let type = 'text';
              let content = '';
              const messageContent = msg.message || {};

              if (messageContent.conversation) {
                content = messageContent.conversation;
              } else if (messageContent.extendedTextMessage?.text) {
                content = messageContent.extendedTextMessage.text;
              } else if (messageContent.imageMessage) {
                type = 'image';
                content = messageContent.imageMessage.caption || '';
              } else if (messageContent.videoMessage) {
                type = 'video';
                content = messageContent.videoMessage.caption || '';
              } else if (messageContent.audioMessage) {
                type = 'audio';
              } else if (messageContent.documentMessage) {
                type = 'document';
              } else if (messageContent.stickerMessage) {
                type = 'sticker';
              } else {
                content = '[Mensagem]';
              }

              const timestamp = msg.messageTimestamp 
                ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
                : new Date().toISOString();

              // Upsert mensagem
              const { error: msgError } = await supabaseAdmin
                .from('crm_messages')
                .upsert({
                  conversation_id: conversation.id,
                  instance_id: instance.id,
                  message_id: key.id,
                  direction,
                  type,
                  content,
                  status: direction === 'outgoing' ? 'sent' : 'delivered',
                  timestamp,
                  metadata: msg,
                }, { onConflict: 'instance_id,message_id', ignoreDuplicates: true });

              if (!msgError) {
                totalMessages++;
              }
            } catch (msgErr) {
              console.error('❌ Erro ao processar mensagem:', msgErr);
            }
          }

          // 4. Atualizar last_message_at da conversa
          const { data: lastMsg } = await supabaseAdmin
            .from('crm_messages')
            .select('timestamp, content, type')
            .eq('conversation_id', conversation.id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .single();

          if (lastMsg) {
            await supabaseAdmin
              .from('crm_conversations')
              .update({
                last_message_at: lastMsg.timestamp,
                last_message_preview: lastMsg.type === 'text' 
                  ? lastMsg.content?.substring(0, 100) 
                  : `📎 ${lastMsg.type}`,
              })
              .eq('id', conversation.id);
          }
        } catch (chatErr) {
          console.error('❌ Erro ao processar chat:', chatErr);
        }
      }
    }

    console.log(`✅ Sync completo: ${totalConversations} conversas, ${totalMessages} mensagens`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: {
          conversations: totalConversations,
          messages: totalMessages,
        },
        errors: errors.length > 0 ? errors : undefined,
        message: `Sincronização concluída: ${totalConversations} conversas, ${totalMessages} mensagens`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Erro no sync:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
