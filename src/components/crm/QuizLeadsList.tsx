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
  Zap
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

interface QuizLeadsListProps {
  onStartConversation: (phone: string, leadData: any) => void;
}

type TemperatureFilter = 'all' | 'hot' | 'warm' | 'cold';

export function QuizLeadsList({ onStartConversation }: QuizLeadsListProps) {
  const [leads, setLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [temperatureFilter, setTemperatureFilter] = useState<TemperatureFilter>('all');

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('quiz_submissions_new')
        .select('*')
        .not('phone', 'is', null)
        .eq('completion_percentage', 100)
        .order('created_at', { ascending: false });

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

  // Filter leads
  const filteredLeads = leads.filter(lead => {
    // Search
    const matchesSearch = 
      lead.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone?.includes(searchQuery) ||
      lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.location?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Leads do Quiz</h2>
            <Badge variant="outline" className="ml-2">{leads.length} total</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={loadLeads} className="glass">
            Atualizar
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone, email ou cidade..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 glass border-border"
          />
        </div>

        {/* Temperature Filters */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={temperatureFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTemperatureFilter('all')}
            className={temperatureFilter === 'all' ? 'bg-primary' : 'glass'}
          >
            Todos ({counts.all})
          </Button>
          <Button
            variant={temperatureFilter === 'hot' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTemperatureFilter('hot')}
            className={temperatureFilter === 'hot' ? 'bg-red-600 hover:bg-red-700' : 'glass border-red-600/30 text-red-500 hover:bg-red-600/20'}
          >
            <Flame className="w-4 h-4 mr-1" />
            Quentes ({counts.hot})
          </Button>
          <Button
            variant={temperatureFilter === 'warm' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTemperatureFilter('warm')}
            className={temperatureFilter === 'warm' ? 'bg-yellow-600 hover:bg-yellow-700' : 'glass border-yellow-600/30 text-yellow-500 hover:bg-yellow-600/20'}
          >
            <Zap className="w-4 h-4 mr-1" />
            Mornos ({counts.warm})
          </Button>
          <Button
            variant={temperatureFilter === 'cold' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTemperatureFilter('cold')}
            className={temperatureFilter === 'cold' ? 'bg-blue-600 hover:bg-blue-700' : 'glass border-blue-600/30 text-blue-500 hover:bg-blue-600/20'}
          >
            <Snowflake className="w-4 h-4 mr-1" />
            Frios ({counts.cold})
          </Button>
        </div>
      </div>

      {/* Lead List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {filteredLeads.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">Nenhum lead encontrado</p>
            </div>
          ) : (
            filteredLeads.map(lead => (
              <Card key={lead.id} className="glass p-4 hover:border-primary/50 transition-all">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-primary-foreground font-bold text-lg flex-shrink-0">
                    {lead.name?.[0]?.toUpperCase() || '?'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-foreground truncate">
                        {lead.name || 'Sem nome'}
                      </h3>
                      <TemperatureBadge temperature={lead.temperature} />
                      <Badge className="bg-green-600/20 text-green-500 border-green-600/30">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {lead.lead_score || 0} pts
                      </Badge>
                    </div>

                    <div className="space-y-1 text-sm text-muted-foreground">
                      {lead.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3 h-3" />
                          <span>{lead.phone}</span>
                        </div>
                      )}
                      {lead.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{lead.email}</span>
                        </div>
                      )}
                      {lead.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3" />
                          <span>{lead.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {formatDistanceToNow(new Date(lead.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Score Bar */}
                    <div className="mt-3">
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-primary-light transition-all"
                          style={{ width: `${lead.lead_score || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action */}
                  <Button
                    size="sm"
                    onClick={() => onStartConversation(lead.phone, lead)}
                    className="bg-gradient-to-r from-primary to-primary-light flex-shrink-0"
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
