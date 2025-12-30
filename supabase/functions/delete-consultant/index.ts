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

    // 2. Delete from users table first (cascades will handle related records)
    const { error: deleteUserError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', consultant_id);

    if (deleteUserError) {
      console.error('❌ Error deleting from users table:', deleteUserError);
      throw new Error(`Erro ao excluir consultor: ${deleteUserError.message}`);
    }

    console.log('✅ Deleted from users table');

    // 3. Delete from Supabase Auth
    if (consultantData.auth_user_id) {
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(
        consultantData.auth_user_id
      );

      if (deleteAuthError) {
        console.error('⚠️ Error deleting auth user (non-fatal):', deleteAuthError);
        // Don't throw - the user table record is already deleted
        // This is non-fatal because the auth user won't have access without a users record
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
