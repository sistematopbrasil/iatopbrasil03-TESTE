import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, Loader2, Users, MessageSquare } from 'lucide-react';
import { TemperatureBadge } from '@/components/ui/temperature-badge';

interface InviteLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  existingAttendeeIds: string[];
}

export function InviteLeadsDialog({
  open,
  onOpenChange,
  eventId,
  existingAttendeeIds,
}: InviteLeadsDialogProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [sendWhatsApp, setSendWhatsApp] = useState(false);

  // Buscar leads disponíveis
  const { data: leads, isLoading } = useQuery({
    queryKey: ['leads-for-invite', searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('quiz_submissions_new')
        .select('id, name, phone, temperature, lead_score, created_at')
        .eq('completion_percentage', 100)
        .order('created_at', { ascending: false })
        .limit(50);

      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Filtrar leads já convidados
      return data?.filter(lead => !existingAttendeeIds.includes(lead.id)) || [];
    },
    enabled: open,
  });

  // Buscar dados do evento para WhatsApp
  const { data: eventData } = useQuery({
    queryKey: ['event-for-invite', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('name, event_date, location')
        .eq('id', eventId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && sendWhatsApp,
  });

  // Mutation para convidar leads
  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (selectedLeads.length === 0) {
        throw new Error('Selecione pelo menos um lead');
      }

      // Inserir participantes
      const attendees = selectedLeads.map(leadId => ({
        event_id: eventId,
        submission_id: leadId,
        status: 'convidado' as const,
      }));

      const { error } = await supabase
        .from('event_attendees')
        .insert(attendees);

      if (error) throw error;

      // Se marcou para enviar WhatsApp, buscar instância e enviar
      if (sendWhatsApp && eventData) {
        const { data: instance } = await supabase
          .from('whatsapp_instances')
          .select('id, status')
          .eq('status', 'connected')
          .single();

        if (instance) {
          // Buscar dados dos leads selecionados
          const { data: leadsToMessage } = await supabase
            .from('quiz_submissions_new')
            .select('name, phone')
            .in('id', selectedLeads);

          // Enviar mensagens via edge function
          for (const lead of leadsToMessage || []) {
            if (!lead.phone) continue;

            const eventDate = new Date(eventData.event_date);
            const dateStr = eventDate.toLocaleDateString('pt-BR');
            const timeStr = eventDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            
            const message = `Olá ${lead.name || 'tudo bem'}! 👋\n\nVocê está convidado(a) para o evento *${eventData.name}*!\n\n📅 Data: ${dateStr}\n⏰ Horário: ${timeStr}${eventData.location ? `\n📍 Local: ${eventData.location}` : ''}\n\nConfirme sua presença respondendo esta mensagem!\n\nAguardamos você! 🎉`;

            try {
              await supabase.functions.invoke('crm-send-message', {
                body: {
                  phone: lead.phone.replace(/\D/g, ''),
                  message,
                  instanceId: instance.id,
                },
              });
            } catch (err) {
              console.error('Erro ao enviar WhatsApp para', lead.phone, err);
            }
          }
        }
      }

      return selectedLeads.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event-details'] });
      toast.success(`${count} lead(s) convidado(s) com sucesso!${sendWhatsApp ? ' Convites enviados via WhatsApp.' : ''}`);
      setSelectedLeads([]);
      setSendWhatsApp(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao convidar leads');
    },
  });

  const toggleLead = (leadId: string) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const toggleAll = () => {
    if (selectedLeads.length === leads?.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(leads?.map(l => l.id) || []);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Convidar Leads para o Evento
          </DialogTitle>
        </DialogHeader>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Lista de Leads */}
        <ScrollArea className="flex-1 min-h-[200px] max-h-[300px] border rounded-lg">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : leads?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>{searchQuery ? 'Nenhum lead encontrado' : 'Todos os leads já foram convidados'}</p>
            </div>
          ) : (
            <div className="divide-y">
              {/* Header com selecionar todos */}
              <div className="p-3 bg-muted/50 sticky top-0">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedLeads.length === leads?.length && leads?.length > 0}
                    onCheckedChange={toggleAll}
                  />
                  <span className="text-sm font-medium">
                    Selecionar todos ({leads?.length})
                  </span>
                </label>
              </div>

              {leads?.map((lead) => (
                <label
                  key={lead.id}
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedLeads.includes(lead.id)}
                    onCheckedChange={() => toggleLead(lead.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {lead.name || 'Sem nome'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {lead.phone || 'Sem telefone'}
                    </p>
                  </div>
                  {lead.temperature && (
                    <TemperatureBadge
                      temperature={lead.temperature as 'hot' | 'warm' | 'cold'}
                      size="sm"
                      showLabel={false}
                    />
                  )}
                </label>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Opção WhatsApp */}
        <label className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg cursor-pointer">
          <Checkbox
            checked={sendWhatsApp}
            onCheckedChange={(checked) => setSendWhatsApp(checked === true)}
          />
          <MessageSquare className="w-4 h-4 text-green-600" />
          <div className="flex-1">
            <p className="text-sm font-medium">Enviar convite via WhatsApp</p>
            <p className="text-xs text-muted-foreground">
              Uma mensagem será enviada para cada lead selecionado
            </p>
          </div>
        </label>

        {/* Ações */}
        <div className="flex items-center justify-between pt-2">
          <Badge variant="outline">
            {selectedLeads.length} selecionado(s)
          </Badge>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => inviteMutation.mutate()}
              disabled={selectedLeads.length === 0 || inviteMutation.isPending}
            >
              {inviteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Convidando...
                </>
              ) : (
                `Convidar ${selectedLeads.length > 0 ? `(${selectedLeads.length})` : ''}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
