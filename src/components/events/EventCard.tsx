import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, MapPin, Users, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Database } from '@/integrations/supabase/types';

type EventStatus = Database['public']['Enums']['event_status'];
type AttendeeStatus = Database['public']['Enums']['attendee_status'];

interface EventAttendee {
  id: string;
  status: AttendeeStatus;
}

interface Event {
  id: string;
  name: string;
  description: string | null;
  event_date: string;
  location: string | null;
  max_attendees: number | null;
  status: EventStatus;
  event_attendees?: EventAttendee[];
}

interface EventCardProps {
  event: Event;
  onViewDetails?: (eventId: string) => void;
}

const statusConfig: Record<EventStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  planejado: { label: 'Planejado', variant: 'secondary' },
  confirmado: { label: 'Confirmado', variant: 'default' },
  realizado: { label: 'Realizado', variant: 'outline' },
  cancelado: { label: 'Cancelado', variant: 'destructive' },
};

export function EventCard({ event, onViewDetails }: EventCardProps) {
  const confirmedCount = event.event_attendees?.filter(
    (a) => a.status === 'confirmado'
  ).length || 0;

  const presentCount = event.event_attendees?.filter(
    (a) => a.status === 'presente'
  ).length || 0;

  const totalInvited = event.event_attendees?.length || 0;

  const isPast = new Date(event.event_date) < new Date();
  const statusInfo = statusConfig[event.status];

  return (
    <div className="bg-card rounded-lg border border-border p-6 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-lg font-semibold text-foreground line-clamp-1">
            {event.name}
          </h3>
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
        </div>
        {event.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {event.description}
          </p>
        )}
      </div>

      {/* Info */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4 flex-shrink-0" />
          <span>
            {format(new Date(event.event_date), "dd 'de' MMMM 'de' yyyy", {
              locale: ptBR,
            })}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4 flex-shrink-0" />
          <span>{format(new Date(event.event_date), 'HH:mm', { locale: ptBR })}</span>
        </div>

        {event.location && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4 flex-shrink-0" />
          <span>
            {isPast || event.status === 'realizado'
              ? `${presentCount} compareceram de ${totalInvited} convidados`
              : `${confirmedCount} confirmados de ${totalInvited} convidados`}
            {event.max_attendees && ` (máx: ${event.max_attendees})`}
          </span>
        </div>
      </div>

      {/* Actions */}
      {onViewDetails && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => onViewDetails(event.id)}
        >
          Ver Detalhes
        </Button>
      )}
    </div>
  );
}
