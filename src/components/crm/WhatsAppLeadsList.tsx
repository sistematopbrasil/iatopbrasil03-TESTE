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
  RefreshCw,
  UserPlus
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getCurrentConsultant, isSuperAdmin } from '@/lib/consultant-context';

interface WhatsAppLeadsListProps {
  onStartConversation: (phone: string, leadData: any) => void;
}

interface WhatsAppContact {
  id: string;
  phone: string;
  name: string | null;
  lead_id: string | null;
  lead?: any;
  last_message_at: string | null;
  created_at: string;
  has_conversation: boolean;
}

export function WhatsAppLeadsList({ onStartConversation }: WhatsAppLeadsListProps) {
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    loadContacts();

    // Realtime subscription para atualizações automáticas
    const conversationsChannel = supabase
      .channel('whatsapp-contacts-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crm_conversations' },
        () => {
          console.log('🔔 Conversas atualizadas');
          loadContacts();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quiz_submissions_new' },
        () => {
          console.log('🔔 Leads atualizados');
          loadContacts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationsChannel);
    };
  }, []);

  const loadContacts = async () => {
    try {
      setIsLoading(true);

      // Buscar usuário logado
      const user = await getCurrentConsultant();
      if (!user) {
        toast.error('Erro ao identificar usuário');
        setContacts([]);
        return;
      }
      setCurrentUser(user);

      // 1. Buscar conversas do usuário (que teve interação no WhatsApp)
      let conversationsQuery = supabase
        .from('crm_conversations')
        .select('id, contact_phone, contact_name, lead_id, last_message_at, created_at')
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (!isSuperAdmin(user.role)) {
        conversationsQuery = conversationsQuery.eq('user_id', user.id);
      } else {
        conversationsQuery = conversationsQuery.eq('organization_id', user.organization_id);
      }

      const { data: conversations, error: convError } = await conversationsQuery;

      if (convError) throw convError;

      if (!conversations || conversations.length === 0) {
        setContacts([]);
        return;
      }

      // 2. Buscar leads vinculados às conversas
      const leadIds = conversations
        .map(c => c.lead_id)
        .filter((id): id is string => id !== null);

      let leadsMap: Map<string, any> = new Map();
      
      if (leadIds.length > 0) {
        const { data: leads } = await supabase
          .from('quiz_submissions_new')
          .select('*')
          .in('id', leadIds);
        
        if (leads) {
          leads.forEach(lead => {
            leadsMap.set(lead.id, lead);
          });
        }
      }

      // 3. Montar lista de contatos (apenas WhatsApp, excluindo quiz leads)
      const whatsappContacts: WhatsAppContact[] = [];

      for (const conv of conversations) {
        const lead = conv.lead_id ? leadsMap.get(conv.lead_id) : null;
        
        // ✅ Se tem lead e completion_percentage > 0, é lead do quiz - EXCLUIR
        if (lead && lead.completion_percentage > 0) {
          continue;
        }

        // ✅ Incluir: conversa SEM lead ou com lead completion_percentage = 0
        whatsappContacts.push({
          id: conv.id,
          phone: conv.contact_phone,
          name: lead?.name || conv.contact_name,
          lead_id: conv.lead_id,
          lead: lead,
          last_message_at: conv.last_message_at,
          created_at: conv.created_at,
          has_conversation: true,
        });
      }

      setContacts(whatsappContacts);
    } catch (error) {
      console.error('Erro ao carregar contatos do WhatsApp:', error);
      toast.error('Erro ao carregar contatos do WhatsApp');
    } finally {
      setIsLoading(false);
    }
  };

  // Criar lead para conversa sem lead
  const handleCreateLead = async (contact: WhatsAppContact) => {
    if (!currentUser) return;

    try {
      // Buscar primeiro quadro do pipeline
      const { data: stages } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('organization_id', currentUser.organization_id)
        .order('order_index', { ascending: true })
        .limit(1);

      const firstStageId = stages?.[0]?.id || null;

      // Criar lead
      const { data: newLead, error: leadError } = await supabase
        .from('quiz_submissions_new')
        .insert({
          name: contact.name || contact.phone,
          phone: contact.phone,
          organization_id: currentUser.organization_id,
          consultant_id: currentUser.id,
          pipeline_stage_id: firstStageId,
          stage: 'novo',
          temperature: 'warm',
          completion_percentage: 0,
          lead_score: 50,
        })
        .select()
        .single();

      if (leadError) throw leadError;

      // Vincular lead à conversa
      await supabase
        .from('crm_conversations')
        .update({ lead_id: newLead.id })
        .eq('id', contact.id);

      toast.success('Lead criado com sucesso!');
      loadContacts();
    } catch (error) {
      console.error('Erro ao criar lead:', error);
      toast.error('Erro ao criar lead');
    }
  };

  // Filter contacts by search
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = 
      contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone?.includes(searchQuery);

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
            <Badge variant="outline" className="flex-shrink-0 border-green-500/30 text-green-600">{contacts.length}</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={loadContacts} className="glass flex-shrink-0">
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

      {/* Contact List */}
      <ScrollArea className="flex-1 overflow-x-hidden">
        <div className="p-4 space-y-3 overflow-x-hidden">
          {filteredContacts.length === 0 ? (
            <div className="text-center py-12">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">Nenhum contato do WhatsApp encontrado</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Contatos que tiveram interação no WhatsApp (enviou ou recebeu mensagem) aparecerão aqui
              </p>
            </div>
          ) : (
            filteredContacts.map(contact => (
              <Card key={contact.id} className="glass p-4 hover:border-green-500/50 transition-all overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  {/* Avatar + Info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                      {contact.name?.[0]?.toUpperCase() || '?'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-foreground truncate text-sm">
                          {contact.name || 'Sem nome'}
                        </h3>
                        {contact.lead?.temperature && (
                          <TemperatureBadge temperature={contact.lead.temperature} />
                        )}
                        <Badge variant="outline" className="text-xs border-green-500/30 text-green-600">
                          WhatsApp
                        </Badge>
                        {!contact.lead_id && (
                          <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-600">
                            Sem lead
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{contact.phone}</span>
                        </div>
                        {contact.lead?.location && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{contact.lead.location}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 flex-shrink-0" />
                          <span>
                            {contact.last_message_at 
                              ? formatDistanceToNow(new Date(contact.last_message_at), {
                                  addSuffix: true,
                                  locale: ptBR,
                                })
                              : formatDistanceToNow(new Date(contact.created_at), {
                                  addSuffix: true,
                                  locale: ptBR,
                                })
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    {!contact.lead_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCreateLead(contact)}
                        className="border-yellow-500/30 text-yellow-600 hover:bg-yellow-500/10"
                      >
                        <UserPlus className="w-4 h-4 mr-1" />
                        Criar Lead
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => onStartConversation(contact.phone, contact.lead || { name: contact.name })}
                      className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Conversar
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}