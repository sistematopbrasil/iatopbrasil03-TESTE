import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ✅ Função helper de normalização de telefone
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

// ✅ Função para gerar variantes do telefone (com/sem 9 adicional + mais formatos)
function getPhoneVariants(phone: string): string[] {
  const normalized = normalizePhone(phone);
  const variants: Set<string> = new Set([normalized]);
  
  // Adicionar versão raw (limpa, sem transformação)
  const raw = phone.replace(/\D/g, '');
  variants.add(raw);
  
  // Formato esperado: 55 + DDD(2) + número(8 ou 9)
  if (normalized.startsWith('55') && normalized.length >= 12) {
    const ddd = normalized.slice(2, 4);
    const rest = normalized.slice(4);
    
    // Se tem 9 dígitos no número (total 13), criar variante sem o 9
    if (rest.length === 9 && rest.startsWith('9')) {
      const withoutNine = `55${ddd}${rest.slice(1)}`;
      variants.add(withoutNine);
      // Também sem 55
      variants.add(`${ddd}${rest.slice(1)}`);
    }
    // Se tem 8 dígitos no número (total 12), criar variante com o 9
    else if (rest.length === 8) {
      const withNine = `55${ddd}9${rest}`;
      variants.add(withNine);
      // Também sem 55
      variants.add(`${ddd}9${rest}`);
    }
    
    // Variantes sem código do país (55)
    variants.add(`${ddd}${rest}`);
  }
  
  return Array.from(variants);
}

