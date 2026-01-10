import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCurrentConsultant } from '@/lib/consultant-context';

export function RoleBasedRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const { data: consultant, isLoading } = useQuery({
    queryKey: ['current-consultant-redirect'],
    queryFn: getCurrentConsultant,
  });

  useEffect(() => {
    if (isLoading || !consultant) return;

    const superAdminOnlyRoutes = ['/admin/super', '/admin/consultants'];
    // Rotas que APENAS consultores podem acessar (não super_admin)
    // NOTA: /admin/ranking é acessível por AMBOS os roles
    const consultantOnlyRoutes = ['/admin/dashboard', '/admin/leads', '/admin/pipeline', '/admin/events', '/admin/analytics'];

    // Se Super Admin tentar acessar rotas exclusivas de consultor
    if (consultant.role === 'super_admin') {
      if (consultantOnlyRoutes.includes(location.pathname)) {
        navigate('/admin/super', { replace: true });
      }
    }

    // Se Consultor tentar acessar rotas de super admin
    if (consultant.role === 'consultor' || consultant.role === 'admin') {
      if (superAdminOnlyRoutes.includes(location.pathname)) {
        navigate('/admin/dashboard', { replace: true });
      }
    }

    // Redirecionar /admin para a rota correta
    if (location.pathname === '/admin' || location.pathname === '/admin/') {
      if (consultant.role === 'super_admin') {
        navigate('/admin/super', { replace: true });
      } else {
        navigate('/admin/dashboard', { replace: true });
      }
    }

    // ✅ PWA STANDALONE: Redirecionar raiz para dashboard quando em modo standalone (PWA instalado)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as any).standalone === true;
    
    if (isStandalone && location.pathname === '/') {
      if (consultant.role === 'super_admin') {
        navigate('/admin/super', { replace: true });
      } else {
        navigate('/admin/dashboard', { replace: true });
      }
    }
  }, [consultant, isLoading, location.pathname, navigate]);

  return null;
}
