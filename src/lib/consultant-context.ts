import { supabase } from '@/integrations/supabase/client';

export interface ConsultantUser {
  id: string;
  full_name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'consultor' | 'viewer';
  organization_id: string;
  quiz_slug: string | null;
  is_active: boolean;
  profile_photo: string | null;
  ai_enabled: boolean;
  crm_enabled: boolean;
  // Campos adicionais para configurações
  quiz_cover_image: string | null;
  quiz_image_position: string | null;
  quiz_image_size: string | null;
  quiz_image_shape: string | null;
  whatsapp_button_url: string | null;
  pixel_id: string | null;
  username: string | null;
}

export async function getCurrentConsultant(): Promise<ConsultantUser | null> {
  const { data: authUser } = await supabase.auth.getUser();
  if (!authUser.user) return null;

  const { data: user, error } = await supabase
    .from('users')
    .select(`
      id, 
      full_name, 
      email, 
      role, 
      organization_id, 
      quiz_slug, 
      is_active, 
      profile_photo,
      ai_enabled,
      crm_enabled,
      quiz_cover_image,
      quiz_image_position,
      quiz_image_size,
      quiz_image_shape,
      whatsapp_button_url,
      pixel_id,
      username
    `)
    .eq('auth_user_id', authUser.user.id)
    .maybeSingle();

  if (error || !user) return null;
  return user as ConsultantUser;
}

export function isSuperAdmin(role: string): boolean {
  return role === 'super_admin';
}

export function isConsultant(role: string): boolean {
  return role === 'admin' || role === 'consultor';
}

export function canViewAllData(role: string): boolean {
  return role === 'super_admin';
}

export function getQuizUrl(slug: string): string {
  return `${window.location.origin}/quiz/${slug}`;
}

export function getCaptureUrl(slug: string): string {
  return `${window.location.origin}/c/${slug}`;
}
