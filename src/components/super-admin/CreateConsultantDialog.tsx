import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentConsultant } from '@/lib/consultant-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { z } from 'zod';
import { UserPlus, Layers } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FUNNEL_LABELS, FUNNEL_VALUES, FunnelType } from '@/lib/funnel-types';

const consultantSchema = z.object({
  full_name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').max(100),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  role: z.enum(['admin', 'consultor']),
});

interface CreateConsultantDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateConsultantDialog({ open: controlledOpen, onOpenChange: controlledOnOpenChange }: CreateConsultantDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const onOpenChange = isControlled ? controlledOnOpenChange! : setInternalOpen;

  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'consultor' as 'admin' | 'consultor',
  });
  const [allowedFunnels, setAllowedFunnels] = useState<FunnelType[]>(['consultor']);
  const [defaultFunnel, setDefaultFunnel] = useState<FunnelType>('consultor');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentConsultant,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Validate
      const result = consultantSchema.safeParse(data);
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

      if (!currentUser) throw new Error('Not authenticated');

      // Call edge function to create consultant
      const { data: responseData, error } = await supabase.functions.invoke('create-consultant', {
        body: {
          email: data.email,
          password: data.password,
          full_name: data.full_name,
          organization_id: currentUser.organization_id,
          role: data.role,
          allowed_funnels: allowedFunnels,
          default_funnel: defaultFunnel,
        },
      });

      if (error) throw new Error(error.message);
      if (responseData?.error) throw new Error(responseData.error);

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-consultants'] });
      queryClient.invalidateQueries({ queryKey: ['all-consultants-management'] });
      queryClient.invalidateQueries({ queryKey: ['unified-ranking'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['super-admin-metrics'], refetchType: 'all' });
      toast.success('Consultor criado com sucesso!', {
        description: 'As credenciais foram definidas conforme informado no formulário.',
      });
      onOpenChange(false);
      setFormData({ full_name: '', email: '', password: '', role: 'consultor' });
      setErrors({});
    },
    onError: (error: Error) => {
      if (error.message !== 'Validation failed') {
        toast.error('Erro ao criar consultor: ' + error.message);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button>
            <UserPlus className="w-4 h-4 mr-2" />
            Novo Consultor
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>Novo Consultor</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4 overflow-y-auto flex-1 min-h-0">
          <div>
            <Label htmlFor="full_name">Nome Completo *</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="Ex: João da Silva"
            />
            {errors.full_name && (
              <p className="text-sm text-destructive mt-1">{errors.full_name}</p>
            )}
          </div>

          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="consultor@exemplo.com"
            />
            {errors.email && (
              <p className="text-sm text-destructive mt-1">{errors.email}</p>
            )}
          </div>

          <div>
            <Label htmlFor="password">Senha *</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Mínimo 8 caracteres"
            />
            {errors.password && (
              <p className="text-sm text-destructive mt-1">{errors.password}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Anote a senha! Ela será necessária para o primeiro login.
            </p>
          </div>

          <div>
            <Label htmlFor="role">Tipo de Acesso</Label>
            <Select
              value={formData.role}
              onValueChange={(value: 'admin' | 'consultor') =>
                setFormData({ ...formData, role: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consultor">Consultor</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Consultores veem apenas seus próprios leads. Administradores têm acesso expandido.
            </p>
          </div>

          <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/30">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Acesso a Funis
            </Label>
            <div className="space-y-2">
              {FUNNEL_VALUES.map((funnel) => {
                const checked = allowedFunnels.includes(funnel);
                const isOnlyOne = checked && allowedFunnels.length === 1;
                return (
                  <div key={funnel} className="flex items-center gap-2">
                    <Checkbox
                      id={`cf-${funnel}`}
                      checked={checked}
                      disabled={isOnlyOne}
                      onCheckedChange={(v) => {
                        setAllowedFunnels((prev) => {
                          const next = v
                            ? Array.from(new Set([...prev, funnel]))
                            : prev.filter((f) => f !== funnel);
                          if (next.length === 0) return prev;
                          if (!next.includes(defaultFunnel)) setDefaultFunnel(next[0]);
                          return next;
                        });
                      }}
                    />
                    <Label htmlFor={`cf-${funnel}`} className="text-sm font-normal cursor-pointer">
                      Funil de {FUNNEL_LABELS[funnel]}
                    </Label>
                  </div>
                );
              })}
            </div>

            {allowedFunnels.length > 1 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="text-xs font-semibold text-muted-foreground">Funil padrão (entrada)</Label>
                <RadioGroup value={defaultFunnel} onValueChange={(v) => setDefaultFunnel(v as FunnelType)}>
                  {allowedFunnels.map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <RadioGroupItem value={f} id={`cd-${f}`} />
                      <Label htmlFor={`cd-${f}`} className="text-sm font-normal cursor-pointer">
                        {FUNNEL_LABELS[f]}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}
          </div>

          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm text-muted-foreground">
              💡 O slug do quiz será gerado automaticamente a partir do nome.
              Exemplo: "João da Silva" → <code className="bg-muted px-1">/quiz/joao-da-silva</code>
            </p>
          </div>

        </form>

        <div className="flex gap-2 px-6 py-4 border-t border-border bg-background shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            className="flex-1"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Criando...' : 'Criar Consultor'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
