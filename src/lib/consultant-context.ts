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
}

export async function getCurrentConsultant(): Promise<ConsultantUser | null> {
  const { data: authUser } = await supabase.auth.getUser();
  if (!authUser.user) return null;

  const { data: user, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, organization_id, quiz_slug, is_active, profile_photo')
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
  // Domínio principal do projeto
  const publishedDomain = 'https://quiz-topbrasil.lovable.app';
  
  // Se estiver em localhost, usar localhost para testes
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return `${window.location.origin}/quiz/${slug}`;
  }
  
  // Em produção, sempre usar o domínio principal
  return `${publishedDomain}/quiz/${slug}`;
}
