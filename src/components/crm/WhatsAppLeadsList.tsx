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
  MapPin, 
  Calendar,
  MessageSquare,
  Loader2,
  MessageCircle,
  RefreshCw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getCurrentConsultant, isSuperAdmin } from '@/lib/consultant-context';

interface WhatsAppLeadsListProps {
  onStartConversation: (phone: string, leadData: any) => void;
}

export function WhatsAppLeadsList({ onStartConversation }: WhatsAppLeadsListProps) {
  const [leads, setLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadLeads();

    // Realtime subscription para atualização automática
    const channel = supabase
      .channel('whatsapp-leads-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quiz_submissions_new' },
        () => {
          console.log('🔔 Leads WhatsApp atualizados');
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
        .eq('completion_percentage', 0) // Apenas leads que vieram do WhatsApp (não preencheram quiz)
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
      console.error('Erro ao carregar leads do WhatsApp:', error);
      toast.error('Erro ao carregar leads do WhatsApp');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter leads by search
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone?.includes(searchQuery) ||
      lead.location?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
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
      <div className="p-4 border-b border-border bg-gradient-to-r from-green-500/10 to-transparent flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <MessageCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            <h2 className="text-lg font-bold text-foreground truncate">Leads do WhatsApp</h2>
            <Badge variant="outline" className="flex-shrink-0 border-green-500/30 text-green-600">{leads.length}</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={loadLeads} className="glass flex-shrink-0">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 glass border-border w-full"
          />
        </div>
      </div>

      {/* Lead List */}
      <ScrollArea className="flex-1 overflow-x-hidden">
        <div className="p-4 space-y-3 overflow-x-hidden">
          {filteredLeads.length === 0 ? (
            <div className="text-center py-12">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">Nenhum lead do WhatsApp encontrado</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Leads que iniciaram conversa pelo WhatsApp aparecerão aqui
              </p>
            </div>
          ) : (
            filteredLeads.map(lead => (
              <Card key={lead.id} className="glass p-4 hover:border-green-500/50 transition-all overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  {/* Avatar + Info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                      {lead.name?.[0]?.toUpperCase() || '?'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground truncate text-sm">
                          {lead.name || 'Sem nome'}
                        </h3>
                        <TemperatureBadge temperature={lead.temperature} />
                        <Badge variant="outline" className="text-xs border-green-500/30 text-green-600">
                          WhatsApp
                        </Badge>
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
                      </div>
                    </div>
                  </div>

                  {/* Action */}
                  <Button
                    size="sm"
                    onClick={() => onStartConversation(lead.phone, lead)}
                    className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 w-full sm:w-auto flex-shrink-0"
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
