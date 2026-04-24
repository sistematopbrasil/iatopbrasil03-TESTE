import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getCurrentConsultant, isSuperAdmin } from '@/lib/consultant-context';
import { StatCard } from '@/components/ui/stat-card';
import { Users, TrendingUp, Flame, UserPlus } from 'lucide-react';
import { ConsultantsTable } from '@/components/super-admin/ConsultantsTable';
import { SuperAdminCharts } from '@/components/super-admin/SuperAdminCharts';
import { AdminLayout } from '@/components/admin/AdminLayout';
import type { FunnelType } from '@/lib/funnel-types';
import { useFunnel } from '@/contexts/FunnelContext';
import { useRankingData } from '@/hooks/useRankingData';
import { Card } from '@/components/ui/card';

export default function AdminSuperAdmin() {
  const navigate = useNavigate();
  const { activeFunnel } = useFunnel();

  const { data: currentUser, isLoading: loadingUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentConsultant,
  });

  useEffect(() => {
    if (!loadingUser && currentUser && !isSuperAdmin(currentUser.role)) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [currentUser, loadingUser, navigate]);

  // ✅ Usa MESMA fonte de dados do Ranking (edge function ranking-get) — garante consistência total
  const { ranking, totals } = useRankingData();

  const funnelForQuery: FunnelType | undefined =
    activeFunnel === 'all' ? undefined : (activeFunnel as FunnelType);

  // Métricas derivadas dos mesmos dados do Ranking
  const metrics = useMemo(() => {
    const totalConsultants = ranking?.length || 0;
    const totalLeads = totals.leads || 0;
    const hotLeads = totals.hot || 0;
    const novosConsultores = totals.novosConsultores || 0;
    const novosAssociados = (totals as any).novosAssociados || 0;
    const converted =
      activeFunnel === 'associado'
        ? novosAssociados
        : activeFunnel === 'consultor'
          ? novosConsultores
          : novosConsultores + novosAssociados;
    const conversionRate = totalLeads > 0 ? ((converted / totalLeads) * 100).toFixed(1) : '0.0';
    const sources = (totals as any).sources || { quiz: 0, capture: 0, whatsapp: 0, recruitment: 0 };
    return { totalConsultants, totalLeads, hotLeads, converted, conversionRate, sources };
  }, [ranking, totals, activeFunnel]);

  const headerTitle = useMemo(() => {
    if (activeFunnel === 'all') return 'Painel Super Admin — Visão Geral';
    if (activeFunnel === 'associado') return 'Painel Super Admin — Associados';
    return 'Painel Super Admin — Consultores';
  }, [activeFunnel]);

  const isAssoc = activeFunnel === 'associado';
  const isAll = activeFunnel === 'all';
  const novosTitle = isAll
    ? 'Novos Consultores + Associados'
    : isAssoc
      ? 'Novos Associados'
      : 'Novos Consultores';
  const novosSubtitle = isAll
    ? 'Total convertido nos dois funis'
    : isAssoc
      ? 'Leads convertidos em Associados (proteção veicular)'
      : 'Leads convertidos em Consultores Top Brasil';

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
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{headerTitle}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {activeFunnel === 'all'
              ? 'Use o seletor de funil ao lado esquerdo para filtrar por Consultores ou Associados.'
              : 'Visão consolidada do funil selecionado. Troque no menu lateral para ver outro.'}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard title="Consultores Ativos" value={metrics.totalConsultants} icon={Users} />
          <StatCard title="Total de Leads" value={metrics.totalLeads} icon={TrendingUp} />
          <StatCard
            title={novosTitle}
            value={metrics.converted}
            subtitle={`${metrics.conversionRate}% conversão · ${novosSubtitle}`}
            icon={UserPlus}
            variant="success"
          />
          <StatCard title="Leads Quentes" value={metrics.hotLeads} icon={Flame} variant="warning" />
        </div>

        {/* Card de Origens dos Leads */}
        <Card className="p-4 sm:p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
            Origens dos Leads {isAll ? '(todos os funis)' : `(funil ${isAssoc ? 'Associados' : 'Consultores'})`}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: 'quiz', label: 'Quiz', val: metrics.sources.quiz, cls: 'text-primary bg-primary/10 border-primary/30' },
              { key: 'capture', label: 'Captura', val: metrics.sources.capture, cls: 'text-blue-500 bg-blue-500/10 border-blue-500/30' },
              { key: 'whatsapp', label: 'WhatsApp', val: metrics.sources.whatsapp, cls: 'text-green-600 bg-green-500/10 border-green-500/30' },
              { key: 'recruitment', label: 'Recrutamento', val: metrics.sources.recruitment, cls: 'text-purple-500 bg-purple-500/10 border-purple-500/30' },
            ].map((s) => (
              <div key={s.key} className={`rounded-lg border p-3 ${s.cls}`}>
                <p className="text-xs font-medium opacity-80">{s.label}</p>
                <p className="text-2xl font-bold">{s.val}</p>
              </div>
            ))}
          </div>
        </Card>

        <SuperAdminCharts funnel={funnelForQuery} />

        {/* Tabela de consultores */}
        <ConsultantsTable />
      </div>
    </AdminLayout>
  );
}
