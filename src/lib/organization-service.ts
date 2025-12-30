import { supabase } from '@/integrations/supabase/client';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  whatsapp_number: string | null;
  meta_pixel_id: string | null;
  is_active: boolean;
}

export interface QuizConfigColors {
  primary?: string;
  secondary?: string;
}

export interface QuizConfig {
  id: string;
  organization_id: string;
  custom_welcome_message: string | null;
  custom_thank_you_message: string | null;
  custom_colors: QuizConfigColors | null;
  custom_logo_url: string | null;
  redirect_url: string | null;
  is_active: boolean;
}

export interface ConsultantInfo {
  id: string;
  full_name: string;
  organization_id: string;
  quiz_slug: string;
  profile_photo?: string | null;
  whatsapp_button_url?: string | null;
  quiz_cover_image?: string | null;
  quiz_image_position?: string | null;
  quiz_image_shape?: string | null;
  quiz_image_size?: string | null;
  pixel_id?: string | null;
}

export interface QuizData {
  consultant: ConsultantInfo | null;
  organization: Organization | null;
  config: QuizConfig | null;
}

// Nova função unificada que busca tudo em paralelo
export async function getQuizDataBySlug(slug: string): Promise<QuizData> {
  // Primeiro tenta buscar como consultor
  const { data: consultant } = await supabase
    .from('users')
    .select('id, full_name, organization_id, quiz_slug, profile_photo, whatsapp_button_url, quiz_cover_image, quiz_image_position, quiz_image_shape, quiz_image_size, pixel_id')
    .eq('quiz_slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (consultant) {
    // Consultor encontrado - buscar org e config em paralelo
    const [orgResult, configResult] = await Promise.all([
      supabase
        .from('organizations')
        .select('*')
        .eq('id', consultant.organization_id)
        .eq('is_active', true)
        .maybeSingle(),
      supabase
        .from('quiz_configurations')
        .select('*')
        .eq('organization_id', consultant.organization_id)
        .eq('is_active', true)
        .maybeSingle()
    ]);

    return {
      consultant: consultant as ConsultantInfo,
      organization: orgResult.data as Organization | null,
      config: parseQuizConfig(configResult.data),
    };
  }

  // Não é consultor, tentar buscar como organização
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (!org) {
    return { consultant: null, organization: null, config: null };
  }

  // Buscar config da organização
  const { data: configData } = await supabase
    .from('quiz_configurations')
    .select('*')
    .eq('organization_id', org.id)
    .eq('is_active', true)
    .maybeSingle();

  return {
    consultant: null,
    organization: org as Organization,
    config: parseQuizConfig(configData),
  };
}

function parseQuizConfig(data: any): QuizConfig | null {
  if (!data) return null;
  
  let customColors: QuizConfigColors | null = null;
  if (data.custom_colors) {
    if (typeof data.custom_colors === 'string') {
      try {
        customColors = JSON.parse(data.custom_colors);
      } catch {
        customColors = null;
      }
    } else if (typeof data.custom_colors === 'object') {
      customColors = data.custom_colors as QuizConfigColors;
    }
  }
  
  return {
    id: data.id,
    organization_id: data.organization_id,
    custom_welcome_message: data.custom_welcome_message,
    custom_thank_you_message: data.custom_thank_you_message,
    custom_colors: customColors,
    custom_logo_url: data.custom_logo_url,
    redirect_url: data.redirect_url,
    is_active: data.is_active,
  };
}

// Funções legadas mantidas para compatibilidade
export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    return data as Organization | null;
  } catch (error) {
    console.error('Erro ao buscar organização:', error);
    return null;
  }
}

export async function getConsultantBySlug(slug: string): Promise<ConsultantInfo | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, organization_id, quiz_slug, profile_photo, whatsapp_button_url, quiz_cover_image, quiz_image_position, quiz_image_shape, quiz_image_size, pixel_id')
      .eq('quiz_slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    return data as ConsultantInfo | null;
  } catch (error) {
    console.error('Erro ao buscar consultor:', error);
    return null;
  }
}

export async function getOrganizationById(id: string): Promise<Organization | null> {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    return data as Organization | null;
  } catch (error) {
    console.error('Erro ao buscar organização por ID:', error);
    return null;
  }
}

export async function getQuizConfig(organizationId: string): Promise<QuizConfig | null> {
  try {
    const { data, error } = await supabase
      .from('quiz_configurations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    return parseQuizConfig(data);
  } catch (error) {
    console.error('Erro ao buscar configuração do quiz:', error);
    return null;
  }
}