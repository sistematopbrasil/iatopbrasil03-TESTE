import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentConsultant, isSuperAdmin } from '@/lib/consultant-context';
import { StatCard } from '@/components/ui/stat-card';
import { Users, TrendingUp, Flame, CalendarDays, UserPlus } from 'lucide-react';
import { ConsultantsTable } from '@/components/super-admin/ConsultantsTable';
import { SuperAdminCharts } from '@/components/super-admin/SuperAdminCharts';
import { AdminLayout } from '@/components/admin/AdminLayout';

export default function AdminSuperAdmin() {
  const navigate = useNavigate();
  
  const { data: currentUser, isLoading: loadingUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentConsultant,
  });

  // Redirecionar se não for super admin
  useEffect(() => {
    if (!loadingUser && currentUser && !isSuperAdmin(currentUser.role)) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [currentUser, loadingUser, navigate]);

  const { data: metrics } = useQuery({
    queryKey: ['super-admin-metrics', currentUser?.organization_id],
    queryFn: async () => {
      if (!currentUser) return null;

      // Total de consultores
      const { count: totalConsultants } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentUser.organization_id)
        .in('role', ['admin', 'consultor']);

      // Total de leads completos
      const { count: totalLeads } = await supabase
        .from('quiz_submissions_new')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentUser.organization_id)
        .eq('completion_percentage', 100);

      // Leads convertidos
      const { count: convertedLeads } = await supabase
        .from('quiz_submissions_new')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentUser.organization_id)
        .eq('stage', 'convertido');

      // Leads HOT
      const { count: hotLeads } = await supabase
        .from('quiz_submissions_new')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentUser.organization_id)
        .eq('temperature', 'hot');

      // Total de eventos
      const { count: totalEvents } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentUser.organization_id);

      // Consultores recrutados (com recruited_by preenchido)
      // Por enquanto, mostramos o total de consultores criados
      const conversionRate = totalLeads && totalLeads > 0 
        ? ((convertedLeads || 0) / totalLeads * 100).toFixed(1)
        : '0.0';

      return {
        totalConsultants: totalConsultants || 0,
        totalLeads: totalLeads || 0,
        hotLeads: hotLeads || 0,
        totalEvents: totalEvents || 0,
        convertedLeads: convertedLeads || 0,
        conversionRate,
      };
    },
    enabled: !!currentUser,
  });

  // Loading ou não é super admin (aguardando redirect)
  if (loadingUser || (currentUser && !isSuperAdmin(currentUser.role))) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            👑 Painel Super Admin
          </h1>
          <p className="text-muted-foreground mt-1">
            Visão geral de todos os consultores e métricas consolidadas
          </p>
        </div>

        {/* Métricas gerais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="Consultores Ativos"
            value={metrics?.totalConsultants || 0}
            icon={Users}
          />
          <StatCard
            title="Total de Leads"
            value={metrics?.totalLeads || 0}
            icon={TrendingUp}
          />
          <StatCard
            title="Leads Convertidos"
            value={metrics?.convertedLeads || 0}
            subtitle={`${metrics?.conversionRate}% conversão`}
            icon={UserPlus}
            variant="success"
          />
          <StatCard
            title="Leads Quentes"
            value={metrics?.hotLeads || 0}
            icon={Flame}
            variant="warning"
          />
          <StatCard
            title="Total de Eventos"
            value={metrics?.totalEvents || 0}
            icon={CalendarDays}
          />
        </div>

        {/* Gráficos */}
        <SuperAdminCharts />

        {/* Tabela de consultores */}
        <ConsultantsTable />
      </div>
    </AdminLayout>
  );
}
