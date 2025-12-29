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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // ✅ LOG SANITIZADO - sem base64 gigante
    const event = body.event;
    const instanceName = body.instance;
    const data = body.data;
    
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
    const normalizedEvent = event?.toLowerCase()?.replace('.', '_');
    console.log('📌 Evento:', normalizedEvent);

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

      case 'messages_upsert': {
        console.log('💬 Nova mensagem');
        
        const messages = data?.messages || [data];
        
        for (const message of messages) {
          const key = message.key;
          const messageContent = message.message;
          
          if (!key || !messageContent) continue;
          
          // Ignorar mensagens enviadas por nós
          if (key.fromMe) continue;
          
          const remoteJid = key.remoteJid;
          const rawPhone = remoteJid?.replace('@s.whatsapp.net', '').replace('@g.us', '');
          
          if (!rawPhone) continue;

          // ✅ NORMALIZAR TELEFONE
          const normalizedPhone = normalizePhone(rawPhone);
          
          // Determinar tipo e conteúdo da mensagem
          let type = 'text';
          let content = '';
          let mediaUrl = null;
          let mediaMimetype = null;
          let mediaFilename = null;
          
          if (messageContent.conversation) {
            content = messageContent.conversation;
          } else if (messageContent.extendedTextMessage?.text) {
            content = messageContent.extendedTextMessage.text;
          } else if (messageContent.imageMessage) {
            type = 'image';
            content = messageContent.imageMessage.caption || '';
            mediaMimetype = messageContent.imageMessage.mimetype;
          } else if (messageContent.videoMessage) {
            type = 'video';
            content = messageContent.videoMessage.caption || '';
            mediaMimetype = messageContent.videoMessage.mimetype;
          } else if (messageContent.audioMessage) {
            type = 'audio';
            mediaMimetype = messageContent.audioMessage.mimetype;
          } else if (messageContent.documentMessage) {
            type = 'document';
            mediaFilename = messageContent.documentMessage.fileName;
            mediaMimetype = messageContent.documentMessage.mimetype;
          } else if (messageContent.stickerMessage) {
            type = 'sticker';
          } else if (messageContent.locationMessage) {
            type = 'location';
            content = JSON.stringify({
              latitude: messageContent.locationMessage.degreesLatitude,
              longitude: messageContent.locationMessage.degreesLongitude,
            });
          } else if (messageContent.contactMessage) {
            type = 'contact';
            content = messageContent.contactMessage.displayName;
          }

          // ✅ BUSCAR LEAD POR TELEFONE NORMALIZADO
          const { data: lead, error: leadError } = await supabaseAdmin
            .from('quiz_submissions_new')
            .select('id, name, organization_id, pipeline_stage_id')
            .eq('phone', normalizedPhone)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (leadError) {
            console.error('❌ Erro ao buscar lead:', leadError);
          }
          
          // Buscar ou criar conversa COM TELEFONE NORMALIZADO
          let { data: conversation } = await supabaseAdmin
            .from('crm_conversations')
            .select('*')
            .eq('instance_id', instance.id)
            .eq('contact_phone', normalizedPhone)
            .single();
          
          if (!conversation) {
            // ✅ CRIAR CONVERSA COM LEAD VINCULADO AUTOMATICAMENTE
            const { data: newConv, error: convError } = await supabaseAdmin
              .from('crm_conversations')
              .insert({
                instance_id: instance.id,
                user_id: instance.user_id,
                organization_id: instance.organization_id,
                contact_phone: normalizedPhone,
                contact_name: lead?.name || message.pushName || normalizedPhone,
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
          } else {
            // ✅ VINCULAR LEAD À CONVERSA EXISTENTE SE NÃO TIVER
            if (lead && !conversation.lead_id) {
              await supabaseAdmin
                .from('crm_conversations')
                .update({ 
                  lead_id: lead.id,
                  contact_name: lead.name || conversation.contact_name,
                })
                .eq('id', conversation.id);
            }

            // Atualizar nome do contato se disponível
            if (message.pushName && message.pushName !== conversation.contact_name && !lead?.name) {
              await supabaseAdmin
                .from('crm_conversations')
                .update({ contact_name: message.pushName })
                .eq('id', conversation.id);
            }
          }
          
          // Verificar se mensagem já existe
          const { data: existingMsg } = await supabaseAdmin
            .from('crm_messages')
            .select('id')
            .eq('message_id', key.id)
            .single();
          
          if (existingMsg) continue;
          
          // Inserir mensagem
          const { error: msgError } = await supabaseAdmin
            .from('crm_messages')
            .insert({
              conversation_id: conversation.id,
              message_id: key.id,
              direction: 'incoming',
              type,
              content,
              media_url: mediaUrl,
              media_mimetype: mediaMimetype,
              media_filename: mediaFilename,
              status: 'delivered',
              timestamp: new Date(message.messageTimestamp * 1000).toISOString(),
              metadata: message,
            });
          
          if (!msgError) {
            // Mover lead para "Primeiro Contato" se estiver no primeiro quadro
            if (conversation.lead_id) {
              try {
                const { data: stages } = await supabaseAdmin
                  .from('pipeline_stages')
                  .select('id, order_index')
                  .eq('organization_id', instance.organization_id)
                  .order('order_index', { ascending: true })
                  .limit(2);

                if (stages && stages.length >= 2) {
                  const firstStageId = stages[0].id;
                  const secondStageId = stages[1].id;

                  const { data: leadData } = await supabaseAdmin
                    .from('quiz_submissions_new')
                    .select('pipeline_stage_id')
                    .eq('id', conversation.lead_id)
                    .single();

                  if (leadData && leadData.pipeline_stage_id === firstStageId) {
                    await supabaseAdmin
                      .from('quiz_submissions_new')
                      .update({ 
                        pipeline_stage_id: secondStageId,
                        stage: 'contatado',
                        last_contact_at: new Date().toISOString()
                      })
                      .eq('id', conversation.lead_id);
                  }
                }
              } catch (moveError) {
                console.warn('⚠️ Erro ao mover lead:', moveError);
              }
            }
          }
        }
        break;
      }

      case 'messages_update': {
        const updates = data || [];
        
        for (const update of updates) {
          const messageId = update.key?.id;
          const status = update.update?.status;
          
          if (!messageId || !status) continue;
          
          let newStatus = 'sent';
          if (status === 'DELIVERY_ACK' || status === 2) {
            newStatus = 'delivered';
          } else if (status === 'READ' || status === 3) {
            newStatus = 'read';
          } else if (status === 'PLAYED' || status === 4) {
            newStatus = 'read';
          }
          
          await supabaseAdmin
            .from('crm_messages')
            .update({ status: newStatus })
            .eq('message_id', messageId);
        }
        break;
      }

      default:
        console.log('ℹ️ Evento não tratado:', event);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Erro no webhook:', error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Erro desconhecido' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
