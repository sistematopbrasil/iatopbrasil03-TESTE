import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getIntegrationValue } from '../_shared/integration-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

let EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || '';
let EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '';

async function loadEvolutionCreds(supabaseAdmin: any) {
  const url = await getIntegrationValue('EVOLUTION_API_URL', supabaseAdmin);
  const key = await getIntegrationValue('EVOLUTION_API_KEY', supabaseAdmin);
  if (url) EVOLUTION_API_URL = url;
  if (key) EVOLUTION_API_KEY = key;
}


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
        id: c.remoteJid || c.id,
        remoteJid: c.remoteJid || c.id,
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
        id: c.remoteJid || c.id,
        remoteJid: c.remoteJid || c.id,
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
    await loadEvolutionCreds(supabaseAdmin);

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
      // ✅ Guard: pular sync se instância conectou há menos de 60 segundos (primeira conexão)
      if (instance.last_connected_at) {
        const connectedAt = new Date(instance.last_connected_at).getTime();
        const now = Date.now();
        const secondsSinceConnection = (now - connectedAt) / 1000;
        if (secondsSinceConnection < 60) {
          console.log(`⏭️ Pulando sync da instância ${instance.instance_name} - conectada há apenas ${Math.round(secondsSinceConnection)}s (< 60s)`);
          continue;
        }
      }
      
      console.log(`🔄 Sincronizando instância: ${instance.instance_name}`);
      
      // ✅ Usar função que tenta múltiplos endpoints
      let chats = (await findChats(instance.instance_name)).slice(0, limit);
      
      // Log raw data dos primeiros 3 chats para diagnóstico
      if (chats.length > 0) {
        console.log('📋 Raw chats (primeiros 3):', JSON.stringify(chats.slice(0, 3)).substring(0, 800));
      }
      
      console.log(`📬 ${chats.length} chats encontrados`);

      // Filtrar chats válidos primeiro
      const validChats = chats.filter(chat => {
        // ✅ CRITICAL FIX: Prefer remoteJid (contains @s.whatsapp.net) over id (which can be a CUID)
        const remoteJid = (chat.remoteJid && chat.remoteJid.includes('@s.whatsapp.net')) 
          ? chat.remoteJid 
          : (chat.id && chat.id.includes('@s.whatsapp.net') ? chat.id : null);
        if (!remoteJid || remoteJid.endsWith('@g.us')) return false;
        const rawPhone = remoteJid.replace('@s.whatsapp.net', '');
        const normalizedPhone = normalizePhone(rawPhone);
        return normalizedPhone.length >= 10 && normalizedPhone.length <= 15;
      });

      console.log(`✅ ${validChats.length} chats válidos de ${chats.length} total`);

      // ✅ FALLBACK: Se findChats não retornou chats válidos, buscar mensagens diretamente
      if (validChats.length === 0) {
        console.log('🔄 Fallback: buscando mensagens recentes diretamente via /chat/findMessages...');
        
        const fallbackEndpoints = [
          { method: 'POST', url: `/chat/findMessages/${instance.instance_name}`, body: { where: {}, limit: 100 } },
          { method: 'POST', url: `/message/findMessages/${instance.instance_name}`, body: { where: {}, limit: 100 } },
          { method: 'POST', url: `/chat/findMessages/${instance.instance_name}`, body: {} },
        ];

        let allMessages: any[] = [];
        for (const ep of fallbackEndpoints) {
          try {
            const result = await evolutionRequest(ep.url, {
              method: ep.method,
              body: JSON.stringify(ep.body),
            });
            
            if (result.success) {
              const rawData = result.data;
              console.log(`📋 Fallback ${ep.url} raw structure:`, 
                Array.isArray(rawData) ? `Array[${rawData.length}]` : (rawData ? Object.keys(rawData).join(',') : 'null'));
              
              if (Array.isArray(rawData) && rawData.length > 0) {
                allMessages = rawData;
              } else if (rawData?.messages && Array.isArray(rawData.messages)) {
                allMessages = rawData.messages;
              } else if (rawData?.data && Array.isArray(rawData.data)) {
                allMessages = rawData.data;
              } else if (rawData?.records && Array.isArray(rawData.records)) {
                allMessages = rawData.records;
              }
              
              if (allMessages.length > 0) {
                console.log(`✅ Fallback encontrou ${allMessages.length} mensagens`);
                console.log('📋 Primeira mensagem (raw):', JSON.stringify(allMessages[0]).substring(0, 500));
                break;
              }
            } else {
              console.log(`⚠️ Fallback ${ep.url} falhou:`, result.error?.message || result.status);
            }
          } catch (fallbackErr: any) {
            console.warn(`⚠️ Fallback ${ep.url} erro:`, fallbackErr?.message);
          }
        }

        // Extrair remoteJids únicos das mensagens
        if (allMessages.length > 0) {
          const jidSet = new Set<string>();
          for (const msg of allMessages) {
            const jid = msg?.key?.remoteJid || msg?.remoteJid;
            if (jid && jid.endsWith('@s.whatsapp.net') && !jid.startsWith('status@')) {
              jidSet.add(jid);
            }
          }
          
          console.log(`📱 ${jidSet.size} remoteJids únicos extraídos das mensagens`);
          
          // Converter JIDs em chats sintéticos
          for (const jid of jidSet) {
            const rawPhone = jid.replace('@s.whatsapp.net', '');
            const normalizedPhone = normalizePhone(rawPhone);
            if (normalizedPhone.length >= 10 && normalizedPhone.length <= 15) {
              // Buscar nome do contato a partir das mensagens
              const contactMsg = allMessages.find((m: any) => 
                (m?.key?.remoteJid === jid || m?.remoteJid === jid) && m?.pushName
              );
              validChats.push({
                id: jid,
                remoteJid: jid,
                name: contactMsg?.pushName || rawPhone,
                pushName: contactMsg?.pushName || rawPhone,
              });
            }
          }
          
          console.log(`📱 ${validChats.length} chats válidos após fallback`);
        }
      }

      for (const chat of validChats) {
        try {
          // ✅ CRITICAL FIX: Prefer remoteJid (contains @s.whatsapp.net) over id (which can be a CUID)
          const remoteJid = (chat.remoteJid && chat.remoteJid.includes('@s.whatsapp.net')) 
            ? chat.remoteJid 
            : (chat.id && chat.id.includes('@s.whatsapp.net') ? chat.id : null);
          if (!remoteJid || remoteJid.endsWith('@g.us')) continue;

          const rawPhone = remoteJid.replace('@s.whatsapp.net', '');
          const normalizedPhone = normalizePhone(rawPhone);
          
          // Garantir que tem código de país para números de 10-11 dígitos
          const phoneForStorage = normalizedPhone.length <= 11 ? `55${normalizedPhone}` : normalizedPhone;
          
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
            console.log(`🆕 Criando lead automaticamente para: ${phoneForStorage}`);
            
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
                name: chat.name || chat.pushName || phoneForStorage,
                phone: phoneForStorage,
                organization_id: instance.organization_id,
                consultant_id: instance.user_id,
                pipeline_stage_id: firstStageId,
                stage: 'novo',
                temperature: 'warm',
                temperature_override: true, // ✅ Lead WhatsApp começa morno (engajamento ativo)
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
                contact_phone: phoneForStorage,
                contact_name: chat.name || chat.pushName || lead?.name || phoneForStorage,
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
            
            // ✅ Tentar com formato @lid (WhatsApp Business API alternativo)
            const rawPhoneForLid = remoteJid.replace('@s.whatsapp.net', '');
            const remoteJidAlt = `${rawPhoneForLid}@lid`;
            console.log(`🔄 Tentando formato alternativo @lid: ${remoteJidAlt}`);
            
            const altResult = await evolutionRequest(`/chat/findMessages/${instance.instance_name}`, {
              method: 'POST',
              body: JSON.stringify({ where: { key: { remoteJid: remoteJidAlt } }, limit: messagesPerChat }),
            });
            
            if (altResult.success) {
              const altData = altResult.data;
              const altStructure = Array.isArray(altData) ? `Array[${altData.length}]` : (altData ? Object.keys(altData).join(',') : 'null');
              console.log(`📋 @lid response structure: ${altStructure}`);
              
              if (Array.isArray(altData) && altData.length > 0) {
                messages = altData;
                console.log(`✅ @lid retornou ${messages.length} mensagens`);
              } else if (altData?.messages && Array.isArray(altData.messages) && altData.messages.length > 0) {
                messages = altData.messages;
                console.log(`✅ @lid retornou ${messages.length} mensagens (nested)`);
              }
            } else {
              console.log(`⚠️ @lid também falhou:`, altResult.error?.message || altResult.status);
            }
          }
          
          console.log(`📨 ${messages.length} mensagens para processar`);
          
          // Filter messages: only import messages AFTER the instance was connected (not created)
          const cutoffDate = instance.last_connected_at || instance.created_at || new Date().toISOString();
          const instanceCutoff = new Date(cutoffDate).getTime();
          console.log(`🕐 Filtro temporal: ignorando mensagens antes de ${cutoffDate} (last_connected_at: ${instance.last_connected_at || 'null'})`);
          
          for (const msg of messages) {
            try {
              const key = msg.key;
              if (!key?.id) continue;
              
              // Skip messages older than connection time
              const msgTs = msg.messageTimestamp ? Number(msg.messageTimestamp) : 0;
              const msgTime = msgTs > 1e12 ? msgTs : msgTs * 1000;
              if (msgTime > 0 && msgTime < instanceCutoff) {
                continue;
              }

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
