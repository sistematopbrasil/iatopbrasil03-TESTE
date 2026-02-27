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
      return { success: false, error: data, status: response.status };
    }
    
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: { message: error.message } };
  }
}

// ✅ Tentar múltiplos endpoints para buscar chats
async function findChats(instanceName: string): Promise<any[]> {
  // Tentativa 1: POST /chat/findChats (Evolution API v1)
  console.log('🔍 Tentativa 1: POST /chat/findChats');
  const result1 = await evolutionRequest(`/chat/findChats/${instanceName}`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  
  if (result1.success && Array.isArray(result1.data) && result1.data.length > 0) {
    console.log(`✅ findChats POST retornou ${result1.data.length} chats`);
    return result1.data;
  }
  
  // Tentativa 2: GET /chat/findChats (algumas versões usam GET)
  console.log('🔍 Tentativa 2: GET /chat/findChats');
  const result2 = await evolutionRequest(`/chat/findChats/${instanceName}`, {
    method: 'GET',
  });
  
  if (result2.success && Array.isArray(result2.data) && result2.data.length > 0) {
    console.log(`✅ findChats GET retornou ${result2.data.length} chats`);
    return result2.data;
  }

  // Tentativa 3: POST /chat/findContacts (Evolution API v2)
  console.log('🔍 Tentativa 3: POST /chat/findContacts');
  const result3 = await evolutionRequest(`/chat/findContacts/${instanceName}`, {
    method: 'POST',
    body: JSON.stringify({ where: {} }),
  });
  
  if (result3.success) {
    const contacts = Array.isArray(result3.data) ? result3.data : [];
    if (contacts.length > 0) {
      console.log(`✅ findContacts retornou ${contacts.length} contatos`);
      // Converter formato de contatos para formato de chats
      return contacts.map((c: any) => ({
        id: c.id || c.remoteJid,
        remoteJid: c.id || c.remoteJid,
        name: c.pushName || c.name || c.profilePictureUrl,
        pushName: c.pushName || c.name,
      }));
    }
  }

  // Tentativa 4: GET /chat/findContacts
  console.log('🔍 Tentativa 4: GET /chat/findContacts');
  const result4 = await evolutionRequest(`/chat/findContacts/${instanceName}`, {
    method: 'GET',
  });
  
  if (result4.success) {
    const contacts = Array.isArray(result4.data) ? result4.data : [];
    if (contacts.length > 0) {
      console.log(`✅ findContacts GET retornou ${contacts.length} contatos`);
      return contacts.map((c: any) => ({
        id: c.id || c.remoteJid,
        remoteJid: c.id || c.remoteJid,
        name: c.pushName || c.name,
        pushName: c.pushName || c.name,
      }));
    }
  }

  console.log('⚠️ Nenhum endpoint retornou chats. Erros:', {
    post_findChats: result1.error,
    get_findChats: result2.error,
    post_findContacts: result3.error,
    get_findContacts: result4.error,
  });
  
  return [];
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
    
    const { limit = 30, messagesPerChat = 50, instanceId } = body;
    const isAdmin = userData.role === 'admin' || userData.role === 'super_admin';

    // Buscar instâncias
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
      
      // ✅ Usar função que tenta múltiplos endpoints
      const chats = (await findChats(instance.instance_name)).slice(0, limit);
      
      console.log(`📬 ${chats.length} chats encontrados`);

      for (const chat of chats) {
        try {
          const remoteJid = chat.id || chat.remoteJid;
          if (!remoteJid || remoteJid.endsWith('@g.us')) continue;

          const rawPhone = remoteJid.replace('@s.whatsapp.net', '');
          const normalizedPhone = normalizePhone(rawPhone);
          
          if (normalizedPhone.length < 12 || normalizedPhone.length > 13) {
            console.log(`⏭️ Ignorando número inválido: ${normalizedPhone} (${normalizedPhone.length} dígitos)`);
            continue;
          }
          
          const phoneVariants = getPhoneVariants(rawPhone);

          // Buscar conversa existente
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

          // ✅ REMOVIDO: check-messages-before-creating-conversation
          // Agora SEMPRE cria a conversa para chats válidos, depois busca mensagens

          // Buscar lead
          let lead = null;
          for (const variant of phoneVariants) {
            const { data: foundLead } = await supabaseAdmin
              .from('quiz_submissions_new')
              .select('id, name, consultant_id')
              .eq('phone', variant)
              .eq('organization_id', instance.organization_id)
              .eq('consultant_id', instance.user_id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (foundLead) {
              lead = foundLead;
              break;
            }
          }
          
          if (!lead) {
            console.log(`🆕 Criando lead automaticamente para: ${normalizedPhone}`);
            
            const { data: stages } = await supabaseAdmin
              .from('pipeline_stages')
              .select('id')
              .eq('organization_id', instance.organization_id)
              .order('order_index', { ascending: true })
              .limit(1);
            
            const firstStageId = stages?.[0]?.id || null;
            
            const { data: newLead, error: leadError } = await supabaseAdmin
              .from('quiz_submissions_new')
              .insert({
                name: chat.name || chat.pushName || normalizedPhone,
                phone: normalizedPhone,
                organization_id: instance.organization_id,
                consultant_id: instance.user_id,
                pipeline_stage_id: firstStageId,
                stage: 'novo',
                temperature: 'cold',
                completion_percentage: 0,
                lead_score: 0,
                lead_source: 'whatsapp',
              })
              .select('id, name, consultant_id')
              .single();
            
            if (!leadError && newLead) {
              lead = newLead;
              console.log(`✅ Lead criado: ${lead.id}`);
            } else {
              console.warn(`⚠️ Erro ao criar lead:`, leadError);
            }
          }

          if (!conversation) {
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
            await supabaseAdmin
              .from('crm_conversations')
              .update({ lead_id: lead.id, contact_name: lead.name || conversation.contact_name })
              .eq('id', conversation.id);
          }

          // Buscar mensagens recentes - tentar múltiplos endpoints
          let messages: any[] = [];
          
          const messageEndpoints = [
            { method: 'POST', url: `/chat/findMessages/${instance.instance_name}`, body: { where: { key: { remoteJid } }, limit: messagesPerChat } },
            { method: 'POST', url: `/message/findMessages/${instance.instance_name}`, body: { where: { key: { remoteJid } }, limit: messagesPerChat } },
            { method: 'GET', url: `/chat/findMessages/${instance.instance_name}/${remoteJid}?limit=${messagesPerChat}`, body: null },
          ];
          
          for (const ep of messageEndpoints) {
            const result = await evolutionRequest(ep.url, {
              method: ep.method,
              ...(ep.body ? { body: JSON.stringify(ep.body) } : {}),
            });
            
            if (result.success) {
              // Log raw response structure for debugging
              const dataKeys = result.data ? (Array.isArray(result.data) ? `Array[${result.data.length}]` : Object.keys(result.data).join(',')) : 'null';
              console.log(`🔍 ${ep.method} ${ep.url} raw structure: ${dataKeys}`);
              
              if (Array.isArray(result.data) && result.data.length > 0) {
                messages = result.data;
                console.log(`✅ ${ep.method} ${ep.url} retornou ${messages.length} msgs`);
                break;
              } else if (result.data?.messages && Array.isArray(result.data.messages) && result.data.messages.length > 0) {
                messages = result.data.messages;
                console.log(`✅ ${ep.method} ${ep.url} retornou ${messages.length} msgs (nested .messages)`);
                break;
              } else if (result.data?.messages?.records && Array.isArray(result.data.messages.records)) {
                messages = result.data.messages.records;
                console.log(`✅ ${ep.method} ${ep.url} retornou ${messages.length} msgs (nested .messages.records)`);
                break;
              } else if (result.data?.records && Array.isArray(result.data.records)) {
                messages = result.data.records;
                console.log(`✅ ${ep.method} ${ep.url} retornou ${messages.length} msgs (nested .records)`);
                break;
              } else if (result.data?.data && Array.isArray(result.data.data)) {
                messages = result.data.data;
                console.log(`✅ ${ep.method} ${ep.url} retornou ${messages.length} msgs (nested .data)`);
                break;
              } else if (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
                // Try extracting messages from any array property
                for (const [k, v] of Object.entries(result.data)) {
                  if (Array.isArray(v) && v.length > 0 && v[0]?.key) {
                    messages = v;
                    console.log(`✅ ${ep.method} ${ep.url} retornou ${messages.length} msgs (property .${k})`);
                    break;
                  }
                }
                if (messages.length > 0) break;
                
                // Last resort: object values with key property
                const possibleMessages = Object.values(result.data).filter(
                  (m: any) => m && typeof m === 'object' && m.key
                );
                if (possibleMessages.length > 0) {
                  messages = possibleMessages;
                  console.log(`✅ ${ep.method} ${ep.url} retornou ${messages.length} msgs (object values)`);
                  break;
                }
              }
            } else {
              console.log(`⚠️ ${ep.method} ${ep.url} falhou:`, result.error?.message || result.status);
            }
          }
          
          if (messages.length === 0) {
            console.log(`⚠️ Nenhum endpoint retornou mensagens para ${remoteJid}`);
          }
          
          console.log(`📨 ${messages.length} mensagens para processar`);
          
          for (const msg of messages) {
            try {
              const key = msg.key;
              if (!key?.id) continue;

              const direction = key.fromMe ? 'outgoing' : 'incoming';
              
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

              let timestamp: string;
              try {
                const ts = msg.messageTimestamp;
                if (ts && !isNaN(Number(ts))) {
                  const num = Number(ts);
                  // If timestamp is in seconds (< year 2100 in seconds), convert
                  timestamp = new Date(num > 1e12 ? num : num * 1000).toISOString();
                } else {
                  timestamp = new Date().toISOString();
                }
              } catch {
                timestamp = new Date().toISOString();
              }

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

          // Atualizar last_message_at
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