// ✅ Função para converter base64 para Blob
function base64ToUint8Array(base64: string): Uint8Array {
  // Remove prefix like "data:image/jpeg;base64," if present
  const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryString = atob(cleanBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// ✅ Função para obter extensão do mimetype
function getExtensionFromMimetype(mimetype: string | null): string {
  if (!mimetype) return 'bin';
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'video/quicktime': 'mov',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/opus': 'opus',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  };
  return map[mimetype] || mimetype.split('/')[1] || 'bin';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // ✅ INPUT VALIDATION
    const event = body.event;
    const instanceName = body.instance;
    const data = body.data;

    // Validate required fields
    if (!event || typeof event !== 'string' || event.length > 100) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid event' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!instanceName || typeof instanceName !== 'string' || instanceName.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(instanceName)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid instance' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const logSummary = {
      event,
      instance: instanceName,
      state: data?.state || data?.qrcode?.instance || null,
      hasQrCode: !!data?.qrcode?.base64,
      qrCodeLength: data?.qrcode?.base64?.length || 0,
      timestamp: new Date().toISOString(),
    };
    console.log('🔵 Webhook:', JSON.stringify(logSummary));

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar instância pelo nome
    const { data: instance, error: instanceError } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('*, users!inner(id, organization_id)')
      .eq('instance_name', instanceName)
      .single();

    if (instanceError || !instance) {
      console.log('⚠️ Instância não encontrada:', instanceName);
      return new Response(
        JSON.stringify({ success: true, message: 'Instância não encontrada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalizar evento para lowercase (Evolution API envia em diferentes formatos)
    // Suportar múltiplos formatos: messages.upsert, MESSAGES_UPSERT, messages-upsert, etc.
    const normalizedEvent = event?.toLowerCase()?.replace(/[.\-]/g, '_');
    console.log('📌 Evento:', normalizedEvent, '(original:', event, ')');

    // ✅ TELEMETRIA: Atualizar última atividade do webhook
    const telemetryUpdate: any = {
      last_webhook_at: new Date().toISOString(),
      last_webhook_event: normalizedEvent,
    };
    
    // Se for mensagem (upsert ou set), salvar ID da última mensagem
    if (normalizedEvent === 'messages_upsert' || normalizedEvent === 'messages_set') {
      const messages = data?.messages || [data];
      const firstMessage = messages[0];
      if (firstMessage?.key?.id) {
        telemetryUpdate.last_webhook_message_id = firstMessage.key.id;
      }
    }
    
    await supabaseAdmin
      .from('whatsapp_instances')
      .update(telemetryUpdate)
      .eq('id', instance.id);
    
    console.log('📊 Telemetria atualizada:', telemetryUpdate.last_webhook_event);

    switch (normalizedEvent) {
      case 'qrcode_updated': {
        console.log('📱 QR Code atualizado');
        const qrCode = data?.qrcode?.base64 || data?.base64;
        
        if (qrCode) {
          await supabaseAdmin
            .from('whatsapp_instances')
            .update({
              qr_code: qrCode,
              status: 'connecting',
            })
            .eq('id', instance.id);
          console.log('✅ QR salvo no banco');
        }
        break;
      }

      case 'connection_update': {
        const state = data?.state;
        console.log('🔗 Conexão:', state);
        
        let status: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
        
        if (state === 'open') {
          status = 'connected';
          console.log('✅ CONEXÃO ESTABELECIDA!');
        } else if (state === 'connecting') {
          status = 'connecting';
        } else if (state === 'close') {
          status = 'disconnected';
          console.log('❌ Conexão fechada');
        }

        const updateData: any = {
          status,
          connection_state: { state, timestamp: new Date().toISOString() },
        };

        if (status === 'connected') {
          updateData.last_connected_at = new Date().toISOString();
          updateData.qr_code = null; // Limpar QR ao conectar
        }

        await supabaseAdmin
          .from('whatsapp_instances')
          .update(updateData)
          .eq('id', instance.id);
        
        console.log('✅ Status atualizado:', status);
        break;
      }

      // ✅ TRATAR EVENTOS DE ENVIO DO WHATSAPP (mensagens enviadas pelo app)
      case 'send_message':
      case 'messages_send':
      case 'message_send': {
        console.log('📤 Mensagem enviada detectada (evento do app WhatsApp)');
        // Reutilizar lógica de messages_upsert - setar flag para processar como outgoing
        // O evento já vem com a mensagem, podemos processar diretamente
        const messages = data?.messages || [data];
        for (const message of messages) {
          if (message?.key) {
            // Marcar como fromMe = true se não estiver definido
            if (message.key.fromMe === undefined) {
              message.key.fromMe = true;
            }
          }
        }
        // Continuar para o case messages_upsert (fall-through)
      }

      // ✅ TRATAR messages_set (Evolution API v2 envia mensagens em lote neste evento)
      case 'messages_set':
      case 'messages_upsert':
      case 'message_upsert':
      case 'message':
      case 'messages':
      case 'new_message':
      case 'message_create': {
        console.log('💬 Nova mensagem recebida (evento:', normalizedEvent, ')');
        const messages = data?.messages || [data];
        console.log(`📨 Total de mensagens no payload: ${messages.length}`);
        
        // ✅ EXTRAIR pushName do nível correto do payload
        // Evolution API envia pushName tanto em message.pushName quanto em data.pushName
        const payloadPushName = data?.pushName;
        
        for (const message of messages) {
          try {
            const key = message.key;
            let messageContent = message.message;
            
            // ✅ Log detalhado para debug
            console.log('🔍 Processando mensagem:', { 
              hasKey: !!key, 
              hasMessage: !!messageContent,
              messageId: key?.id,
              fromMe: key?.fromMe,
              remoteJid: key?.remoteJid,
            });
            
            if (!key) {
              console.log('⏭️ Pulando: sem key');
              continue;
            }
            
            // ✅ Unwrap de formatos encapsulados do WhatsApp
            if (!messageContent && message.message) {
              messageContent = message.message;
            }
            
            // Desembrulhar mensagens efêmeras e ViewOnce
            if (messageContent?.ephemeralMessage?.message) {
              console.log('📦 Desembrulhando ephemeralMessage');
              messageContent = messageContent.ephemeralMessage.message;
            }
            if (messageContent?.viewOnceMessage?.message) {
              console.log('📦 Desembrulhando viewOnceMessage');
              messageContent = messageContent.viewOnceMessage.message;
            }
            if (messageContent?.viewOnceMessageV2?.message) {
              console.log('📦 Desembrulhando viewOnceMessageV2');
              messageContent = messageContent.viewOnceMessageV2.message;
            }
            if (messageContent?.viewOnceMessageV2Extension?.message) {
              console.log('📦 Desembrulhando viewOnceMessageV2Extension');
              messageContent = messageContent.viewOnceMessageV2Extension.message;
            }
            if (messageContent?.documentWithCaptionMessage?.message) {
              console.log('📦 Desembrulhando documentWithCaptionMessage');
              messageContent = messageContent.documentWithCaptionMessage.message;
            }
            
            if (!messageContent) {
              console.log('⏭️ Pulando: sem messageContent após unwrap');
              continue;
            }
            
            // ✅ Processar mensagens enviadas pelo app do WhatsApp (fromMe = true)
            // Isso permite que mensagens enviadas fora do CRM apareçam no histórico
            const direction = key.fromMe ? 'outgoing' : 'incoming';
            console.log(`📤 Direção: ${direction} (fromMe: ${key.fromMe})`);
            
            const remoteJid = key.remoteJid;
            
            // ✅ Ignorar grupos explicitamente
            if (remoteJid?.endsWith('@g.us')) {
              console.log('⏭️ Pulando: mensagem de grupo');
              continue;
            }
            
            const rawPhone = remoteJid?.replace('@s.whatsapp.net', '').replace('@g.us', '');
            
            if (!rawPhone || !/^\d{8,15}$/.test(rawPhone)) {
              console.log('⏭️ Pulando: telefone inválido:', rawPhone?.substring(0, 20));
              continue;
            }

            // ✅ NORMALIZAR TELEFONE E GERAR VARIANTES
            const normalizedPhone = normalizePhone(rawPhone);
            const phoneVariants = getPhoneVariants(rawPhone);
            
            console.log('📱 Telefone:', normalizedPhone, 'Variantes:', phoneVariants);
            
            // Determinar tipo e conteúdo da mensagem
            let type = 'text';
            let content = '';
            let mediaUrl: string | null = null;
            let mediaMimetype: string | null = null;
            let mediaFilename: string | null = null;
            let mediaSize: number | null = null;
            
            if (messageContent.conversation) {
              content = messageContent.conversation;
            } else if (messageContent.extendedTextMessage?.text) {
              content = messageContent.extendedTextMessage.text;
            } else if (messageContent.imageMessage) {
              type = 'image';
              content = messageContent.imageMessage.caption || '';
              mediaMimetype = messageContent.imageMessage.mimetype;
              mediaSize = messageContent.imageMessage.fileLength;
            } else if (messageContent.videoMessage) {
              type = 'video';
              content = messageContent.videoMessage.caption || '';
              mediaMimetype = messageContent.videoMessage.mimetype;
              mediaSize = messageContent.videoMessage.fileLength;
            } else if (messageContent.audioMessage) {
              type = 'audio';
              mediaMimetype = messageContent.audioMessage.mimetype;
              mediaSize = messageContent.audioMessage.fileLength;
            } else if (messageContent.documentMessage) {
              type = 'document';
              mediaFilename = messageContent.documentMessage.fileName;
              mediaMimetype = messageContent.documentMessage.mimetype;
              mediaSize = messageContent.documentMessage.fileLength;
            } else if (messageContent.stickerMessage) {
              type = 'sticker';
              mediaMimetype = messageContent.stickerMessage.mimetype;
            } else if (messageContent.locationMessage) {
              type = 'location';
              content = JSON.stringify({
                latitude: messageContent.locationMessage.degreesLatitude,
                longitude: messageContent.locationMessage.degreesLongitude,
              });
            } else if (messageContent.contactMessage) {
              type = 'contact';
              content = messageContent.contactMessage.displayName;
            } else {
              // ✅ Tipo não reconhecido - logar e continuar mesmo assim
              console.log('⚠️ Tipo de mensagem não reconhecido:', Object.keys(messageContent));
              type = 'text';
              content = '[Mensagem não suportada]';
            }
            
            console.log('📝 Tipo detectado:', type, '| Conteúdo:', content?.substring(0, 50) || '(vazio)');

          // ✅ BUSCAR MÍDIA SE FOR MENSAGEM DE MÍDIA
          if (['image', 'video', 'audio', 'document', 'sticker'].includes(type)) {
            try {
              const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
              const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
              
              if (evolutionApiUrl && evolutionApiKey) {
                console.log('📥 Baixando mídia do tipo:', type);
                
                // Chamar API para obter mídia em base64
                const mediaResponse = await fetch(`${evolutionApiUrl}/chat/getBase64FromMediaMessage/${instanceName}`, {
                  method: 'POST',
                  headers: {
                    'apikey': evolutionApiKey,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ 
                    message: {
                      key: key,
                      message: messageContent,
                    },
                    convertToMp4: type === 'audio' ? false : true, // Não converter áudio
                  }),
                });
                
                if (mediaResponse.ok) {
                  const mediaData = await mediaResponse.json();
                  const base64Data = mediaData.base64;
                  
                  if (base64Data) {
                    console.log('✅ Mídia recebida, fazendo upload...');
                    
                    // Converter base64 para Uint8Array
                    const fileBytes = base64ToUint8Array(base64Data);
                    const extension = getExtensionFromMimetype(mediaMimetype);
                    const fileName = `messages/${instanceName}/${Date.now()}_${key.id}.${extension}`;
                    
                    // Upload para Supabase Storage
                    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
                      .from('crm-media')
                      .upload(fileName, fileBytes, {
                        contentType: mediaMimetype || 'application/octet-stream',
                        upsert: false,
                      });
                    
                    if (uploadError) {
                      console.error('⚠️ Erro no upload:', uploadError);
                    } else {
                      // Obter URL pública
                      const { data: { publicUrl } } = supabaseAdmin.storage
                        .from('crm-media')
                        .getPublicUrl(fileName);
                      
                      mediaUrl = publicUrl;
                      console.log('✅ Mídia salva:', mediaUrl);
                    }
                  } else {
                    console.log('⚠️ Mídia vazia na resposta');
                  }
                } else {
                  const errorText = await mediaResponse.text();
                  console.error('⚠️ Erro ao baixar mídia:', mediaResponse.status, errorText);
                }
              } else {
                console.log('⚠️ Evolution API credentials not configured');
              }
            } catch (mediaError) {
              console.error('⚠️ Erro ao processar mídia:', mediaError);
            }
          }

          // ✅ BUSCAR LEAD POR TELEFONE COM VARIANTES (filtrando por organização E consultor)
          let lead = null;
          
          // PRIORIDADE 1: Lead do mesmo consultor
          for (const variant of phoneVariants) {
            const { data: foundLead } = await supabaseAdmin
              .from('quiz_submissions_new')
              .select('id, name, organization_id, pipeline_stage_id, phone, consultant_id, completion_percentage')
              .eq('phone', variant)
              .eq('organization_id', instance.organization_id)
              .eq('consultant_id', instance.user_id) // ✅ Priorizar lead do mesmo consultor
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (foundLead) {
              lead = foundLead;
              console.log('✅ Lead encontrado do mesmo consultor:', variant, '| completion:', foundLead.completion_percentage);
              break;
            }
          }
          
          // PRIORIDADE 2: Se não encontrou do mesmo consultor, buscar qualquer lead da organização
          // MAS não vamos usar - vamos criar um novo para o consultor atual
          if (!lead) {
            console.log('📌 Nenhum lead do consultor atual encontrado, verificando se existe de outro consultor...');
          }
          
          // ✅ FALLBACK: busca por últimos 8 dígitos se não encontrou (mas só do mesmo consultor)
          if (!lead) {
            const last8 = normalizedPhone.slice(-8);
            console.log('🔍 Tentando busca parcial com últimos 8 dígitos:', last8);
            
            const { data: foundLead } = await supabaseAdmin
              .from('quiz_submissions_new')
              .select('id, name, organization_id, pipeline_stage_id, phone, consultant_id, completion_percentage')
              .eq('organization_id', instance.organization_id)
              .eq('consultant_id', instance.user_id) // ✅ Só do mesmo consultor
              .like('phone', `%${last8}`)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (foundLead) {
              lead = foundLead;
              console.log('✅ Lead encontrado via busca parcial! Phone:', foundLead.phone, '| completion:', foundLead.completion_percentage);
            }
          }

          // ✅ CRIAR LEAD AUTOMATICAMENTE SE NÃO EXISTIR (para qualquer direção)
          if (!lead) {
            console.log('🆕 Criando lead automaticamente para:', normalizedPhone);
            
            // Buscar primeiro quadro do pipeline
            const { data: stages } = await supabaseAdmin
              .from('pipeline_stages')
              .select('id')
              .eq('organization_id', instance.organization_id)
              .order('order_index', { ascending: true })
              .limit(1);
            
            const firstStageId = stages?.[0]?.id || null;
            
            // ✅ Para mensagens outgoing, NÃO usar pushName (seria o nome do consultor)
            // Para mensagens incoming, usar pushName como nome do contato
            // pushName pode vir no message ou no data (nível do payload)
            const contactPushName = message.pushName || payloadPushName || message.verifiedBizName;
            const leadName = direction === 'incoming' 
              ? (contactPushName || normalizedPhone) 
              : normalizedPhone;
            
            console.log('📛 Nome do contato:', { contactPushName, leadName, direction });
            
            // Criar lead automaticamente
            const { data: newLead, error: leadError } = await supabaseAdmin
              .from('quiz_submissions_new')
              .insert({
                name: leadName,
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
              .select('id, name, organization_id, pipeline_stage_id, phone, consultant_id')
              .single();
            
            if (!leadError && newLead) {
              lead = newLead;
              console.log('✅ Lead criado automaticamente:', lead.id, '| Nome:', lead.name, '| Direção:', direction);
            } else {
              console.warn('⚠️ Erro ao criar lead automaticamente:', leadError);
            }
          } else {
            // ✅ REPARAR lead existente se não tiver pipeline_stage_id ou consultant_id
            const needsRepair = !lead.pipeline_stage_id || !lead.consultant_id;
            
            // ✅ ATUALIZAR NOME: Se o nome atual for só número e temos pushName, atualizar
            const contactPushName = message.pushName || payloadPushName || message.verifiedBizName;
            const currentNameIsOnlyNumber = lead.name && /^\d+$/.test(lead.name);
            const shouldUpdateName = direction === 'incoming' && contactPushName && currentNameIsOnlyNumber;
            
            if (needsRepair || shouldUpdateName) {
              console.log('🔧 Reparando lead existente:', lead.id, { needsRepair, shouldUpdateName, contactPushName });
              
              // Buscar primeiro quadro se necessário
              let repairStageId = lead.pipeline_stage_id;
              if (!repairStageId) {
                const { data: stages } = await supabaseAdmin
                  .from('pipeline_stages')
                  .select('id')
                  .eq('organization_id', instance.organization_id)
                  .order('order_index', { ascending: true })
                  .limit(1);
                repairStageId = stages?.[0]?.id || null;
              }
              
              const updateData: any = {};
              if (!lead.pipeline_stage_id && repairStageId) {
                updateData.pipeline_stage_id = repairStageId;
              }
              if (!lead.consultant_id) {
                updateData.consultant_id = instance.user_id;
              }
              // ✅ Atualizar nome se antes era só número
              if (shouldUpdateName) {
                updateData.name = contactPushName;
                console.log('📛 Atualizando nome do lead de', lead.name, 'para', contactPushName);
              }
              
              if (Object.keys(updateData).length > 0) {
                await supabaseAdmin
                  .from('quiz_submissions_new')
                  .update(updateData)
                  .eq('id', lead.id);
                console.log('✅ Lead reparado:', updateData);
                
                // Atualizar objeto local
                if (shouldUpdateName) {
                  lead.name = contactPushName;
                }
              }
            }
          }
          
          // ✅ BUSCAR CONVERSA EXISTENTE COM VARIANTES
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
              console.log('✅ Conversa encontrada com variante:', variant);
              break;
            }
          }
          
          if (!conversation) {
            // ✅ CRIAR CONVERSA COM LEAD VINCULADO AUTOMATICAMENTE
            const { data: newConv, error: convError } = await supabaseAdmin
              .from('crm_conversations')
              .insert({
                instance_id: instance.id,
                user_id: instance.user_id,
                organization_id: instance.organization_id,
                contact_phone: normalizedPhone,
                contact_name: lead?.name || message.pushName || payloadPushName || normalizedPhone,
                contact_avatar: message.verifiedBizName ? null : undefined,
                lead_id: lead?.id || null,
                status: 'open',
              })
              .select()
              .single();
            
            if (convError) {
              console.error('❌ Erro ao criar conversa:', convError);
              continue;
            }
            
            conversation = newConv;
            console.log('✅ Nova conversa criada:', conversation.id);
          } else {
            // ✅ VINCULAR LEAD À CONVERSA EXISTENTE SE NÃO TIVER
            const contactPushName = message.pushName || payloadPushName || message.verifiedBizName;
            const currentConvNameIsOnlyNumber = conversation.contact_name && /^\d+$/.test(conversation.contact_name);
            
            const updateConvData: any = {};
            
            if (lead && !conversation.lead_id) {
              updateConvData.lead_id = lead.id;
              updateConvData.contact_name = lead.name || conversation.contact_name;
            }

            // ✅ Atualizar nome da conversa se atual for só número e temos pushName
            if (direction === 'incoming' && contactPushName && currentConvNameIsOnlyNumber) {
              updateConvData.contact_name = contactPushName;
              console.log('📛 Atualizando nome da conversa de', conversation.contact_name, 'para', contactPushName);
            }
            
            if (Object.keys(updateConvData).length > 0) {
              await supabaseAdmin
                .from('crm_conversations')
                .update(updateConvData)
                .eq('id', conversation.id);
            }
          }
          
          // ✅ Inserir mensagem com instance_id para unicidade por instância
          // ✅ PRESERVAR metadata.sent_by_ai se já existir no banco (evita sobrescrever flag da IA)
          let finalMetadata: any = message;
          if (direction === 'outgoing') {
            const { data: existingMsg } = await supabaseAdmin
              .from('crm_messages')
              .select('metadata')
              .eq('instance_id', instance.id)
              .eq('message_id', key.id)
              .maybeSingle();
            if (existingMsg?.metadata?.sent_by_ai) {
              finalMetadata = { ...message, sent_by_ai: true, ai_agent: existingMsg.metadata.ai_agent };
            }
          }

          const messageData = {
            conversation_id: conversation.id,
            instance_id: instance.id,
            message_id: key.id,
            direction,
            type,
            content,
            media_url: mediaUrl,
            media_mimetype: mediaMimetype,
            media_filename: mediaFilename,
            media_size: mediaSize,
            status: direction === 'outgoing' ? 'sent' : 'delivered',
            timestamp: (() => {
              try {
                const ts = message.messageTimestamp;
                if (ts && !isNaN(Number(ts))) {
                  const num = Number(ts);
                  return new Date(num > 1e12 ? num : num * 1000).toISOString();
                }
                return new Date().toISOString();
              } catch { return new Date().toISOString(); }
            })(),
            metadata: finalMetadata,
          };
          
          console.log('📝 Inserindo mensagem:', { 
            instance_id: instance.id,
            conversation_id: conversation.id, 
            message_id: key.id, 
            type, 
            content_preview: content?.substring(0, 50) 
          });
          
          // ✅ Usar upsert para evitar erros de duplicata - unique é (instance_id, message_id)
          const { error: msgError, data: insertedMsg } = await supabaseAdmin
            .from('crm_messages')
            .upsert(messageData, { 
              onConflict: 'instance_id,message_id',
              ignoreDuplicates: false 
            })
            .select('id')
            .single();
          
          if (msgError) {
            console.error('❌ Erro ao inserir/atualizar mensagem:', msgError);
            console.error('📌 Dados da mensagem:', messageData);
          } else {
            console.log('✅ Mensagem inserida/atualizada:', insertedMsg?.id, 'Tipo:', type, 'URL:', mediaUrl);
            
            // Atualizar last_contact_at para mensagens recebidas
            if (conversation.lead_id && direction === 'incoming') {
              try {
                await supabaseAdmin
                  .from('quiz_submissions_new')
                  .update({ 
                    last_contact_at: new Date().toISOString()
                  })
                  .eq('id', conversation.lead_id);
                console.log('📍 last_contact_at atualizado para lead:', conversation.lead_id);
              } catch (updateError) {
                console.warn('⚠️ Erro ao atualizar last_contact_at:', updateError);
              }
            }

            // 🤖 AGENTE IA: Trigger para mensagens incoming
            if (direction === 'incoming') {
              try {
                const supabaseUrl = Deno.env.get('SUPABASE_URL');
                const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
                
                if (supabaseUrl && supabaseAnonKey) {
                  console.log('🤖 Disparando AI Agent (fire-and-forget)...');
                  // Fire-and-forget: não bloqueia o webhook
                  fetch(`${supabaseUrl}/functions/v1/ai-agent-respond`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${supabaseAnonKey}`,
                    },
                    body: JSON.stringify({
                      conversation_id: conversation.id,
                      instance_id: instance.id,
                      user_id: instance.user_id,
                      message: content,
                      message_type: type,
                      media_url: mediaUrl,
                      instance_name: instanceName,
                      contact_phone: normalizedPhone,
                    }),
                  }).catch(e => console.warn('⚠️ AI Agent fire-and-forget error:', e));
                }
              } catch (aiError) {
                console.warn('⚠️ Erro ao disparar AI Agent:', aiError);
              }
            }

            // 🛑 INTERVENÇÃO HUMANA: Detectar mensagem manual do consultor
            if (direction === 'outgoing') {
              try {
                // ✅ Verificar se a mensagem foi enviada pela IA (checando metadata final)
                let isAIMessage = finalMetadata?.sent_by_ai === true;
                
                // ✅ Fallback 1: Verificar prefixo "ai-" no message_id
                if (!isAIMessage && key.id && (key.id.startsWith('ai-') || key.id.startsWith('ai-greeting-'))) {
                  isAIMessage = true;
                  console.log('✅ Mensagem da IA detectada via prefixo message_id:', key.id);
                }
                
                // ✅ Fallback 2: Verificar se o message_id está na lista de IDs da IA OU janela temporal de 45s
                if (!isAIMessage) {
                  const { data: aiStateCheck } = await supabaseAdmin
                    .from('ai_conversation_state')
                    .select('last_ai_message_at, is_active, last_ai_message_ids')
                    .eq('conversation_id', conversation.id)
                    .maybeSingle();
                  
                  // ✅ Check 2a: Verificar se o message_id está na lista de IDs conhecidos da IA
                  if (aiStateCheck?.last_ai_message_ids && Array.isArray(aiStateCheck.last_ai_message_ids)) {
                    if (aiStateCheck.last_ai_message_ids.includes(key.id)) {
                      isAIMessage = true;
                      console.log(`✅ Mensagem da IA detectada via lista de IDs conhecidos: ${key.id}`);
                    }
                  }
                  
                  // ✅ Check 2b: Janela temporal ampliada para 45 segundos (as partes demoram)
                  if (!isAIMessage && aiStateCheck?.is_active && aiStateCheck?.last_ai_message_at) {
                    const lastAiTime = new Date(aiStateCheck.last_ai_message_at).getTime();
                    const now = Date.now();
                    const diffSeconds = (now - lastAiTime) / 1000;
                    
                    if (diffSeconds <= 45) {
                      isAIMessage = true;
                      console.log(`✅ Mensagem provavelmente da IA (enviou há ${diffSeconds.toFixed(1)}s, janela 45s), NÃO pausando`);
                    }
                  }
                }
                
                if (!isAIMessage) {
                  // Buscar config do consultor para saber tempo de pausa
                  const { data: aiConfig } = await supabaseAdmin
                    .from('ai_agent_configs')
                    .select('pause_on_human_minutes')
                    .eq('user_id', instance.user_id)
                    .maybeSingle();

                  if (aiConfig) {
                    const pauseMinutes = aiConfig.pause_on_human_minutes || 120;
                    const pausedUntil = new Date(Date.now() + pauseMinutes * 60 * 1000).toISOString();

                    console.log(`🛑 Intervenção humana detectada. Pausando IA por ${pauseMinutes} min`);

                    await supabaseAdmin
                      .from('ai_conversation_state')
                      .upsert({
                        conversation_id: conversation.id,
                        user_id: instance.user_id,
                        paused_until: pausedUntil,
                        paused_by: 'intervention',
                        is_active: true,
                      }, { onConflict: 'conversation_id' });
                  }
                } else {
                  console.log('✅ Mensagem da IA detectada, NÃO pausando');
                }
              } catch (interventionError) {
                console.warn('⚠️ Erro na detecção de intervenção:', interventionError);
              }
            }
          }
          } catch (messageError) {
            // ✅ Capturar erro de uma mensagem sem interromper as demais
            console.error('❌ Erro ao processar mensagem individual:', messageError);
            console.error('📌 Message key:', message?.key);
          }
        }
        break;
      }

      case 'messages_update':
      case 'message_ack':
      case 'messages_ack': {
        // Handle ACK events for message delivery/read status
        const updates = Array.isArray(data) ? data : [data];
        
        for (const update of updates) {
          // Different event formats from Evolution API
          const messageId = update.key?.id || update.id?.id || update.messageId;
          const ack = update.update?.status || update.ack || update.status;
          
          if (!messageId) continue;
          
          let newStatus = 'sent';
          // Evolution API ACK codes: 1=sent, 2=delivered, 3=read, 4=played
          if (ack === 'DELIVERY_ACK' || ack === 2 || ack === 'delivered') {
            newStatus = 'delivered';
          } else if (ack === 'READ' || ack === 3 || ack === 'read') {
            newStatus = 'read';
          } else if (ack === 'PLAYED' || ack === 4 || ack === 'played') {
            newStatus = 'read';
          } else if (ack === 'SERVER_ACK' || ack === 1 || ack === 'sent') {
            newStatus = 'sent';
          }
          
          const { error: updateError } = await supabaseAdmin
            .from('crm_messages')
            .update({ status: newStatus })
            .eq('message_id', messageId);
            
          if (!updateError) {
            console.log(`📬 Status atualizado: ${messageId} -> ${newStatus}`);
          }
        }
        break;
      }

      default:
        console.log('ℹ️ Evento não tratado:', event, '| Payload keys:', data ? Object.keys(data).join(',') : 'null');
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Erro no webhook:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});