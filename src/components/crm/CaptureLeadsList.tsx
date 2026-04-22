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
  Loader2,
  FileText,
  Flame,
  Snowflake,
  Thermometer
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getCurrentConsultant, isSuperAdmin } from '@/lib/consultant-context';
import { useFunnel } from '@/contexts/FunnelContext';
import { FunnelBadge } from '@/components/leads/FunnelBadge';

interface CaptureLeadsListProps {
  onStartConversation: (phone: string, leadData: any) => void;
}

type TemperatureFilter = 'all' | 'hot' | 'warm' | 'cold';

export function CaptureLeadsList({ onStartConversation }: CaptureLeadsListProps) {
  const [leads, setLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [temperatureFilter, setTemperatureFilter] = useState<TemperatureFilter>('all');
  const { activeFunnel } = useFunnel();

  useEffect(() => {
    loadLeads();

    const channel = supabase
      .channel('capture-leads-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quiz_submissions_new' },
        () => loadLeads()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeFunnel]);

  const loadLeads = async () => {
    try {
      setIsLoading(true);

      const currentUser = await getCurrentConsultant();
      if (!currentUser) {
        toast.error('Erro ao identificar usuário');
        setLeads([]);
        return;
      }

      let query = supabase
        .from('quiz_submissions_new')
        .select('*')
        .eq('lead_source', 'capture')
        .not('phone', 'is', null)
        .order('created_at', { ascending: false });

      if (!isSuperAdmin(currentUser.role)) {
        query = query.eq('consultant_id', currentUser.id);
      } else {
        query = query.eq('organization_id', currentUser.organization_id);
      }

      if (activeFunnel !== 'all') {
        query = query.eq('funnel_type', activeFunnel);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
      toast.error('Erro ao carregar leads da captura');
    } finally {
      setIsLoading(false);
    }
  };

  const counts = {
    all: leads.length,
    hot: leads.filter(l => l.temperature === 'hot').length,
    warm: leads.filter(l => l.temperature === 'warm').length,
    cold: leads.filter(l => l.temperature === 'cold').length,
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone?.includes(searchQuery) ||
      lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.location?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (temperatureFilter !== 'all' && lead.temperature !== temperatureFilter) return false;

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
    <div 
      className="h-full flex flex-col overflow-hidden w-full max-w-full no-x-scroll overscroll-x-none touch-pan-y"
      style={{ overflowX: 'hidden', maxWidth: '100%' }}
    >
      {/* Header */}
      <div className="p-4 border-b border-border bg-gradient-to-r from-blue-500/10 to-transparent flex-shrink-0 overflow-x-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <h2 className="text-lg font-bold text-foreground truncate">Leads da Captura</h2>
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
            placeholder="Buscar por nome, telefone ou email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 glass border-border w-full"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 pb-1 max-w-full overflow-x-hidden">
          <Button
            variant={temperatureFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTemperatureFilter('all')}
            className={`text-xs sm:text-sm ${temperatureFilter === 'all' ? 'bg-primary' : 'glass'}`}
          >
            Todos ({counts.all})
          </Button>
          <Button
            variant={temperatureFilter === 'hot' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTemperatureFilter('hot')}
            className={`text-xs sm:text-sm ${temperatureFilter === 'hot' ? 'bg-red-600 hover:bg-red-700' : 'glass border-red-600/30 text-red-500 hover:bg-red-600/20'}`}
          >
            <Flame className="w-3.5 h-3.5 mr-1" />
            ({counts.hot})
          </Button>
          <Button
            variant={temperatureFilter === 'warm' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTemperatureFilter('warm')}
            className={`text-xs sm:text-sm ${temperatureFilter === 'warm' ? 'bg-yellow-600 hover:bg-yellow-700' : 'glass border-yellow-600/30 text-yellow-500 hover:bg-yellow-600/20'}`}
          >
            <Thermometer className="w-3.5 h-3.5 mr-1" />
            ({counts.warm})
          </Button>
          <Button
            variant={temperatureFilter === 'cold' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTemperatureFilter('cold')}
            className={`text-xs sm:text-sm ${temperatureFilter === 'cold' ? 'bg-blue-600 hover:bg-blue-700' : 'glass border-blue-600/30 text-blue-500 hover:bg-blue-600/20'}`}
          >
            <Snowflake className="w-3.5 h-3.5 mr-1" />
            ({counts.cold})
          </Button>
        </div>
      </div>

      {/* Lead List */}
      <ScrollArea className="flex-1 overflow-x-hidden w-full max-w-full no-x-scroll overscroll-x-none">
        <div className="p-4 space-y-3 overflow-x-hidden w-full max-w-full">
          {filteredLeads.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">Nenhum lead da página de captura encontrado</p>
            </div>
          ) : (
            filteredLeads.map(lead => (
              <Card key={lead.id} className="glass p-4 hover:border-blue-500/50 transition-all overflow-hidden w-full max-w-full">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  {/* Avatar + Info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                      {lead.name?.[0]?.toUpperCase() || '?'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-foreground truncate text-sm">
                          {lead.name || 'Sem nome'}
                        </h3>
                        <TemperatureBadge temperature={lead.temperature} />
                        <FunnelBadge funnel={lead.funnel_type} size="xs" />
                      </div>

                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        {lead.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{lead.phone}</span>
                          </div>
                        )}
                        {lead.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{lead.email}</span>
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
                      </div>
                    </div>
                  </div>

                  {/* Action */}
                  <Button
                    size="sm"
                    onClick={() => onStartConversation(lead.phone, lead)}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 w-full sm:w-auto flex-shrink-0"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Conversar
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
