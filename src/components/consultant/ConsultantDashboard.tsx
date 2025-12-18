import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentConsultant, getQuizUrl } from '@/lib/consultant-context';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Users, Flame, Trophy, Target, Copy, ExternalLink, Calendar, User, Phone, MapPin, Briefcase, MessageCircle } from 'lucide-react';
import { getUserLevel, getProgressToNextLevel, getNextLevel } from '@/lib/ranking-service';
import { TemperatureBadge } from '@/components/ui/temperature-badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

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
}

export function ConsultantDashboard() {
  const navigate = useNavigate();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const { data: currentUser } = useQuery({
    queryKey: ['current-user-consultant'],
    queryFn: getCurrentConsultant,
  });

  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['consultant-metrics', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return null;

      // Leads de hoje
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: leadsToday } = await supabase
        .from('quiz_submissions_new')
        .select('*', { count: 'exact', head: true })
        .eq('consultant_id', currentUser.id)
        .eq('completion_percentage', 100)
        .gte('created_at', today.toISOString());

      // Leads últimos 7 dias
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const { count: leads7Days } = await supabase
        .from('quiz_submissions_new')
        .select('*', { count: 'exact', head: true })
        .eq('consultant_id', currentUser.id)
        .eq('completion_percentage', 100)
        .gte('created_at', sevenDaysAgo.toISOString());

      // Total de leads
      const { count: totalLeads } = await supabase
        .from('quiz_submissions_new')
        .select('*', { count: 'exact', head: true })
        .eq('consultant_id', currentUser.id)
        .eq('completion_percentage', 100);

      // Leads quentes
      const { count: hotLeads } = await supabase
        .from('quiz_submissions_new')
        .select('*', { count: 'exact', head: true })
        .eq('consultant_id', currentUser.id)
        .eq('temperature', 'hot');

      // Posição no ranking
      const { data: allConsultants } = await supabase
        .from('quiz_submissions_new')
        .select('consultant_id')
        .eq('organization_id', currentUser.organization_id)
        .eq('completion_percentage', 100);

      // Contar leads por consultant
      const leadsPerConsultant: Record<string, number> = {};
      allConsultants?.forEach(l => {
        if (l.consultant_id) {
          leadsPerConsultant[l.consultant_id] = (leadsPerConsultant[l.consultant_id] || 0) + 1;
        }
      });

      // Ordenar e encontrar posição
      const sorted = Object.entries(leadsPerConsultant)
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id);
      
      const position = sorted.indexOf(currentUser.id) + 1 || sorted.length + 1;

      return {
        leadsToday: leadsToday || 0,
        leads7Days: leads7Days || 0,
        totalLeads: totalLeads || 0,
        hotLeads: hotLeads || 0,
        rankingPosition: position,
        totalConsultants: Object.keys(leadsPerConsultant).length || 1,
      };
    },
    enabled: !!currentUser,
  });

  const { data: recentLeads } = useQuery({
    queryKey: ['recent-leads-consultant', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];

      const { data } = await supabase
        .from('quiz_submissions_new')
        .select('id, name, phone, created_at, temperature, lead_score, location, has_vehicle, has_driver_license, sales_experience, employment_status')
        .eq('consultant_id', currentUser.id)
        .eq('completion_percentage', 100)
        .order('created_at', { ascending: false })
        .limit(5);

      return (data || []) as Lead[];
    },
    enabled: !!currentUser,
  });

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

  if (loadingMetrics) {
    return (
      <div className="space-y-6 overflow-x-hidden max-w-full">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
          {[...Array(5)].map((_, i) => (
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
              <p className="text-sm text-muted-foreground">
                Compartilhe para capturar leads
              </p>
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

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <StatCard
          title="Leads Hoje"
          value={metrics?.leadsToday || 0}
          icon={Target}
          variant="primary"
        />
        <StatCard
          title="Últimos 7 dias"
          value={metrics?.leads7Days || 0}
          icon={Calendar}
        />
        <StatCard
          title="Total de Leads"
          value={metrics?.totalLeads || 0}
          icon={Users}
        />
        <StatCard
          title="Leads Quentes"
          value={metrics?.hotLeads || 0}
          icon={Flame}
          variant="warning"
        />
        <StatCard
          title="Posição no Ranking"
          value={`#${metrics?.rankingPosition}`}
          subtitle={`de ${metrics?.totalConsultants}`}
          icon={Trophy}
          variant="info"
        />
      </div>

      {/* Últimos Leads */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Últimos Leads</CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/admin/leads')}
          >
            Ver todos
          </Button>
        </CardHeader>
        <CardContent>
          {recentLeads && recentLeads.length > 0 ? (
            <div className="space-y-3">
              {recentLeads.map((lead) => (
                <div 
                  key={lead.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedLead(lead)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {lead.name || 'Sem nome'}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {lead.phone || 'Sem telefone'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    {lead.temperature && (
                      <TemperatureBadge temperature={lead.temperature} size="sm" />
                    )}
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
              {/* Nome e temperatura */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{selectedLead.name || 'Sem nome'}</h3>
                <Badge className={`${getTemperatureColor(selectedLead.temperature)} text-white`}>
                  {getTemperatureLabel(selectedLead.temperature)}
                </Badge>
              </div>

              {/* Informações */}
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

              {/* Critérios de qualificação */}
              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Qualificação</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={selectedLead.has_vehicle && selectedLead.has_vehicle !== 'Não tenho veículo' ? 'text-green-500' : 'text-muted-foreground'}>
                      {selectedLead.has_vehicle && selectedLead.has_vehicle !== 'Não tenho veículo' ? '✓' : '✗'}
                    </span>
                    <span>Possui veículo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={selectedLead.has_driver_license?.toLowerCase().includes('sim') ? 'text-green-500' : 'text-muted-foreground'}>
                      {selectedLead.has_driver_license?.toLowerCase().includes('sim') ? '✓' : '✗'}
                    </span>
                    <span>Possui CNH</span>
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <span className={selectedLead.sales_experience?.toLowerCase().includes('já trabalho') || selectedLead.sales_experience?.toLowerCase().includes('já trabalhei') ? 'text-green-500' : 'text-muted-foreground'}>
                      {selectedLead.sales_experience?.toLowerCase().includes('já trabalho') || selectedLead.sales_experience?.toLowerCase().includes('já trabalhei') ? '✓' : '✗'}
                    </span>
                    <span>Experiência em vendas</span>
                  </div>
                </div>
              </div>

              {/* Botão de ação */}
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
