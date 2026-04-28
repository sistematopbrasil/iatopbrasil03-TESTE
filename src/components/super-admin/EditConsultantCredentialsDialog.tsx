import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, KeyRound } from 'lucide-react';

interface Props {
  consultantId: string | null;
  consultantName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditConsultantCredentialsDialog({ consultantId, consultantName, open, onOpenChange }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      if (!consultantId) throw new Error('Consultor inválido');
      const payload: any = { consultant_id: consultantId };
      if (email.trim()) payload.new_email = email.trim();
      if (password.trim()) payload.new_password = password;
      const { data, error } = await supabase.functions.invoke('update-consultant-credentials', { body: payload });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('Credenciais atualizadas com sucesso!');
      setEmail(''); setPassword('');
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao atualizar credenciais'),
  });

  const canSubmit = (email.trim() !== '' || password.trim() !== '') && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            Alterar credenciais
          </DialogTitle>
          <DialogDescription>
            Atualizar email e/ou senha de <span className="font-semibold text-foreground">{consultantName}</span>. Deixe em branco o que não quiser alterar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Novo email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="novo@email.com"
            />
          </div>
          <div>
            <Label>Nova senha</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
            <p className="text-xs text-muted-foreground mt-1">Anote a nova senha — ela não será exibida novamente.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit}>
            {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
