// Edge function: limpa mensagens e conversas do WhatsApp do consultor
// SEM apagar leads. Apenas crm_messages, crm_conversation_tags, crm_notes, crm_conversations.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Cliente para identificar o usuário (usa o JWT do header)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mapear auth_user_id -> consultant_id
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: consultant, error: cErr } = await admin
      .from('users')
      .select('id, organization_id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (cErr || !consultant) {
      return new Response(JSON.stringify({ error: 'consultant_not_found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Buscar IDs das conversas do consultor
    const { data: conversations, error: convErr } = await admin
      .from('crm_conversations')
      .select('id')
      .eq('user_id', consultant.id);

    if (convErr) throw convErr;

    const conversationIds = (conversations || []).map((c) => c.id);

    let deletedMessages = 0;
    let deletedTags = 0;
    let deletedNotes = 0;
    let deletedConversations = 0;

    if (conversationIds.length > 0) {
      // 2. Apagar mensagens em lotes (Postgres tem limite de IN clause)
      const chunkSize = 500;
      for (let i = 0; i < conversationIds.length; i += chunkSize) {
        const chunk = conversationIds.slice(i, i + chunkSize);
        const { count: msgCount, error: mErr } = await admin
          .from('crm_messages')
          .delete({ count: 'exact' })
          .in('conversation_id', chunk);
        if (mErr) throw mErr;
        deletedMessages += msgCount || 0;

        const { count: tagCount } = await admin
          .from('crm_conversation_tags')
          .delete({ count: 'exact' })
          .in('conversation_id', chunk);
        deletedTags += tagCount || 0;

        const { count: noteCount } = await admin
          .from('crm_notes')
          .delete({ count: 'exact' })
          .in('conversation_id', chunk);
        deletedNotes += noteCount || 0;
      }

      // 3. Apagar as próprias conversas
      const { count: convCount, error: dErr } = await admin
        .from('crm_conversations')
        .delete({ count: 'exact' })
        .eq('user_id', consultant.id);
      if (dErr) throw dErr;
      deletedConversations = convCount || 0;
    }

    // Auditoria
    await admin.from('crm_audit_logs').insert({
      user_id: consultant.id,
      organization_id: consultant.organization_id,
      action: 'crm.clear_whatsapp',
      resource_type: 'crm_conversations',
      metadata: {
        deleted_conversations: deletedConversations,
        deleted_messages: deletedMessages,
        deleted_tags: deletedTags,
        deleted_notes: deletedNotes,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        deleted: {
          conversations: deletedConversations,
          messages: deletedMessages,
          tags: deletedTags,
          notes: deletedNotes,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('crm-clear-whatsapp error', err);
    return new Response(JSON.stringify({ error: err.message || 'internal_error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
