import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentConsultant, isSuperAdmin } from '@/lib/consultant-context';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, UserPlus, MessageSquare, CheckCircle2, X, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { CardGridSkeleton } from '@/components/ui/page-skeleton';
import { EventCard } from '@/components/events/EventCard';
import { CreateEventDialog } from '@/components/events/CreateEventDialog';
import { InviteLeadsDialog } from '@/components/events/InviteLeadsDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { TemperatureBadge } from '@/components/ui/temperature-badge';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type AttendeeStatus = Database['public']['Enums']['attendee_status'];
type EventStatus = Database['public']['Enums']['event_status'];

const attendeeStatusConfig: Record<AttendeeStatus, { label: string; color: string }> = {
  convidado: { label: 'Convidado', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  confirmado: { label: 'Confirmado', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  presente: { label: 'Presente', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  ausente: { label: 'Ausente', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

const eventStatusConfig: Record<EventStatus, { label: string; color: string }> = {
  planejado: { label: 'Planejado', color: 'bg-yellow-100 text-yellow-700' },
  confirmado: { label: 'Confirmado', color: 'bg-blue-100 text-blue-700' },
  realizado: { label: 'Realizado', color: 'bg-green-100 text-green-700' },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
};

export default function AdminEvents() {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEventId, setInviteEventId] = useState<string | null>(null);

  const { data: currentUser } = useQuery({
    queryKey: ['current-user-events'],
    queryFn: getCurrentConsultant,
  });

  const { data: events, isLoading } = useQuery({
    queryKey: ['events', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];

      let query = supabase
        .from('events')
        .select(`
          *,
          event_attendees (
            id,
            status,
            checked_in_at,
            notes,
            submission_id
          )
        `)
        .order('event_date', { ascending: false });

      if (!isSuperAdmin(currentUser.role)) {
        query = query.eq('consultant_id', currentUser.id);
      } else {
        query = query.eq('organization_id', currentUser.organization_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    enabled: !!currentUser,
  });

  const { data: eventDetails, refetch: refetchDetails } = useQuery({
    queryKey: ['event-details', selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return null;

      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', selectedEventId)
        .single();

      if (eventError) throw eventError;

      const { data: attendees, error: attendeesError } = await supabase
        .from('event_attendees')
        .select(`
          *,
          quiz_submissions_new (
            id,
            name,
            phone,
            temperature,
            lead_score
          )
        `)
        .eq('event_id', selectedEventId);

      if (attendeesError) throw attendeesError;

      return { event, attendees };
    },
    enabled: !!selectedEventId,
  });

  // Mutation para atualizar status do participante
  const updateAttendeeStatusMutation = useMutation({
    mutationFn: async ({ attendeeId, status }: { attendeeId: string; status: AttendeeStatus }) => {
      const updateData: any = { status };
      if (status === 'presente') {
        updateData.checked_in_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('event_attendees')
        .update(updateData)
        .eq('id', attendeeId);

      if (error) throw error;
    },
    onSuccess: () => {
      refetchDetails();
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Status atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });

  // Mutation para atualizar status do evento
  const updateEventStatusMutation = useMutation({
    mutationFn: async ({ eventId, status }: { eventId: string; status: EventStatus }) => {
      const { error } = await supabase
        .from('events')
        .update({ status })
        .eq('id', eventId);

      if (error) throw error;
    },
    onSuccess: () => {
      refetchDetails();
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Evento atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar evento');
    },
  });

  // Mutation para enviar convite via WhatsApp
  const sendWhatsAppInviteMutation = useMutation({
    mutationFn: async ({ attendeeId, phone, name }: { attendeeId: string; phone: string; name: string }) => {
      if (!eventDetails?.event) throw new Error('Evento não encontrado');

      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('id, status')
        .eq('status', 'connected')
        .single();

      if (!instance) throw new Error('WhatsApp não conectado');

      const eventDate = new Date(eventDetails.event.event_date);
      const dateStr = eventDate.toLocaleDateString('pt-BR');
      const timeStr = eventDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      const message = `Olá ${name || 'tudo bem'}! 👋\n\nVocê está convidado(a) para o evento *${eventDetails.event.name}*!\n\n📅 Data: ${dateStr}\n⏰ Horário: ${timeStr}${eventDetails.event.location ? `\n📍 Local: ${eventDetails.event.location}` : ''}\n\nConfirme sua presença respondendo esta mensagem!\n\nAguardamos você! 🎉`;

      await supabase.functions.invoke('crm-send-message', {
        body: {
          phone: phone.replace(/\D/g, ''),
          message,
          instanceId: instance.id,
        },
      });
    },
    onSuccess: () => {
      toast.success('Convite enviado via WhatsApp!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao enviar convite');
    },
  });

  // Mutation para remover participante
  const removeAttendeeMutation = useMutation({
    mutationFn: async (attendeeId: string) => {
      const { error } = await supabase
        .from('event_attendees')
        .delete()
        .eq('id', attendeeId);

      if (error) throw error;
    },
    onSuccess: () => {
      refetchDetails();
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Participante removido!');
    },
    onError: () => {
      toast.error('Erro ao remover participante');
    },
  });

  const handleOpenInviteDialog = (eventId: string) => {
    setInviteEventId(eventId);
    setIsInviteDialogOpen(true);
  };

  const upcomingEvents = events?.filter(e => new Date(e.event_date) >= new Date() && e.status !== 'cancelado') || [];
  const pastEvents = events?.filter(e => new Date(e.event_date) < new Date() || e.status === 'realizado') || [];

  const existingAttendeeIds = eventDetails?.attendees?.map(a => a.submission_id) || [];
  const isPastEvent = eventDetails?.event ? new Date(eventDetails.event.event_date) < new Date() : false;

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Eventos</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie treinamentos e reuniões com novos consultores
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Criar Evento
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Próximos Eventos */}
            {upcomingEvents.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Próximos Eventos ({upcomingEvents.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {upcomingEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onViewDetails={setSelectedEventId}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Eventos Passados */}
            {pastEvents.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  Eventos Passados ({pastEvents.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pastEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onViewDetails={setSelectedEventId}
                    />
                  ))}
                </div>
              </div>
            )}

            {events?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-4">Nenhum evento criado ainda</p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeiro Evento
                </Button>
              </div>
            )}
          </>
        )}

        {/* Dialog de criação */}
        <CreateEventDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
        />

        {/* Dialog de convite */}
        {inviteEventId && (
          <InviteLeadsDialog
            open={isInviteDialogOpen}
            onOpenChange={setIsInviteDialogOpen}
            eventId={inviteEventId}
            existingAttendeeIds={existingAttendeeIds}
          />
        )}

        {/* Dialog de detalhes do evento */}
        <Dialog open={!!selectedEventId} onOpenChange={() => setSelectedEventId(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="text-xl">{eventDetails?.event?.name}</DialogTitle>
                {eventDetails?.event && (
                  <div className="flex items-center gap-2">
                    <Select
                      value={eventDetails.event.status}
                      onValueChange={(value) => 
                        updateEventStatusMutation.mutate({ 
                          eventId: eventDetails.event.id, 
                          status: value as EventStatus 
                        })
                      }
                    >
                      <SelectTrigger className="w-[140px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planejado">Planejado</SelectItem>
                        <SelectItem value="confirmado">Confirmado</SelectItem>
                        <SelectItem value="realizado">Realizado</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </DialogHeader>
            
            {eventDetails && (
              <div className="space-y-6">
                {/* Info do Evento */}
                <div className="space-y-2 text-sm bg-muted/30 p-4 rounded-lg">
                  <p>
                    <strong>📅 Data:</strong>{' '}
                    {format(new Date(eventDetails.event.event_date), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                  {eventDetails.event.location && (
                    <p><strong>📍 Local:</strong> {eventDetails.event.location}</p>
                  )}
                  {eventDetails.event.description && (
                    <p><strong>📝 Descrição:</strong> {eventDetails.event.description}</p>
                  )}
                  {eventDetails.event.max_attendees && (
                    <p><strong>👥 Máximo:</strong> {eventDetails.event.max_attendees} participantes</p>
                  )}
                </div>

                {/* Ações do Evento */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleOpenInviteDialog(eventDetails.event.id)}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Convidar Leads
                  </Button>
                  {isPastEvent && eventDetails.event.status !== 'realizado' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateEventStatusMutation.mutate({ eventId: eventDetails.event.id, status: 'realizado' })}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Marcar como Realizado
                    </Button>
                  )}
                </div>

                {/* Lista de Participantes */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center justify-between">
                    <span>Participantes ({eventDetails.attendees?.length || 0})</span>
                    {eventDetails.attendees && eventDetails.attendees.length > 0 && (
                      <div className="flex gap-2 text-xs">
                        <Badge variant="outline">
                          {eventDetails.attendees.filter((a: any) => a.status === 'confirmado').length} confirmados
                        </Badge>
                        <Badge variant="outline">
                          {eventDetails.attendees.filter((a: any) => a.status === 'presente').length} presentes
                        </Badge>
                      </div>
                    )}
                  </h3>
                  
                  {eventDetails.attendees && eventDetails.attendees.length > 0 ? (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {eventDetails.attendees.map((attendee: any) => (
                        <div
                          key={attendee.id}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-foreground truncate">
                                {attendee.quiz_submissions_new?.name || 'Sem nome'}
                              </p>
                              <p className="text-sm text-muted-foreground truncate">
                                {attendee.quiz_submissions_new?.phone || 'Sem telefone'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {attendee.quiz_submissions_new?.temperature && (
                              <TemperatureBadge
                                temperature={attendee.quiz_submissions_new.temperature}
                                size="sm"
                                showLabel={false}
                              />
                            )}
                            
                            {/* Select de status */}
                            <Select
                              value={attendee.status}
                              onValueChange={(value) => 
                                updateAttendeeStatusMutation.mutate({ 
                                  attendeeId: attendee.id, 
                                  status: value as AttendeeStatus 
                                })
                              }
                            >
                              <SelectTrigger className="w-[120px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="convidado">Convidado</SelectItem>
                                <SelectItem value="confirmado">Confirmado</SelectItem>
                                <SelectItem value="presente">Presente</SelectItem>
                                <SelectItem value="ausente">Ausente</SelectItem>
                              </SelectContent>
                            </Select>

                            {/* Menu de ações */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {attendee.quiz_submissions_new?.phone && (
                                  <DropdownMenuItem
                                    onClick={() => sendWhatsAppInviteMutation.mutate({
                                      attendeeId: attendee.id,
                                      phone: attendee.quiz_submissions_new.phone,
                                      name: attendee.quiz_submissions_new.name || '',
                                    })}
                                    disabled={sendWhatsAppInviteMutation.isPending}
                                  >
                                    <MessageSquare className="w-4 h-4 mr-2 text-green-600" />
                                    Enviar convite WhatsApp
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (confirm('Remover este participante?')) {
                                      removeAttendeeMutation.mutate(attendee.id);
                                    }
                                  }}
                                  className="text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Remover
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground bg-muted/30 rounded-lg">
                      <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm mb-3">Nenhum participante convidado ainda.</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenInviteDialog(eventDetails.event.id)}
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Convidar Leads
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
