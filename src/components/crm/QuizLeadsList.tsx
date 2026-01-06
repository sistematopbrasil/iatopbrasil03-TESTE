import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TemperatureBadge } from '@/components/ui/temperature-badge';
import { 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar,
  MessageSquare,
  CheckCircle,
  XCircle,
  Loader2,
  Users,
  Flame,
  Snowflake,
  Thermometer
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getCurrentConsultant, isSuperAdmin } from '@/lib/consultant-context';

interface QuizLeadsListProps {
  onStartConversation: (phone: string, leadData: any) => void;
}

type TemperatureFilter = 'all' | 'hot' | 'warm' | 'cold';
type StatusFilter = 'all' | 'completed' | 'incomplete';

export function QuizLeadsList({ onStartConversation }: QuizLeadsListProps) {
  const [leads, setLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [temperatureFilter, setTemperatureFilter] = useState<TemperatureFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    loadLeads();

    // Realtime subscription para atualização automática
    const channel = supabase
      .channel('quiz-leads-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quiz_submissions_new' },
        () => {
          console.log('🔔 Leads atualizados');
          loadLeads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadLeads = async () => {
    try {
      setIsLoading(true);

      // Buscar usuário logado para filtrar por consultant_id ou organization_id
      const currentUser = await getCurrentConsultant();
      if (!currentUser) {
        toast.error('Erro ao identificar usuário');
        setLeads([]);
        return;
      }

      let query = supabase
        .from('quiz_submissions_new')
        .select('*')
        .not('phone', 'is', null)
        .order('created_at', { ascending: false });

      // Filtrar por consultant_id se não for super admin
      if (!isSuperAdmin(currentUser.role)) {
        query = query.eq('consultant_id', currentUser.id);
      } else {
        // Super admin vê todos da organização
        query = query.eq('organization_id', currentUser.organization_id);
      }

      const { data, error } = await query;

      if (error) throw error;

      setLeads(data || []);
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
      toast.error('Erro ao carregar leads do quiz');
    } finally {
      setIsLoading(false);
    }
  };

  // Count by temperature
  const counts = {
    all: leads.length,
    hot: leads.filter(l => l.temperature === 'hot').length,
    warm: leads.filter(l => l.temperature === 'warm').length,
    cold: leads.filter(l => l.temperature === 'cold').length,
  };

  // Count by completion
  const statusCounts = {
    all: leads.length,
    completed: leads.filter(l => (l.completion_percentage ?? 0) === 100).length,
    incomplete: leads.filter(l => (l.completion_percentage ?? 0) < 100).length,
  };

  // Filter leads
  const filteredLeads = leads.filter(lead => {
    // Search
    const matchesSearch = 
      lead.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone?.includes(searchQuery) ||
      lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.location?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Completion status
    const completion = lead.completion_percentage ?? 0;
    if (statusFilter === 'completed' && completion !== 100) return false;
    if (statusFilter === 'incomplete' && completion >= 100) return false;

    // Temperature
    if (temperatureFilter !== 'all' && lead.temperature !== temperatureFilter) {
      return false;
    }

    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-gradient-to-r from-primary/10 to-transparent flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="w-5 h-5 text-primary flex-shrink-0" />
            <h2 className="text-lg font-bold text-foreground truncate">Leads do Quiz</h2>
            <Badge variant="outline" className="flex-shrink-0">{leads.length}</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={loadLeads} className="glass flex-shrink-0">
            Atualizar
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 glass border-border w-full"
          />
        </div>

        {/* Unified Filters - scrollable on mobile */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
          <Button
            variant={temperatureFilter === 'all' && statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setTemperatureFilter('all'); setStatusFilter('all'); }}
            className={`flex-shrink-0 ${temperatureFilter === 'all' && statusFilter === 'all' ? 'bg-primary' : 'glass'}`}
          >
            Todos ({counts.all})
          </Button>
          <Button
            variant={temperatureFilter === 'hot' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setTemperatureFilter('hot'); setStatusFilter('all'); }}
            className={`flex-shrink-0 ${temperatureFilter === 'hot' ? 'bg-red-600 hover:bg-red-700' : 'glass border-red-600/30 text-red-500 hover:bg-red-600/20'}`}
          >
            <Flame className="w-4 h-4 mr-1" />
            ({counts.hot})
          </Button>
          <Button
            variant={temperatureFilter === 'warm' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setTemperatureFilter('warm'); setStatusFilter('all'); }}
            className={`flex-shrink-0 ${temperatureFilter === 'warm' ? 'bg-yellow-600 hover:bg-yellow-700' : 'glass border-yellow-600/30 text-yellow-500 hover:bg-yellow-600/20'}`}
          >
            <Thermometer className="w-4 h-4 mr-1" />
            ({counts.warm})
          </Button>
          <Button
            variant={temperatureFilter === 'cold' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setTemperatureFilter('cold'); setStatusFilter('all'); }}
            className={`flex-shrink-0 ${temperatureFilter === 'cold' ? 'bg-blue-600 hover:bg-blue-700' : 'glass border-blue-600/30 text-blue-500 hover:bg-blue-600/20'}`}
          >
            <Snowflake className="w-4 h-4 mr-1" />
            ({counts.cold})
          </Button>
          
          {/* Separador visual */}
          <div className="w-px h-6 bg-border self-center mx-1 hidden sm:block" />
          
          <Button
            variant={statusFilter === 'completed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setStatusFilter('completed'); setTemperatureFilter('all'); }}
            className={`flex-shrink-0 ${statusFilter === 'completed' ? 'bg-green-600 hover:bg-green-700' : 'glass border-green-600/30 text-green-500 hover:bg-green-600/20'}`}
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            ({statusCounts.completed})
          </Button>
          <Button
            variant={statusFilter === 'incomplete' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setStatusFilter('incomplete'); setTemperatureFilter('all'); }}
            className={`flex-shrink-0 ${statusFilter === 'incomplete' ? 'bg-orange-600 hover:bg-orange-700' : 'glass border-orange-600/30 text-orange-500 hover:bg-orange-600/20'}`}
          >
            <XCircle className="w-4 h-4 mr-1" />
            ({statusCounts.incomplete})
          </Button>
        </div>
      </div>

      {/* Lead List */}
      <ScrollArea className="flex-1 overflow-x-hidden">
        <div className="p-4 space-y-3 overflow-x-hidden">
          {filteredLeads.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">Nenhum lead encontrado</p>
            </div>
          ) : (
            filteredLeads.map(lead => (
              <Card key={lead.id} className="glass p-4 hover:border-primary/50 transition-all overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  {/* Avatar + Info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-primary-foreground font-bold flex-shrink-0">
                      {lead.name?.[0]?.toUpperCase() || '?'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground truncate text-sm">
                          {lead.name || 'Sem nome'}
                        </h3>
                        <TemperatureBadge temperature={lead.temperature} />
                      </div>

                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        {lead.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{lead.phone}</span>
                          </div>
                        )}
                        {lead.location && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{lead.location}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 flex-shrink-0" />
                          <span>
                            {formatDistanceToNow(new Date(lead.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                        </div>

                        {/* Conclusão do quiz */}
                        <div className="pt-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${lead.completion_percentage || 0}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground min-w-[40px] text-right">
                              {lead.completion_percentage || 0}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action */}
                  <Button
                    size="sm"
                    onClick={() => onStartConversation(lead.phone, lead)}
                    className="bg-gradient-to-r from-primary to-primary-light w-full sm:w-auto flex-shrink-0"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Conversar
                  </Button>
                </div>

                {/* Quiz Answers (Expandable) */}
                <details className="mt-4 pt-4 border-t border-border">
                  <summary className="text-sm text-primary cursor-pointer hover:text-primary/80 font-medium">
                    Ver respostas do quiz
                  </summary>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <QuizAnswer label="Idade" value={lead.age ? `${lead.age} anos` : null} />
                    <QuizAnswer label="Possui Veículo" value={lead.has_vehicle} />
                    <QuizAnswer label="Possui CNH" value={lead.has_driver_license} />
                    <QuizAnswer label="Situação Atual" value={lead.employment_status} />
                    <QuizAnswer label="Experiência em Vendas" value={lead.sales_experience} />
                    <QuizAnswer label="Conhece Proteção Veicular" value={lead.vehicle_protection_experience} />
                    <QuizAnswer label="Renda Desejada" value={lead.desired_income} />
                    <QuizAnswer label="Motivação" value={lead.motivation} />
                  </div>
                  
                  {/* Respostas Adicionais */}
                  {lead.extra_answers && Object.keys(lead.extra_answers).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Respostas Adicionais</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {Object.entries(lead.extra_answers as Record<string, { question: string; answer: string; order_index?: number }>)
                          .sort((a, b) => (a[1].order_index || 0) - (b[1].order_index || 0))
                          .map(([key, value]) => (
                            <QuizAnswer key={key} label={value.question} value={value.answer} />
                          ))}
                      </div>
                    </div>
                  )}
                </details>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Helper Component
function QuizAnswer({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between items-center p-2 rounded bg-muted/50">
      <span className="text-muted-foreground">{label}:</span>
      <span className="text-foreground font-medium truncate ml-2">{value || '-'}</span>
    </div>
  );
}
