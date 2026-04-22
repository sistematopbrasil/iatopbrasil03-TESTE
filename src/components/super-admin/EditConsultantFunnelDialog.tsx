import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { FUNNEL_LABELS, FUNNEL_VALUES, FunnelType } from '@/lib/funnel-types';

interface EditConsultantFunnelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultantId: string;
  consultantName: string;
}

export function EditConsultantFunnelDialog({
  open,
  onOpenChange,
  consultantId,
  consultantName,
}: EditConsultantFunnelDialogProps) {
  const queryClient = useQueryClient();
  const [allowed, setAllowed] = useState<FunnelType[]>(['consultor']);
  const [defaultFunnel, setDefaultFunnel] = useState<FunnelType>('consultor');
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [confirmImpact, setConfirmImpact] = useState<{
    impact: Record<string, { leads: number; conversations: number }>;
    removed: string[];
  } | null>(null);

  // Carregar config atual ao abrir
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      setLoadingInitial(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('allowed_funnels, default_funnel')
          .eq('id', consultantId)
          .single();
        if (error) throw error;
        if (!mounted || !data) return;
        const a = ((data as any).allowed_funnels as FunnelType[] | null) || ['consultor'];
        const d = ((data as any).default_funnel as FunnelType | null) || 'consultor';
        setAllowed(a.length > 0 ? a : ['consultor']);
        setDefaultFunnel(a.includes(d) ? d : a[0] || 'consultor');
      } catch (e: any) {
        console.error(e);
        toast.error('Erro ao carregar acesso atual');
      } finally {
        if (mounted) setLoadingInitial(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [open, consultantId]);

  const toggleFunnel = (funnel: FunnelType, checked: boolean) => {
    setAllowed((prev) => {
      const next = checked ? Array.from(new Set([...prev, funnel])) : prev.filter((f) => f !== funnel);
      // Garantir pelo menos 1
      if (next.length === 0) return prev;
      // Se o default sair, ajustar
      if (!next.includes(defaultFunnel)) {
        setDefaultFunnel(next[0]);
      }
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('update-consultant-funnel-access', {
        body: {
          user_id: consultantId,
          allowed_funnels: allowed,
          default_funnel: defaultFunnel,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['unified-ranking'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['all-consultants'] });
      queryClient.invalidateQueries({ queryKey: ['all-consultants-management'] });
      toast.success('Acesso atualizado!');
      onOpenChange(false);
      setConfirmImpact(null);
    },
    onError: (err: Error) => {
      toast.error('Erro ao salvar: ' + err.message);
    },
  });

  // Antes de salvar, calcula impacto se há remoção
  const handleAttemptSave = async () => {
    try {
      const { data: current } = await supabase
        .from('users')
        .select('allowed_funnels')
        .eq('id', consultantId)
        .single();
      const currentAllowed = ((current as any)?.allowed_funnels as FunnelType[] | null) || ['consultor'];
      const removed = currentAllowed.filter((f) => !allowed.includes(f));

      if (removed.length === 0) {
        // Sem remoção, salva direto
        saveMutation.mutate();
        return;
      }

      // Calcular impacto antes de salvar — chamada "dry-run" lendo direto
      const impact: Record<string, { leads: number; conversations: number }> = {};
      for (const funnel of removed) {
        const { count: leadsCount } = await supabase
          .from('quiz_submissions_new')
          .select('id', { count: 'exact', head: true })
          .eq('consultant_id', consultantId)
          .eq('funnel_type', funnel);

        const { data: instances } = await (supabase as any)
          .from('whatsapp_instances')
          .select('id')
          .eq('user_id', consultantId)
          .eq('funnel_type', funnel);

        let convCount = 0;
        if (instances?.length) {
          const { count } = await supabase
            .from('crm_conversations')
            .select('id', { count: 'exact', head: true })
            .in('instance_id', instances.map((i: any) => i.id));
          convCount = count || 0;
        }

        impact[funnel] = { leads: leadsCount || 0, conversations: convCount };
      }

      setConfirmImpact({ impact, removed });
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao calcular impacto');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              Acesso a Funis
            </DialogTitle>
            <DialogDescription>
              Configure quais funis <strong>{consultantName}</strong> pode acessar.
            </DialogDescription>
          </DialogHeader>

          {loadingInitial ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-5 py-2">
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Funis permitidos</Label>
                <div className="space-y-2">
                  {FUNNEL_VALUES.map((funnel) => {
                    const checked = allowed.includes(funnel);
                    const wouldBeOnlyOne = checked && allowed.length === 1;
                    return (
                      <div
                        key={funnel}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30"
                      >
                        <Checkbox
                          id={`allowed-${funnel}`}
                          checked={checked}
                          disabled={wouldBeOnlyOne}
                          onCheckedChange={(v) => toggleFunnel(funnel, !!v)}
                        />
                        <Label
                          htmlFor={`allowed-${funnel}`}
                          className="text-sm font-normal cursor-pointer flex-1"
                        >
                          Funil de {FUNNEL_LABELS[funnel]}
                        </Label>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  É necessário pelo menos 1 funil ativo.
                </p>
              </div>

              {allowed.length > 1 && (
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Funil padrão</Label>
                  <RadioGroup
                    value={defaultFunnel}
                    onValueChange={(v) => setDefaultFunnel(v as FunnelType)}
                  >
                    {allowed.map((funnel) => (
                      <div
                        key={funnel}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40"
                      >
                        <RadioGroupItem value={funnel} id={`default-${funnel}`} />
                        <Label
                          htmlFor={`default-${funnel}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {FUNNEL_LABELS[funnel]}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAttemptSave} disabled={saveMutation.isPending || loadingInitial}>
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmImpact}
        onOpenChange={(o) => !o && setConfirmImpact(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar remoção de funil</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2">
                <p>
                  Removendo {confirmImpact?.removed.length === 1 ? 'o funil' : 'os funis'}{' '}
                  <strong>
                    {confirmImpact?.removed
                      .map((f) => FUNNEL_LABELS[f as FunnelType])
                      .join(', ')}
                  </strong>
                  , este consultor perderá visibilidade de:
                </p>
                <ul className="space-y-1 list-disc list-inside text-sm">
                  {confirmImpact &&
                    Object.entries(confirmImpact.impact).map(([funnel, counts]) => (
                      <li key={funnel}>
                        <strong>{FUNNEL_LABELS[funnel as FunnelType]}:</strong>{' '}
                        {counts.leads} lead(s) • {counts.conversations} conversa(s)
                      </li>
                    ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Os dados não serão excluídos. Eles permanecem no sistema mas ficarão invisíveis
                  para este consultor enquanto não tiver acesso ao funil.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmImpact(null);
                saveMutation.mutate();
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
