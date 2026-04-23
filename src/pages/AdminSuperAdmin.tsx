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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { FunnelType } from '@/lib/funnel-types';
import { useFunnel } from '@/contexts/FunnelContext';

interface FunnelMetrics {
  totalConsultants: number;
  totalLeads: number;
  hotLeads: number;
  totalEvents: number;
  convertedLeads: number;
  conversionRate: string;
}

async function loadMetrics(orgId: string, funnel?: FunnelType): Promise<FunnelMetrics> {
  // Consultores ativos por funil (allowed_funnels contém o funil)
  let consultantsQuery = supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .in('role', ['admin', 'consultor']);
  if (funnel) {
    consultantsQuery = consultantsQuery.contains('allowed_funnels', [funnel] as any);
  }
  const { count: totalConsultants } = await consultantsQuery;

  // Leads completos por funil
  let leadsQuery = supabase
    .from('quiz_submissions_new')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('completion_percentage', 100);
  if (funnel) leadsQuery = leadsQuery.eq('funnel_type', funnel);
  const { count: totalLeads } = await leadsQuery;

  // Stages de conversão
  let stagesQuery = supabase
    .from('pipeline_stages')
    .select('id, name, funnel_type')
    .eq('organization_id', orgId)
    .or('name.ilike.%convertido%,name.ilike.%consultor%');
  if (funnel) stagesQuery = stagesQuery.eq('funnel_type', funnel);
  const { data: conversionStages } = await stagesQuery;

  const conversionStageIds = conversionStages?.map(s => s.id) || [];

  let convertedLeadsCount = 0;
  if (conversionStageIds.length > 0) {
    let convertedQuery = supabase
      .from('quiz_submissions_new')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .in('pipeline_stage_id', conversionStageIds);
    if (funnel) convertedQuery = convertedQuery.eq('funnel_type', funnel);
    const { count } = await convertedQuery;
    convertedLeadsCount = count || 0;
  }

  let hotQuery = supabase
    .from('quiz_submissions_new')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('temperature', 'hot');
  if (funnel) hotQuery = hotQuery.eq('funnel_type', funnel);
  const { count: hotLeads } = await hotQuery;

  const { count: totalEvents } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId);

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
}

function MetricsBlock({ metrics }: { metrics: FunnelMetrics | undefined }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <StatCard title="Consultores Ativos" value={metrics?.totalConsultants || 0} icon={Users} />
      <StatCard title="Total de Leads" value={metrics?.totalLeads || 0} icon={TrendingUp} />
      <StatCard
        title="Novos Consultores"
        value={metrics?.convertedLeads || 0}
        subtitle={`${metrics?.conversionRate}% conversão`}
        icon={UserPlus}
        variant="success"
      />
      <StatCard title="Leads Quentes" value={metrics?.hotLeads || 0} icon={Flame} variant="warning" />
    </div>
  );
}

export default function AdminSuperAdmin() {
  const navigate = useNavigate();

  const { data: currentUser, isLoading: loadingUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentConsultant,
  });

  useEffect(() => {
    if (!loadingUser && currentUser && !isSuperAdmin(currentUser.role)) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [currentUser, loadingUser, navigate]);

  const orgId = currentUser?.organization_id;

  const { data: metricsAll } = useQuery({
    queryKey: ['super-admin-metrics', orgId, 'all'],
    queryFn: () => loadMetrics(orgId!),
    enabled: !!orgId,
  });
  const { data: metricsConsultor } = useQuery({
    queryKey: ['super-admin-metrics', orgId, 'consultor'],
    queryFn: () => loadMetrics(orgId!, 'consultor'),
    enabled: !!orgId,
  });
  const { data: metricsAssociado } = useQuery({
    queryKey: ['super-admin-metrics', orgId, 'associado'],
    queryFn: () => loadMetrics(orgId!, 'associado'),
    enabled: !!orgId,
  });

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
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Painel Super Admin
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Visão geral por funil e consolidada
          </p>
        </div>

        <SuperAdminContent
          metricsAll={metricsAll}
          metricsConsultor={metricsConsultor}
          metricsAssociado={metricsAssociado}
        />

        {/* Tabela de consultores */}
        <ConsultantsTable />
      </div>
    </AdminLayout>
  );
}
