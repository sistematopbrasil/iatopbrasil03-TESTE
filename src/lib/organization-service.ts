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
}

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
      .select('id, full_name, organization_id, quiz_slug')
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
    
    if (!data) return null;
    
    // Parse custom_colors if needed
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
  } catch (error) {
    console.error('Erro ao buscar configuração do quiz:', error);
    return null;
  }
}
