import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { z } from 'zod';

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const eventSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  description: z.string().trim().max(500, 'Descrição muito longa').optional(),
  event_date: z.string().min(1, 'Data é obrigatória'),
  event_time: z.string().min(1, 'Horário é obrigatório'),
  location: z.string().trim().max(200, 'Local muito longo').optional(),
  max_attendees: z.string().optional(),
});

export function CreateEventDialog({ open, onOpenChange }: CreateEventDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    event_date: '',
    event_time: '',
    location: '',
    max_attendees: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createEventMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Validate
      const result = eventSchema.safeParse(data);
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
        throw new Error('Validation failed');
      }

      // Get user's organization and consultant ID
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { data: userData } = await supabase
        .from('users')
        .select('id, organization_id')
        .eq('auth_user_id', user.user.id)
        .single();

      if (!userData) throw new Error('User not found');

      const eventDateTime = `${data.event_date}T${data.event_time}:00`;

      console.log('🔵 Criando evento:', {
        organization_id: userData.organization_id,
        consultant_id: userData.id,
        name: data.name.trim(),
        event_date: eventDateTime,
      });

      const { error } = await supabase.from('events').insert({
        organization_id: userData.organization_id,
        consultant_id: userData.id,
        name: data.name.trim(),
        description: data.description.trim() || null,
        event_date: eventDateTime,
        location: data.location.trim() || null,
        max_attendees: data.max_attendees ? parseInt(data.max_attendees) : null,
        status: 'planejado',
      });

      if (error) {
        console.error('❌ Erro ao criar evento:', error);
        throw error;
      }

      console.log('✅ Evento criado com sucesso!');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Evento criado com sucesso!');
      onOpenChange(false);
      setFormData({
        name: '',
        description: '',
        event_date: '',
        event_time: '',
        location: '',
        max_attendees: '',
      });
      setErrors({});
    },
    onError: (error) => {
      if (error.message !== 'Validation failed') {
        toast.error('Erro ao criar evento');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    createEventMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Novo Evento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome do Evento *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Treinamento de Novos Consultores"
              maxLength={100}
            />
            {errors.name && <p className="text-sm text-destructive mt-1">{errors.name}</p>}
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descreva o evento..."
              rows={3}
              maxLength={500}
            />
            {errors.description && <p className="text-sm text-destructive mt-1">{errors.description}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="event_date">Data *</Label>
              <Input
                id="event_date"
                type="date"
                value={formData.event_date}
                onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
              />
              {errors.event_date && <p className="text-sm text-destructive mt-1">{errors.event_date}</p>}
            </div>

            <div>
              <Label htmlFor="event_time">Horário *</Label>
              <Input
                id="event_time"
                type="time"
                value={formData.event_time}
                onChange={(e) => setFormData({ ...formData, event_time: e.target.value })}
              />
              {errors.event_time && <p className="text-sm text-destructive mt-1">{errors.event_time}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="location">Local</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Ex: Escritório Central - Sala 3"
              maxLength={200}
            />
          </div>

          <div>
            <Label htmlFor="max_attendees">Máximo de Participantes</Label>
            <Input
              id="max_attendees"
              type="number"
              min="1"
              value={formData.max_attendees}
              onChange={(e) => setFormData({ ...formData, max_attendees: e.target.value })}
              placeholder="Deixe em branco para ilimitado"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={createEventMutation.isPending}>
              {createEventMutation.isPending ? 'Criando...' : 'Criar Evento'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
