import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentConsultant, isSuperAdmin } from '@/lib/consultant-context';
import { StatCard } from '@/components/ui/stat-card';
import { Users, TrendingUp, Flame, UserPlus } from 'lucide-react';
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

      // Buscar stages de conversão (incluindo "novos consultores")
      const { data: conversionStages } = await supabase
        .from('pipeline_stages')
        .select('id, name')
        .eq('organization_id', currentUser.organization_id)
        .or('name.ilike.%convertido%,name.ilike.%consultor%');

      const conversionStageIds = conversionStages?.map(s => s.id) || [];

      // Contar leads nos stages de conversão
      let convertedLeadsCount = 0;
      if (conversionStageIds.length > 0) {
        const { count } = await supabase
          .from('quiz_submissions_new')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', currentUser.organization_id)
          .in('pipeline_stage_id', conversionStageIds);
        convertedLeadsCount = count || 0;
      }

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

      // Remover cálculo antigo de conversionRate (será feito abaixo)

      return {
        totalConsultants: totalConsultants || 0,
        totalLeads: totalLeads || 0,
        hotLeads: hotLeads || 0,
        totalEvents: totalEvents || 0,
        convertedLeads: convertedLeadsCount,
        conversionRate: totalLeads && totalLeads > 0 
          ? ((convertedLeadsCount) / totalLeads * 100).toFixed(1)
          : '0.0',
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
      <div className="p-4 md:p-6 space-y-6 overflow-x-hidden max-w-full">
        {/* Header */}
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Painel Super Admin
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Visão geral de todos os consultores e métricas consolidadas
          </p>
        </div>

        {/* Métricas gerais */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
            title="Novos Consultores"
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
        </div>

        {/* Gráficos */}
        <SuperAdminCharts />

        {/* Tabela de consultores */}
        <ConsultantsTable />
      </div>
    </AdminLayout>
  );
}
