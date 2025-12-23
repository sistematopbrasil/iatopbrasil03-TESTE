import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentConsultant } from '@/lib/consultant-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { Loader2 } from 'lucide-react';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--warning))', 'hsl(var(--success))', 'hsl(var(--info))', 'hsl(var(--destructive))'];
const TEMP_COLORS = {
  hot: '#f97316',   // Laranja vibrante
  warm: '#eab308', // Amarelo mais definido
  cold: '#06b6d4', // Ciano moderno
};

export function SuperAdminCharts() {
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentConsultant,
  });

  // Gráfico 1: Leads por dia (últimos 30 dias)
  const { data: leadsPerDay, isLoading: loadingLeads } = useQuery({
    queryKey: ['leads-per-day', currentUser?.organization_id],
    queryFn: async () => {
      if (!currentUser) return [];

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data } = await supabase
        .from('quiz_submissions_new')
        .select('created_at')
        .eq('organization_id', currentUser.organization_id)
        .eq('completion_percentage', 100)
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Agrupar por dia
      const grouped: Record<string, number> = {};
      
      // Preencher todos os dias dos últimos 30
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

      return Object.entries(grouped).map(([date, leads]) => ({
        date,
        leads,
      }));
    },
    enabled: !!currentUser,
  });

  // Gráfico 2: Top 5 consultores por leads
  const { data: topConsultants, isLoading: loadingTop } = useQuery({
    queryKey: ['top-consultants', currentUser?.organization_id],
    queryFn: async () => {
      if (!currentUser) return [];

      // Buscar leads por consultant
      const { data: leads } = await supabase
        .from('quiz_submissions_new')
        .select('consultant_id')
        .eq('organization_id', currentUser.organization_id)
        .eq('completion_percentage', 100)
        .not('consultant_id', 'is', null);

      // Contar por consultant
      const counts: Record<string, number> = {};
      leads?.forEach(l => {
        if (l.consultant_id) {
          counts[l.consultant_id] = (counts[l.consultant_id] || 0) + 1;
        }
      });

      // Buscar nomes dos consultores
      const consultantIds = Object.keys(counts);
      if (consultantIds.length === 0) return [];

      const { data: consultants } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', consultantIds);

      // Mapear e ordenar
      return consultants
        ?.map(c => ({
          name: c.full_name.split(' ')[0], // Primeiro nome
          leads: counts[c.id] || 0,
        }))
        .sort((a, b) => b.leads - a.leads)
        .slice(0, 5) || [];
    },
    enabled: !!currentUser,
  });

  // Gráfico 3: Distribuição por temperatura
  const { data: temperatureDistribution, isLoading: loadingTemp } = useQuery({
    queryKey: ['temperature-distribution', currentUser?.organization_id],
    queryFn: async () => {
      if (!currentUser) return [];

      const { data } = await supabase
        .from('quiz_submissions_new')
        .select('temperature')
        .eq('organization_id', currentUser.organization_id)
        .eq('completion_percentage', 100);

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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Gráfico 1: Leads por dia */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">📈 Leads Capturados (últimos 30 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={leadsPerDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Line 
                type="monotone" 
                dataKey="leads" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
                name="Leads"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico 2: Top consultores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🏆 Top 5 Consultores</CardTitle>
        </CardHeader>
        <CardContent>
          {topConsultants && topConsultants.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topConsultants} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={80}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar 
                  dataKey="leads" 
                  fill="hsl(var(--primary))" 
                  radius={[0, 4, 4, 0]}
                  name="Leads"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-muted-foreground">
              Nenhum dado disponível
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráfico 3: Distribuição por temperatura */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🌡️ Distribuição por Temperatura</CardTitle>
        </CardHeader>
        <CardContent>
          {temperatureDistribution && temperatureDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={temperatureDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {temperatureDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-muted-foreground">
              Nenhum dado disponível
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
