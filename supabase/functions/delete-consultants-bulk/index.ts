import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function deleteConsultantData(supabaseAdmin: any, consultantId: string, consultantName: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`🗑️ Deleting consultant: ${consultantName} (${consultantId})`);

    // 1. Desassociar leads (quiz_submissions_new)
    await supabaseAdmin
      .from('quiz_submissions_new')
      .update({ consultant_id: null })
      .eq('consultant_id', consultantId);

    // 2. Get conversation IDs
    const { data: conversations } = await supabaseAdmin
      .from('crm_conversations')
      .select('id')
      .eq('consultant_id', consultantId);
    
    const conversationIds = conversations?.map((c: any) => c.id) || [];

    // 3. Delete CRM messages
    if (conversationIds.length > 0) {
      await supabaseAdmin
        .from('crm_messages')
        .delete()
        .in('conversation_id', conversationIds);
    }

    // 4. Delete CRM conversations
    await supabaseAdmin
      .from('crm_conversations')
      .delete()
      .eq('consultant_id', consultantId);

    // 5. Delete CRM notes
    await supabaseAdmin
      .from('crm_notes')
      .delete()
      .eq('consultant_id', consultantId);

    // 6. Delete CRM quick replies
    await supabaseAdmin
      .from('crm_quick_replies')
      .delete()
      .eq('consultant_id', consultantId);

    // 7. Delete CRM tags
    await supabaseAdmin
      .from('crm_tags')
      .delete()
      .eq('consultant_id', consultantId);

    // 8. Delete CRM settings
    await supabaseAdmin
      .from('crm_settings')
      .delete()
      .eq('consultant_id', consultantId);

    // 9. Delete WhatsApp instances
    await supabaseAdmin
      .from('whatsapp_instances')
      .delete()
      .eq('consultant_id', consultantId);

    // 10. Delete quiz questions
    await supabaseAdmin
      .from('quiz_questions')
      .delete()
      .eq('consultant_id', consultantId);

    // 11. Delete ranking scores
    await supabaseAdmin
      .from('ranking_scores')
      .delete()
      .eq('consultant_id', consultantId);

    // 12. Desassociar eventos
    await supabaseAdmin
      .from('events')
      .update({ consultant_id: null })
      .eq('consultant_id', consultantId);

    // 13. Get auth_user_id before deleting user
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('auth_user_id')
      .eq('id', consultantId)
      .single();

    // 14. Delete from users table
    const { error: deleteUserError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', consultantId);

    if (deleteUserError) {
      throw new Error(deleteUserError.message);
    }

    // 15. Delete from auth.users
    if (userData?.auth_user_id) {
      await supabaseAdmin.auth.admin.deleteUser(userData.auth_user_id);
    }

    console.log(`✅ Deleted: ${consultantName}`);
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error(`❌ Failed to delete ${consultantName}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autorizado');
    }

    const { consultant_ids } = await req.json();

    if (!consultant_ids || !Array.isArray(consultant_ids) || consultant_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'consultant_ids deve ser um array não vazio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🗑️ Bulk delete request for ${consultant_ids.length} consultants`);

    // Verify user authorization
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error('Usuário não autenticado');
    }

    const { data: currentUserData, error: currentUserError } = await supabaseUser
      .from('users')
      .select('id, organization_id, role')
      .eq('auth_user_id', user.id)
      .single();

    if (currentUserError || !currentUserData) {
      throw new Error('Dados do usuário não encontrados');
    }

    if (currentUserData.role !== 'super_admin') {
      throw new Error('Apenas super admins podem excluir consultores');
    }

    // Use service role for deletions
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch all consultants to delete
    const { data: consultants, error: consultantsError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, organization_id')
      .in('id', consultant_ids);

    if (consultantsError) {
      throw new Error('Erro ao buscar consultores');
    }

    // Filter to only same organization and not self
    const validConsultants = consultants?.filter(c => 
      c.organization_id === currentUserData.organization_id && 
      c.id !== currentUserData.id
    ) || [];

    const skipped = consultant_ids.length - validConsultants.length;
    
    if (validConsultants.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Nenhum consultor válido para excluir',
          details: { skipped }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete each consultant
    const results = await Promise.all(
      validConsultants.map(c => deleteConsultantData(supabaseAdmin, c.id, c.full_name))
    );

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success);

    console.log(`✅ Bulk delete complete: ${succeeded} succeeded, ${failed.length} failed, ${skipped} skipped`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `${succeeded} consultor(es) excluído(s) com sucesso`,
        details: {
          total: consultant_ids.length,
          succeeded,
          failed: failed.length,
          skipped,
          errors: failed.map(f => f.error)
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erro interno do servidor';
    console.error('❌ Bulk delete error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
