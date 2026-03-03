import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('⏰ Follow-up check started');

    // Get all active follow-up rules
    const { data: rules, error: rulesErr } = await supabaseAdmin
      .from('followup_rules')
      .select('*, users:user_id(id, ai_enabled, organization_id)')
      .eq('is_active', true);

    if (rulesErr || !rules?.length) {
      console.log('📭 No active follow-up rules found');
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalSent = 0;

    for (const rule of rules) {
      try {
        const user = (rule as any).users;
        if (!user?.ai_enabled) continue;

        // Check working hours if enabled
        if (rule.respect_working_hours) {
          const now = new Date();
          const brTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
          const hours = brTime.getHours();
          if (hours < 8 || hours >= 18) {
            console.log(`⏰ Skipping rule "${rule.name}" - outside working hours`);
            continue;
          }
        }

        const delayThreshold = new Date(Date.now() - rule.delay_minutes * 60 * 1000).toISOString();

        // Find conversations needing follow-up
        let convQuery = supabaseAdmin
          .from('crm_conversations')
          .select('id, contact_phone, lead_id, instance_id, status, last_message_at')
          .eq('user_id', rule.user_id)
          .lt('last_message_at', delayThreshold);

        if (rule.only_open_conversations) {
          convQuery = convQuery.eq('status', 'open');
        }

        const { data: conversations } = await convQuery;
        if (!conversations?.length) continue;

        for (const conv of conversations) {
          try {
            // Check if AI is disabled/paused for this conversation
            const { data: aiState } = await supabaseAdmin
              .from('ai_conversation_state')
              .select('is_active, permanently_disabled, paused_until')
              .eq('conversation_id', conv.id)
              .maybeSingle();

            if (aiState?.permanently_disabled || (aiState && !aiState.is_active)) continue;
            if (aiState?.paused_until && new Date(aiState.paused_until) > new Date()) continue;

            // Check excluded stages
            if (conv.lead_id && rule.exclude_stages?.length) {
              const { data: lead } = await supabaseAdmin
                .from('quiz_submissions_new')
                .select('pipeline_stage_id')
                .eq('id', conv.lead_id)
                .single();

              if (lead?.pipeline_stage_id && rule.exclude_stages.includes(lead.pipeline_stage_id)) {
                continue;
              }
            }

            // Check max followups
            const { count } = await supabaseAdmin
              .from('followup_logs')
              .select('id', { count: 'exact', head: true })
              .eq('conversation_id', conv.id)
              .eq('rule_id', rule.id);

            if ((count || 0) >= rule.max_followups) continue;

            // Check if last message was from the lead (don't follow up on our own messages)
            const { data: lastMsg } = await supabaseAdmin
              .from('crm_messages')
              .select('direction')
              .eq('conversation_id', conv.id)
              .order('timestamp', { ascending: false })
              .limit(1)
              .single();

            // Only follow up if the last message was outgoing (we're waiting for lead response)
            // OR if there are no messages at all
            if (lastMsg?.direction === 'incoming') {
              // Lead already replied after our last message, skip
              continue;
            }

            // Check if there was a follow-up log after the last incoming message
            const { data: lastIncoming } = await supabaseAdmin
              .from('crm_messages')
              .select('timestamp')
              .eq('conversation_id', conv.id)
              .eq('direction', 'incoming')
              .order('timestamp', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (lastIncoming) {
              const { data: recentFollowup } = await supabaseAdmin
                .from('followup_logs')
                .select('sent_at')
                .eq('conversation_id', conv.id)
                .eq('rule_id', rule.id)
                .gt('sent_at', lastIncoming.timestamp)
                .limit(1)
                .maybeSingle();

              if (recentFollowup) continue; // Already sent follow-up after last incoming
            }

            // Get instance for sending
            const { data: instance } = await supabaseAdmin
              .from('whatsapp_instances')
              .select('instance_name, status')
              .eq('id', conv.instance_id)
              .single();

            if (!instance || instance.status !== 'connected') continue;

            let messageContent = '';

            if (rule.message_type === 'fixed' && rule.fixed_message) {
              messageContent = rule.fixed_message;
            } else {
              // AI generated - get conversation history and generate
              const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
              if (!LOVABLE_API_KEY) {
                console.log('⚠️ No LOVABLE_API_KEY for AI follow-up');
                continue;
              }

              const { data: history } = await supabaseAdmin
                .from('crm_messages')
                .select('direction, content, type')
                .eq('conversation_id', conv.id)
                .order('timestamp', { ascending: false })
                .limit(10);

              const historyText = (history || []).reverse().map((m: any) => {
                const sender = m.direction === 'incoming' ? 'LEAD' : 'CONSULTOR';
                return `[${sender}]: ${m.content || `(${m.type})`}`;
              }).join('\n');

              // Get AI config for persona
              const { data: aiConfig } = await supabaseAdmin
                .from('ai_agent_configs')
                .select('agent_name, persona')
                .eq('user_id', rule.user_id)
                .single();

              const prompt = rule.ai_prompt || 'Envie uma mensagem de acompanhamento amigável.';

              const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'google/gemini-2.5-flash',
                  messages: [
                    {
                      role: 'system',
                      content: `Voce é ${aiConfig?.agent_name || 'um assistente'}. ${aiConfig?.persona || ''}\n\nINSTRUÇÃO: ${prompt}\n\nResponda como se fosse uma mensagem natural de WhatsApp. Curta e objetiva. Sem mencionar que é IA.`,
                    },
                    {
                      role: 'user',
                      content: `HISTORICO:\n${historyText || '(sem historico)'}\n\nGere UMA mensagem de follow-up.`,
                    },
                  ],
                  temperature: 0.7,
                  max_tokens: 200,
                }),
              });

              if (!resp.ok) {
                console.error('❌ AI follow-up error:', resp.status);
                continue;
              }

              const data = await resp.json();
              messageContent = data.choices?.[0]?.message?.content || '';
            }

            if (!messageContent.trim()) continue;

            // Send message via Evolution API
            const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
            const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
            if (!evolutionApiUrl || !evolutionApiKey) continue;

            const jid = conv.contact_phone.includes('@') ? conv.contact_phone : `${conv.contact_phone}@s.whatsapp.net`;

            const sendResp = await fetch(`${evolutionApiUrl}/message/sendText/${instance.instance_name}`, {
              method: 'POST',
              headers: { apikey: evolutionApiKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({ number: jid, text: messageContent }),
            });

            let sentMsgId = `followup-${Date.now()}`;
            if (sendResp.ok) {
              const sendData = await sendResp.json();
              if (sendData?.key?.id) sentMsgId = sendData.key.id;
            }

            // Save message
            await supabaseAdmin.from('crm_messages').insert({
              conversation_id: conv.id,
              instance_id: conv.instance_id,
              message_id: sentMsgId,
              direction: 'outgoing',
              type: 'text',
              content: messageContent,
              status: 'sent',
              timestamp: new Date().toISOString(),
              metadata: { sent_by_ai: true, is_followup: true, rule_id: rule.id },
            });

            // Update conversation
            await supabaseAdmin.from('crm_conversations').update({
              last_message_at: new Date().toISOString(),
              last_message_preview: messageContent.substring(0, 100),
            }).eq('id', conv.id);

            // Log follow-up
            await supabaseAdmin.from('followup_logs').insert({
              conversation_id: conv.id,
              rule_id: rule.id,
              user_id: rule.user_id,
              organization_id: rule.organization_id,
              message_content: messageContent,
            });

            totalSent++;
            console.log(`✅ Follow-up sent to ${conv.contact_phone} (rule: ${rule.name})`);
          } catch (convErr) {
            console.error(`⚠️ Error processing conversation ${conv.id}:`, convErr);
          }
        }
      } catch (ruleErr) {
        console.error(`⚠️ Error processing rule ${rule.id}:`, ruleErr);
      }
    }

    console.log(`✅ Follow-up check complete. Sent: ${totalSent}`);
    return new Response(JSON.stringify({ success: true, sent: totalSent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('❌ Follow-up check error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
