import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentConsultant, getQuizUrl } from '@/lib/consultant-context';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Users, Flame, Trophy, Target, Copy, ExternalLink, Calendar, User, Phone, MapPin, Briefcase, MessageCircle, Thermometer, Snowflake, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { getUserLevel, getProgressToNextLevel, getNextLevel } from '@/lib/ranking-service';
import { TemperatureBadge } from '@/components/ui/temperature-badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, LineChart, Line, CartesianGrid } from 'recharts';

interface Lead {
  id: string;
  name: string | null;
  phone: string | null;
  created_at: string;
  temperature: 'hot' | 'warm' | 'cold' | null;
  lead_score: number | null;
  location: string | null;
  has_vehicle: string | null;
  has_driver_license: string | null;
  sales_experience: string | null;
  employment_status: string | null;
  pipeline_stage_id: string | null;
  relationship_status: string | null;
  vehicle_protection_experience: string | null;
  current_income: string | null;
}

const TEMP_COLORS = {
  hot: '#f97316',
  warm: '#eab308',
  cold: '#3b82f6',
};

export function ConsultantDashboard() {
  const navigate = useNavigate();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const { data: currentUser } = useQuery({
    queryKey: ['current-user-consultant'],
    queryFn: getCurrentConsultant,
  });

  const { data: leads } = useQuery({
    queryKey: ['all-leads-consultant', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];
      const { data } = await supabase
        .from('quiz_submissions_new')
        .select('id, name, phone, created_at, temperature, lead_score, location, has_vehicle, has_driver_license, sales_experience, employment_status, pipeline_stage_id, relationship_status, vehicle_protection_experience, current_income')
        .eq('consultant_id', currentUser.id)
        .eq('completion_percentage', 100)
        .order('created_at', { ascending: false });
      return (data || []) as Lead[];
    },
    enabled: !!currentUser,
  });

  const { data: pipelineStages } = useQuery({
    queryKey: ['pipeline-stages', currentUser?.organization_id],
    queryFn: async () => {
      if (!currentUser) return [];
      const { data } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('organization_id', currentUser.organization_id)
        .order('order_index');
      return data || [];
    },
    enabled: !!currentUser,
  });

  const metrics = useMemo(() => {
    if (!leads) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const leadsToday = leads.filter(l => new Date(l.created_at) >= today).length;
    const leadsYesterday = leads.filter(l => {
      const date = new Date(l.created_at);
      return date >= yesterday && date <= yesterdayEnd;
    }).length;
    const leads7Days = leads.filter(l => new Date(l.created_at) >= sevenDaysAgo).length;
    const totalLeads = leads.length;
    const hotLeads = leads.filter(l => l.temperature === 'hot').length;
    const warmLeads = leads.filter(l => l.temperature === 'warm').length;
    const coldLeads = leads.filter(l => l.temperature === 'cold').length;

    // Find conversion stage
    const conversionStage = pipelineStages?.find(s =>
      s.name.toLowerCase().includes('convertido') ||
      s.name.toLowerCase().includes('fechado') ||
      s.name.toLowerCase().includes('ganho')
    );
    const convertedLeads = conversionStage
      ? leads.filter(l => l.pipeline_stage_id === conversionStage.id).length
      : 0;

    // Best capture hour
    const hourCounts: Record<number, number> = {};
    leads.forEach(l => {
      const hour = new Date(l.created_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const bestHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    const peakHour = bestHour ? `${bestHour[0]}h` : '--';

    return {
      leadsToday,
      leadsYesterday,
      leads7Days,
      totalLeads,
      hotLeads,
      warmLeads,
      coldLeads,
      convertedLeads,
      peakHour,
    };
  }, [leads, pipelineStages]);

  // Temperature distribution for donut chart
  const temperatureData = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: 'Quentes', value: metrics.hotLeads, color: TEMP_COLORS.hot },
      { name: 'Mornos', value: metrics.warmLeads, color: TEMP_COLORS.warm },
      { name: 'Frios', value: metrics.coldLeads, color: TEMP_COLORS.cold },
    ].filter(d => d.value > 0);
  }, [metrics]);

  // Pipeline distribution for bar chart
  const pipelineData = useMemo(() => {
    if (!leads || !pipelineStages) return [];
    const stageCounts: Record<string, { name: string; count: number; color: string }> = {};
    pipelineStages.forEach(stage => {
      stageCounts[stage.id] = { name: stage.name, count: 0, color: stage.color };
    });
    leads.forEach(lead => {
      if (lead.pipeline_stage_id && stageCounts[lead.pipeline_stage_id]) {
        stageCounts[lead.pipeline_stage_id].count++;
      }
    });
    return Object.values(stageCounts).filter(s => s.count > 0);
  }, [leads, pipelineStages]);

  // Weekly evolution for line chart
  const weeklyData = useMemo(() => {
    if (!leads) return [];
    const days: Record<string, number> = {};
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const key = format(date, 'dd/MM');
      days[key] = 0;
    }
    leads.forEach(lead => {
      const date = new Date(lead.created_at);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      if (date >= sevenDaysAgo) {
        const key = format(date, 'dd/MM');
        if (days[key] !== undefined) days[key]++;
      }
    });
    return Object.entries(days).map(([name, leads]) => ({ name, leads }));
  }, [leads]);

  const recentLeads = leads?.slice(0, 5) || [];

  const copyQuizLink = () => {
    if (currentUser?.quiz_slug) {
      navigator.clipboard.writeText(getQuizUrl(currentUser.quiz_slug));
      toast.success('Link do seu quiz copiado!');
    }
  };

  const openQuizLink = () => {
    if (currentUser?.quiz_slug) {
      window.open(getQuizUrl(currentUser.quiz_slug), '_blank');
    }
  };

  const handleOpenConversation = (lead: Lead) => {
    navigate('/admin/crm', {
      state: {
        openConversation: true,
        phone: lead.phone,
        leadData: lead
      }
    });
  };

  const getTemperatureColor = (temp: string | null) => {
    if (temp === 'hot') return 'bg-orange-500';
    if (temp === 'warm') return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const getTemperatureLabel = (temp: string | null) => {
    if (temp === 'hot') return '🔥 Quente';
    if (temp === 'warm') return '🌡️ Morno';
    return '❄️ Frio';
  };

  if (!metrics) {
    return (
      <div className="space-y-6 overflow-x-hidden max-w-full">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-x-hidden max-w-full">
      {/* Link do Quiz */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground">Seu Link do Quiz</h3>
              <p className="text-sm text-muted-foreground">Compartilhe para capturar leads</p>
              {currentUser?.quiz_slug && (
                <code className="text-xs bg-background px-2 py-1 rounded mt-1 inline-block max-w-full overflow-hidden text-ellipsis">
                  {getQuizUrl(currentUser.quiz_slug)}
                </code>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button size="sm" onClick={copyQuizLink}>
                <Copy className="w-4 h-4 mr-2" />
                Copiar
              </Button>
              <Button size="sm" variant="outline" onClick={openQuizLink}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Abrir
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métricas em grid responsivo - 2 linhas */}
      <div className="space-y-3">
        {/* Linha 1: Métricas de tempo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
          <StatCard title="Leads Hoje" value={metrics.leadsToday} icon={Target} variant="primary" />
          <StatCard title="Leads Ontem" value={metrics.leadsYesterday} icon={Clock} />
          <StatCard title="Últimos 7 dias" value={metrics.leads7Days} icon={Calendar} />
          <StatCard title="Total de Leads" value={metrics.totalLeads} icon={Users} />
        </div>
        {/* Linha 2: Métricas de temperatura */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
          <StatCard title="❄️ Frios" value={metrics.coldLeads} icon={Snowflake} variant="info" />
          <StatCard title="🌡️ Mornos" value={metrics.warmLeads} icon={Thermometer} />
          <StatCard title="🔥 Quentes" value={metrics.hotLeads} icon={Flame} variant="warning" />
          <StatCard title="✅ Convertidos" value={metrics.convertedLeads} icon={CheckCircle} variant="success" />
        </div>
      </div>

      {/* Linha 3: Gráficos lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Donut: Distribuição por Temperatura */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribuição por Temperatura</CardTitle>
          </CardHeader>
          <CardContent>
            {temperatureData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={temperatureData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                  >
                    {temperatureData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    formatter={(value: number) => [`${value} leads`, '']}
                  />
                  <Legend
                    formatter={(value, entry: any) => (
                      <span className="text-foreground text-xs">{value} ({entry.payload.value})</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground">
                Sem dados de temperatura
              </div>
            )}
          </CardContent>
        </Card>

        {/* Barras: Leads por Quadro */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Leads por Quadro do Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            {pipelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={pipelineData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    formatter={(value: number) => [`${value} leads`, '']}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {pipelineData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground">
                Sem leads no pipeline
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Linha 4: Evolução Semanal */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evolução Semanal de Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weeklyData} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                formatter={(value: number) => [`${value} leads`, '']}
              />
              <Line type="monotone" dataKey="leads" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Linha 5: Últimos Leads */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Últimos Leads</CardTitle>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/leads')}>
            Ver todos
          </Button>
        </CardHeader>
        <CardContent>
          {recentLeads.length > 0 ? (
            <div className="space-y-3">
              {recentLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedLead(lead)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{lead.name || 'Sem nome'}</p>
                    <p className="text-sm text-muted-foreground truncate">{lead.phone || 'Sem telefone'}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    {lead.temperature && <TemperatureBadge temperature={lead.temperature} size="sm" />}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(lead.created_at), "dd/MM", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum lead capturado ainda.</p>
              <p className="text-sm mt-1">Compartilhe seu link do quiz para começar!</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lead Details Popup */}
      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Detalhes do Lead
            </DialogTitle>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{selectedLead.name || 'Sem nome'}</h3>
                <Badge className={`${getTemperatureColor(selectedLead.temperature)} text-white`}>
                  {getTemperatureLabel(selectedLead.temperature)}
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                {selectedLead.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedLead.phone}</span>
                  </div>
                )}
                {selectedLead.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedLead.location}</span>
                  </div>
                )}
                {selectedLead.employment_status && (
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedLead.employment_status}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{format(new Date(selectedLead.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}</span>
                </div>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Qualificação</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={selectedLead.relationship_status?.toLowerCase().includes('casado') ? 'text-green-500' : 'text-muted-foreground'}>
                      {selectedLead.relationship_status?.toLowerCase().includes('casado') ? '✓' : '✗'}
                    </span>
                    <span>Casado(a)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={selectedLead.has_vehicle && selectedLead.has_vehicle !== 'Não tenho veículo.' ? 'text-green-500' : 'text-muted-foreground'}>
                      {selectedLead.has_vehicle && selectedLead.has_vehicle !== 'Não tenho veículo.' ? '✓' : '✗'}
                    </span>
                    <span>Possui veículo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={selectedLead.has_driver_license?.toLowerCase().includes('sim') ? 'text-green-500' : 'text-muted-foreground'}>
                      {selectedLead.has_driver_license?.toLowerCase().includes('sim') ? '✓' : '✗'}
                    </span>
                    <span>Possui CNH</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={selectedLead.sales_experience?.toLowerCase().includes('já trabalho') || selectedLead.sales_experience?.toLowerCase().includes('já trabalhei') ? 'text-green-500' : 'text-muted-foreground'}>
                      {selectedLead.sales_experience?.toLowerCase().includes('já trabalho') || selectedLead.sales_experience?.toLowerCase().includes('já trabalhei') ? '✓' : '✗'}
                    </span>
                    <span>Exp. vendas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={selectedLead.vehicle_protection_experience?.toLowerCase() === 'sim' ? 'text-green-500' : 'text-muted-foreground'}>
                      {selectedLead.vehicle_protection_experience?.toLowerCase() === 'sim' ? '✓' : '✗'}
                    </span>
                    <span>Proteção veicular</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">💰</span>
                    <span className="truncate">{selectedLead.current_income || 'Não informado'}</span>
                  </div>
                </div>
              </div>

              {selectedLead.phone && (
                <Button
                  className="w-full"
                  onClick={() => {
                    handleOpenConversation(selectedLead);
                    setSelectedLead(null);
                  }}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Abrir conversa no CRM
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
