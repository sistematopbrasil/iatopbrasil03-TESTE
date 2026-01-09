import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autorizado');
    }

    const { consultant_id } = await req.json();

    if (!consultant_id) {
      return new Response(
        JSON.stringify({ error: 'consultant_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🗑️ Deleting consultant:', consultant_id);

    // Create user-scoped client to verify authorization
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('❌ Auth error:', userError);
      throw new Error('Usuário não autenticado');
    }

    // Get current user's organization and role
    const { data: currentUserData, error: currentUserError } = await supabaseUser
      .from('users')
      .select('id, organization_id, role')
      .eq('auth_user_id', user.id)
      .single();

    if (currentUserError || !currentUserData) {
      console.error('❌ Current user error:', currentUserError);
      throw new Error('Dados do usuário não encontrados');
    }

    // Only super_admin can delete consultants
    if (currentUserData.role !== 'super_admin') {
      throw new Error('Apenas super admins podem excluir consultores');
    }

    // Use service role for elevated access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Get the consultant's auth_user_id
    const { data: consultantData, error: consultantError } = await supabaseAdmin
      .from('users')
      .select('id, auth_user_id, organization_id, full_name')
      .eq('id', consultant_id)
      .single();

    if (consultantError || !consultantData) {
      console.error('❌ Consultant not found:', consultantError);
      throw new Error('Consultor não encontrado');
    }

    // Verify same organization
    if (consultantData.organization_id !== currentUserData.organization_id) {
      throw new Error('Consultor não pertence à sua organização');
    }

    // Prevent deleting yourself
    if (consultantData.id === currentUserData.id) {
      throw new Error('Você não pode excluir a si mesmo');
    }

    console.log('📋 Consultant to delete:', consultantData.full_name, 'auth_user_id:', consultantData.auth_user_id);

    // ============================================
    // DELETE RELATED DATA IN CORRECT ORDER
    // ============================================

    // 2. Desassociar leads (quiz_submissions_new) - SET consultant_id = NULL
    console.log('📝 Desassociando leads...');
    const { error: leadsError } = await supabaseAdmin
      .from('quiz_submissions_new')
      .update({ consultant_id: null })
      .eq('consultant_id', consultant_id);
    
    if (leadsError) {
      console.warn('⚠️ Erro ao desassociar leads:', leadsError.message);
    }

    // 3. Get conversation IDs to delete messages
    const { data: conversations } = await supabaseAdmin
      .from('crm_conversations')
      .select('id')
      .eq('consultant_id', consultant_id);
    
    const conversationIds = conversations?.map(c => c.id) || [];

    // 4. Delete CRM messages (depends on conversations)
    if (conversationIds.length > 0) {
      console.log('💬 Deletando mensagens CRM...');
      const { error: messagesError } = await supabaseAdmin
        .from('crm_messages')
        .delete()
        .in('conversation_id', conversationIds);
      
      if (messagesError) {
        console.warn('⚠️ Erro ao deletar mensagens:', messagesError.message);
      }
    }

    // 5. Delete CRM conversations
    console.log('📱 Deletando conversas CRM...');
    const { error: conversationsError } = await supabaseAdmin
      .from('crm_conversations')
      .delete()
      .eq('consultant_id', consultant_id);
    
    if (conversationsError) {
      console.warn('⚠️ Erro ao deletar conversas:', conversationsError.message);
    }

    // 6. Delete CRM notes
    console.log('📝 Deletando notas CRM...');
    const { error: notesError } = await supabaseAdmin
      .from('crm_notes')
      .delete()
      .eq('consultant_id', consultant_id);
    
    if (notesError) {
      console.warn('⚠️ Erro ao deletar notas:', notesError.message);
    }

    // 7. Delete CRM quick replies
    console.log('⚡ Deletando respostas rápidas...');
    const { error: quickRepliesError } = await supabaseAdmin
      .from('crm_quick_replies')
      .delete()
      .eq('consultant_id', consultant_id);
    
    if (quickRepliesError) {
      console.warn('⚠️ Erro ao deletar respostas rápidas:', quickRepliesError.message);
    }

    // 8. Delete CRM tags
    console.log('🏷️ Deletando tags...');
    const { error: tagsError } = await supabaseAdmin
      .from('crm_tags')
      .delete()
      .eq('consultant_id', consultant_id);
    
    if (tagsError) {
      console.warn('⚠️ Erro ao deletar tags:', tagsError.message);
    }

    // 9. Delete CRM settings
    console.log('⚙️ Deletando configurações CRM...');
    const { error: settingsError } = await supabaseAdmin
      .from('crm_settings')
      .delete()
      .eq('consultant_id', consultant_id);
    
    if (settingsError) {
      console.warn('⚠️ Erro ao deletar configurações:', settingsError.message);
    }

    // 10. Delete WhatsApp instances
    console.log('📲 Deletando instâncias WhatsApp...');
    const { error: instancesError } = await supabaseAdmin
      .from('whatsapp_instances')
      .delete()
      .eq('consultant_id', consultant_id);
    
    if (instancesError) {
      console.warn('⚠️ Erro ao deletar instâncias:', instancesError.message);
    }

    // 11. Delete quiz questions
    console.log('❓ Deletando perguntas do quiz...');
    const { error: questionsError } = await supabaseAdmin
      .from('quiz_questions')
      .delete()
      .eq('consultant_id', consultant_id);
    
    if (questionsError) {
      console.warn('⚠️ Erro ao deletar perguntas:', questionsError.message);
    }

    // 12. Delete ranking scores
    console.log('🏆 Deletando scores de ranking...');
    const { error: rankingError } = await supabaseAdmin
      .from('ranking_scores')
      .delete()
      .eq('consultant_id', consultant_id);
    
    if (rankingError) {
      console.warn('⚠️ Erro ao deletar ranking:', rankingError.message);
    }

    // 13. Desassociar eventos (SET consultant_id = NULL)
    console.log('📅 Desassociando eventos...');
    const { error: eventsError } = await supabaseAdmin
      .from('events')
      .update({ consultant_id: null })
      .eq('consultant_id', consultant_id);
    
    if (eventsError) {
      console.warn('⚠️ Erro ao desassociar eventos:', eventsError.message);
    }

    // 14. Delete from users table
    console.log('👤 Deletando usuário...');
    const { error: deleteUserError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', consultant_id);

    if (deleteUserError) {
      console.error('❌ Error deleting from users table:', deleteUserError);
      throw new Error(`Erro ao excluir consultor: ${deleteUserError.message}`);
    }

    console.log('✅ Deleted from users table');

    // 15. Delete from Supabase Auth
    if (consultantData.auth_user_id) {
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(
        consultantData.auth_user_id
      );

      if (deleteAuthError) {
        console.error('⚠️ Error deleting auth user (non-fatal):', deleteAuthError);
      } else {
        console.log('✅ Deleted from auth.users');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Consultor excluído com sucesso',
        deleted_name: consultantData.full_name
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erro interno do servidor';
    console.error('❌ Delete consultant error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
