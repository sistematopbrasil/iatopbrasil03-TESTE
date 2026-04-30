import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentConsultant } from '@/lib/consultant-context';
import { parseInstagramUsername } from '@/lib/instagram-utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Instagram, Loader2 } from 'lucide-react';

interface Props {
  consultantId: string | null;
  consultantName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddInstagramToConsultantDialog({ consultantId, consultantName, open, onOpenChange }: Props) {
  const [username, setUsername] = useState('');
  const qc = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentConsultant,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!consultantId || !currentUser) throw new Error('Sessão inválida');
      const clean = parseInstagramUsername(username);
      if (!clean) throw new Error('Informe um username válido');

      const { data: existing } = await supabase
        .from('insta_profiles')
        .select('id')
        .eq('organization_id', currentUser.organization_id)
        .eq('username', clean)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('insta_profiles')
          .update({ consultant_id: consultantId })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('insta_profiles').insert({
          organization_id: currentUser.organization_id,
          consultant_id: consultantId,
          username: clean,
          profile_url: `https://instagram.com/${clean}`,
        });
        if (error) throw error;
      }

      // Best-effort: dispara fetch inicial (não bloqueia)
      supabase.functions.invoke('insta-fetch-profile', { body: { username: clean } }).catch(() => {});
    },
    onSuccess: () => {
      toast.success('Instagram vinculado!');
      qc.invalidateQueries({ queryKey: ['insta-profiles'] });
      setUsername('');
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao vincular Instagram'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Instagram className="w-5 h-5 text-primary" />
            Vincular Instagram
          </DialogTitle>
          <DialogDescription>
            Adicionar um perfil ao acompanhamento de <strong>{consultantName}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Username (@)</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ex: joaodasilva"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              O perfil ficará no painel Super Admin e visível só para este consultor.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => addMutation.mutate()} disabled={!username.trim() || addMutation.isPending}>
              {addMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Vincular
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
