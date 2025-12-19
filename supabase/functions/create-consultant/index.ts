import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Perguntas padrão para o quiz
const DEFAULT_QUESTIONS = [
  { question_text: 'Qual é o seu nome completo?', question_type: 'open_text', options: null, order_index: 1 },
  { question_text: 'Qual é o seu telefone/WhatsApp para eu te enviar o resultado do seu perfil?', question_type: 'open_text', options: null, order_index: 2 },
  { question_text: 'Qual a sua idade?', question_type: 'open_text', options: null, order_index: 3 },
  { question_text: 'Você é casado, solteiro ou namora?', question_type: 'multiple_choice', options: ['Solteiro(a)', 'Namorando', 'Casado(a)', 'Divorciado(a)'], order_index: 4 },
  { question_text: 'Qual a sua cidade e estado?', question_type: 'open_text', options: null, order_index: 5 },
  { question_text: 'Você possui carro ou moto?', question_type: 'multiple_choice', options: ['Sim, carro.', 'Sim, moto.', 'Possui ambos (carro e moto).', 'Não tenho veículo.'], order_index: 6 },
  { question_text: 'Você possui CNH (Carteira Nacional de Habilitação)?', question_type: 'multiple_choice', options: ['Sim, possuo CNH', 'Não possuo CNH'], order_index: 7 },
  { question_text: 'Qual é a sua situação profissional atual?', question_type: 'multiple_choice', options: ['Trabalho registrado (CLT)', 'Trabalho como autônomo', 'Tenho um negócio próprio', 'Estou desempregado no momento', 'Sou estudante'], order_index: 8 },
  { question_text: 'Você trabalha com o quê atualmente?', question_type: 'open_text', options: null, order_index: 9 },
  { question_text: 'Você já trabalhou com vendas antes?', question_type: 'multiple_choice', options: ['Sim, já trabalho com vendas', 'Já trabalhei, mas não atualmente', 'Nunca trabalhei com vendas', 'Tenho interesse em aprender'], order_index: 10 },
  { question_text: 'Você já trabalhou ou trabalha com proteção veicular?', question_type: 'multiple_choice', options: ['Sim', 'Não'], order_index: 11 },
  { question_text: 'Qual é a sua faixa de ganhos mensal hoje?', question_type: 'multiple_choice', options: ['Até R$1.500', 'De R$1.500 a R$3.000', 'De R$3.000 a R$5.000', 'Acima de R$5.000'], order_index: 12 },
  { question_text: 'Quanto você gostaria de ganhar por mês como consultor de proteção veicular?', question_type: 'multiple_choice', options: ['R$3.000 a R$5.000', 'R$5.000 a R$8.000', 'R$8.000 a R$12.000', 'Acima de R$12.000', 'Quero fazer minha melhor renda da vida'], order_index: 13 },
  { question_text: 'Por que você quer se tornar um Consultor de Proteção Veicular da TOP Brasil?', question_type: 'open_text', options: null, order_index: 14 },
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, full_name, organization_id, role } = await req.json();

    console.log('Creating consultant:', { email, full_name, organization_id, role });

    // Validate required fields
    if (!email || !password || !full_name || !organization_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, full_name, organization_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Senha deve ter no mínimo 8 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if email already exists in users table
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'Email já está em uso na tabela de usuários' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let authUserId: string;

    // Try to create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      // Check if the error is because email already exists in Auth
      if (authError.message.includes('already been registered') || authError.code === 'email_exists') {
        console.log('User already exists in Auth, looking up auth_user_id...');
        
        // Get the existing auth user by email
        const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (listError) {
          console.error('Error listing users:', listError);
          return new Response(
            JSON.stringify({ error: 'Erro ao buscar usuário existente' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const existingAuthUser = authUsers.users.find(u => u.email === email);
        
        if (!existingAuthUser) {
          return new Response(
            JSON.stringify({ error: 'Usuário não encontrado no sistema de autenticação' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        authUserId = existingAuthUser.id;
        console.log('Found existing auth user:', authUserId);
      } else {
        console.error('Auth error:', authError);
        return new Response(
          JSON.stringify({ error: `Erro ao criar usuário: ${authError.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (!authData.user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não foi criado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      authUserId = authData.user.id;
      console.log('Auth user created:', authUserId);
    }

    // Create record in users table (slug is auto-generated by trigger)
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        auth_user_id: authUserId,
        email,
        full_name,
        role: role || 'consultor',
        organization_id,
      })
      .select('id')
      .single();

    if (userError) {
      console.error('Users table error:', userError);
      // Only delete auth user if we created it (not if it existed before)
      if (authData?.user) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
      }
      return new Response(
        JSON.stringify({ error: `Erro ao criar consultor: ${userError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Consultant created successfully with id:', userData.id);

    // Create default questions for the consultant
    const questionsToInsert = DEFAULT_QUESTIONS.map(q => ({
      ...q,
      consultant_id: userData.id,
      is_active: true,
    }));

    const { error: questionsError } = await supabaseAdmin
      .from('quiz_questions')
      .insert(questionsToInsert);

    if (questionsError) {
      console.error('Error creating default questions:', questionsError);
      // Don't fail the whole operation, just log the error
    } else {
      console.log('Default questions created successfully');
    }

    return new Response(
      JSON.stringify({ success: true, email, consultant_id: userData.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erro interno do servidor';
    console.error('Unexpected error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
