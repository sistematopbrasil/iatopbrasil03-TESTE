import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentConsultant } from '@/lib/consultant-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Loader2 } from 'lucide-react';
import type { FunnelType } from '@/lib/funnel-types';

const TEMP_COLORS = {
  hot: '#ef4444',
  warm: '#f97316',
  cold: '#3b82f6',
};

interface SuperAdminChartsProps {
  /**
   * Filtra os gráficos por funil. Quando undefined mantém o comportamento legado
   * (todos os funis somados).
   */
  funnel?: FunnelType;
}

export function SuperAdminCharts({ funnel }: SuperAdminChartsProps = {}) {
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentConsultant,
  });

  // Gráfico 1: Leads por dia (últimos 30 dias)
  const { data: leadsPerDay, isLoading: loadingLeads } = useQuery({
    queryKey: ['leads-per-day', currentUser?.organization_id, funnel ?? 'all'],
    queryFn: async () => {
      if (!currentUser) return [];

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let query = supabase
        .from('quiz_submissions_new')
        .select('created_at, funnel_type')
        .eq('organization_id', currentUser.organization_id)
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (funnel) {
        query = query.eq('funnel_type', funnel);
      }

      const { data } = await query;

      const grouped: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        grouped[dateStr] = 0;
      }

      data?.forEach(item => {
        const date = new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        grouped[date] = (grouped[date] || 0) + 1;
      });

      return Object.entries(grouped).map(([date, leads]) => ({ date, leads }));
    },
    enabled: !!currentUser,
  });

  // Gráfico 2: Top 5 consultores por leads
  const { data: topConsultants, isLoading: loadingTop } = useQuery({
    queryKey: ['top-consultants', currentUser?.organization_id, funnel ?? 'all'],
    queryFn: async () => {
      if (!currentUser) return [];

      let query = supabase
        .from('quiz_submissions_new')
        .select('consultant_id, funnel_type')
        .eq('organization_id', currentUser.organization_id)
        .not('consultant_id', 'is', null);

      if (funnel) {
        query = query.eq('funnel_type', funnel);
      }

      const { data: leads } = await query;

      const counts: Record<string, number> = {};
      leads?.forEach(l => {
        if (l.consultant_id) counts[l.consultant_id] = (counts[l.consultant_id] || 0) + 1;
      });

      const consultantIds = Object.keys(counts);
      if (consultantIds.length === 0) return [];

      const { data: consultants } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', consultantIds);

      return consultants
        ?.map(c => ({
          name: c.full_name.split(' ')[0],
          leads: counts[c.id] || 0,
        }))
        .sort((a, b) => b.leads - a.leads)
        .slice(0, 5) || [];
    },
    enabled: !!currentUser,
  });

  // Gráfico 3: Distribuição por temperatura
  const { data: temperatureDistribution, isLoading: loadingTemp } = useQuery({
    queryKey: ['temperature-distribution', currentUser?.organization_id, funnel ?? 'all'],
    queryFn: async () => {
      if (!currentUser) return [];

      let query = supabase
        .from('quiz_submissions_new')
        .select('temperature, funnel_type')
        .eq('organization_id', currentUser.organization_id);

      if (funnel) {
        query = query.eq('funnel_type', funnel);
      }

      const { data } = await query;

      const grouped: Record<string, number> = { hot: 0, warm: 0, cold: 0 };
      data?.forEach(item => {
        const temp = item.temperature || 'cold';
        grouped[temp] = (grouped[temp] || 0) + 1;
      });

      const labels: Record<string, string> = {
        hot: '🔥 Quente',
        warm: '🌡️ Morno',
        cold: '❄️ Frio',
      };

      return Object.entries(grouped)
        .filter(([_, value]) => value > 0)
        .map(([key, value]) => ({
          name: labels[key] || key,
          value,
          color: TEMP_COLORS[key as keyof typeof TEMP_COLORS] || '#888',
        }));
    },
    enabled: !!currentUser,
  });

  const isLoading = loadingLeads || loadingTop || loadingTemp;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-x-hidden max-w-full">
      <Card className="lg:col-span-2 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg">📈 Leads Capturados (30 dias)</CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <div className="w-full h-[200px] sm:h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={leadsPerDay} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" tickMargin={5} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={25} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Line type="monotone" dataKey="leads" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 2 }} activeDot={{ r: 4 }} name="Leads" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg">🏆 Top 5 Consultores{funnel === 'associado' ? ' (Funil Associados)' : funnel === 'consultor' ? ' (Funil Consultores)' : ''}</CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          {topConsultants && topConsultants.length > 0 ? (
            <div className="w-full h-[200px] sm:h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topConsultants} layout="vertical" margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Leads" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
              Nenhum dado disponível
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg">🌡️ Distribuição por Temperatura</CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          {temperatureDistribution && temperatureDistribution.length > 0 ? (
            <div className="w-full h-[200px] sm:h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <Pie data={temperatureDistribution} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`} outerRadius={65} fill="#8884d8" dataKey="value">
                    {temperatureDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(20 14% 10%)', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value: number, name: string) => [`${value} leads`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
              Nenhum dado disponível
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
