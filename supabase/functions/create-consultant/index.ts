import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getIntegrationValue } from '../_shared/integration-config.ts';

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
    // Authenticate the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(
      authHeader.replace('Bearer ', '')
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify caller is admin or super_admin
    const { data: callerUser } = await supabaseAuth
      .from('users')
      .select('role')
      .eq('auth_user_id', claimsData.claims.sub)
      .single();

    if (!callerUser || !['admin', 'super_admin'].includes(callerUser.role)) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      email,
      password,
      full_name,
      organization_id,
      role,
      allowed_funnels,
      default_funnel,
    } = await req.json();

    console.log('Creating consultant:', { email, full_name, organization_id, role });

    // ─── Validar funnel access (defaults retrocompatíveis) ───
    const VALID_FUNNELS = ['consultor', 'associado'];
    let normalizedAllowed: string[] = Array.isArray(allowed_funnels) && allowed_funnels.length > 0
      ? Array.from(new Set(allowed_funnels)).filter((f: any) => VALID_FUNNELS.includes(f))
      : ['consultor'];
    if (normalizedAllowed.length === 0) normalizedAllowed = ['consultor'];

    let normalizedDefault: string = VALID_FUNNELS.includes(default_funnel)
      ? default_funnel
      : 'consultor';
    if (!normalizedAllowed.includes(normalizedDefault)) {
      normalizedDefault = normalizedAllowed[0];
    }

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
    let createdNewAuthUser = false;

    // Try to create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      // Check if the error is because email already exists in Auth
      if (authError.message.includes('already been registered') || authError.code === 'email_exists') {
        console.log('User already exists in Auth, checking if orphaned...');
        
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

        // Check if this auth user has a corresponding record in users table
        const { data: linkedUser } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('auth_user_id', existingAuthUser.id)
          .single();

        if (linkedUser) {
          // Auth user is linked to a users record - this is a true duplicate
          return new Response(
            JSON.stringify({ error: 'Este email já está associado a um consultor existente' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Auth user exists but is ORPHANED (no users table record) - delete and recreate
        console.log('Found orphaned auth user, deleting...', existingAuthUser.id);
        
        const { error: deleteOrphanError } = await supabaseAdmin.auth.admin.deleteUser(existingAuthUser.id);
        
        if (deleteOrphanError) {
          console.error('Error deleting orphaned auth user:', deleteOrphanError);
          return new Response(
            JSON.stringify({ error: 'Erro ao limpar usuário órfão. Tente novamente.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Orphaned auth user deleted, creating new one...');
        
        // Now create the new auth user
        const { data: newAuthData, error: newAuthError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

        if (newAuthError || !newAuthData.user) {
          console.error('Error creating new auth user after cleanup:', newAuthError);
        console.error('Error creating new auth user after cleanup:', newAuthError);
          return new Response(
            JSON.stringify({ error: 'Erro ao criar usuário. Tente novamente.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        authUserId = newAuthData.user.id;
        createdNewAuthUser = true;
        console.log('New auth user created after cleanup:', authUserId);
      } else {
        console.error('Auth error:', authError);
        return new Response(
          JSON.stringify({ error: 'Erro ao criar usuário. Tente novamente.' }),
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
      createdNewAuthUser = true;
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
        allowed_funnels: normalizedAllowed,
        default_funnel: normalizedDefault,
      })
      .select('id')
      .single();

    if (userError) {
      console.error('Users table error:', userError);
      // Only delete auth user if we created it in this request
      if (createdNewAuthUser) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
      }
      return new Response(
        JSON.stringify({ error: 'Erro ao criar consultor. Tente novamente.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Consultant created successfully with id:', userData.id);

    // Create default questions for the consultant with is_default = true
    const questionsToInsert = DEFAULT_QUESTIONS.map(q => ({
      ...q,
      consultant_id: userData.id,
      is_active: true,
      is_default: true, // Mark as default questions
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

    // =========================================
    // Criar instância(s) WhatsApp automaticamente — uma por funil habilitado
    // =========================================
    const EVOLUTION_API_URL = await getIntegrationValue('EVOLUTION_API_URL', supabaseAdmin);
    const EVOLUTION_API_KEY = await getIntegrationValue('EVOLUTION_API_KEY', supabaseAdmin);
    const EVOLUTION_WEBHOOK_SECRET = (await getIntegrationValue('EVOLUTION_WEBHOOK_SECRET', supabaseAdmin)) || '';

    if (EVOLUTION_API_URL && EVOLUTION_API_KEY) {
      const webhookBase = `${Deno.env.get('SUPABASE_URL')}/functions/v1/crm-webhook`;
      const webhookUrl = EVOLUTION_WEBHOOK_SECRET
        ? `${webhookBase}?secret=${encodeURIComponent(EVOLUTION_WEBHOOK_SECRET)}`
        : webhookBase;

      // Sanitizar nome base
      const sanitizedBase = full_name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 20) || 'consultor';

      // Sufixos por funil (legíveis)
      const funnelSuffix: Record<string, string> = {
        consultor: 'consultor',
        associado: 'associados',
      };

      for (const funnel of normalizedAllowed) {
        try {
          // Gera nome único: "<base>-<funil>", com sufixo numérico em colisões
          const desiredBase = `${sanitizedBase}-${funnelSuffix[funnel] || funnel}`;
          let candidateName = desiredBase;
          let counter = 1;
          // Loop até achar nome livre na tabela whatsapp_instances
          // (constraint UNIQUE em instance_name)
          // Limite de tentativas de segurança
          for (let i = 0; i < 50; i++) {
            const { data: existing } = await supabaseAdmin
              .from('whatsapp_instances')
              .select('id')
              .eq('instance_name', candidateName)
              .maybeSingle();
            if (!existing) break;
            counter += 1;
            candidateName = `${desiredBase}-${counter}`;
          }

          console.log(`Creating WhatsApp instance "${candidateName}" for funnel ${funnel}`);

          const evolutionResponse = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': EVOLUTION_API_KEY,
            },
            body: JSON.stringify({
              instanceName: candidateName,
              qrcode: true,
              integration: 'WHATSAPP-BAILEYS',
              webhook: {
                url: webhookUrl,
                enabled: true,
                webhookByEvents: false,
                webhookBase64: true,
                headers: EVOLUTION_WEBHOOK_SECRET ? { 'x-webhook-secret': EVOLUTION_WEBHOOK_SECRET } : undefined,
                events: ['QRCODE_UPDATED', 'CONNECTION_UPDATE', 'MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'SEND_MESSAGE'],
              },
            }),
          });

          if (evolutionResponse.ok) {
            const { error: instanceError } = await supabaseAdmin
              .from('whatsapp_instances')
              .insert({
                user_id: userData.id,
                organization_id: organization_id,
                instance_name: candidateName,
                instance_key: candidateName,
                status: 'disconnected',
                webhook_url: webhookUrl,
                funnel_type: funnel,
              });

            if (instanceError) {
              console.warn(`⚠️ Erro ao salvar instância (${funnel}):`, instanceError);
            } else {
              console.log(`✅ Instância "${candidateName}" criada para funil ${funnel}`);
            }
          } else {
            const errText = await evolutionResponse.text();
            console.warn(`⚠️ Erro Evolution API (${funnel}):`, errText);
          }
        } catch (instanceError) {
          console.warn(`⚠️ Erro criação instância funnel ${funnel}:`, instanceError);
          // Não falhar criação do consultor por causa disso
        }
      }
    } else {
      console.log('⚠️ Evolution API não configurada, pulando criação de instância WhatsApp');
    }

    return new Response(
      JSON.stringify({ success: true, email, consultant_id: userData.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
