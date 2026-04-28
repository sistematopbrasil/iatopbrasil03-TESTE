import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Trophy, RotateCcw, History, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface HistoryRow {
  competition_label: string;
  archived_at: string;
  total_consultants: number;
  total_points: number;
  total_captured: number;
  total_converted: number;
  total_recruited: number;
}

interface DetailRow {
  consultant_id: string;
  full_name: string;
  funnel_type: string;
  total_points: number;
  leads_captured: number;
  leads_contacted: number;
  leads_qualified: number;
  leads_converted: number;
  consultants_recruited: number;
}

const fmt = (n: number) => new Intl.NumberFormat('pt-BR').format(n || 0);
const fmtDate = (iso: string) => new Date(iso).toLocaleString('pt-BR');

export function RankingResetCard() {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [detailLabel, setDetailLabel] = useState<string | null>(null);

  const { data: history = [], isLoading } = useQuery<HistoryRow[]>({
    queryKey: ['ranking-history'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_ranking_history');
      if (error) throw error;
      return (data || []) as HistoryRow[];
    },
  });

  const { data: details = [], isLoading: loadingDetails } = useQuery<DetailRow[]>({
    queryKey: ['ranking-history-details', detailLabel],
    queryFn: async () => {
      if (!detailLabel) return [];
      const { data, error } = await supabase.rpc('get_ranking_history_details', { p_competition_label: detailLabel });
      if (error) throw error;
      return (data || []) as DetailRow[];
    },
    enabled: !!detailLabel,
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('archive_and_reset_ranking', { p_competition_label: label });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data: any) => {
      toast.success(`Ranking resetado! ${fmt(data?.rows_archived || 0)} registros arquivados em "${data?.competition_label}".`);
      setLabel(''); setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ['ranking-history'] });
      qc.invalidateQueries({ queryKey: ['unified-ranking'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['super-admin-metrics'], refetchType: 'all' });
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao resetar ranking'),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Trophy className="w-6 h-6 text-primary" />
          </div>
          <div>
            <CardTitle>Gerenciar Ranking</CardTitle>
            <CardDescription>Arquive a competição atual e recomece com placares zerados</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Reset section */}
        <div className="space-y-3">
          <Label>Nome da nova competição (será usado para arquivar a atual)</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex: Competição Novembro/2025"
          />
          <Button
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
            disabled={!label.trim() || resetMutation.isPending}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Resetar Ranking (arquiva a competição atual)
          </Button>
          <p className="text-xs text-muted-foreground">
            Os placares atuais serão movidos para o histórico com este nome. Os dados continuam acessíveis abaixo.
          </p>
        </div>

        {/* History list */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Competições arquivadas</h3>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando histórico...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma competição arquivada ainda.</p>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.competition_label} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{h.competition_label}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(h.archived_at)} • {fmt(h.total_consultants)} consultores • {fmt(h.total_points)} pontos • {fmt(h.total_captured)} leads
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setDetailLabel(h.competition_label)}>
                    Ver detalhes
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      {/* Confirm dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar reset do ranking</AlertDialogTitle>
            <AlertDialogDescription>
              O ranking atual será arquivado como <strong>"{label}"</strong> e os placares de todos os consultores zerarão. Você poderá consultar o histórico depois. Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>
              {resetMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Details dialog */}
      <Dialog open={!!detailLabel} onOpenChange={(open) => !open && setDetailLabel(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailLabel}</DialogTitle>
            <DialogDescription>Placar arquivado por consultor</DialogDescription>
          </DialogHeader>
          {loadingDetails ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>
          ) : details.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sem dados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-2 pr-2">Consultor</th>
                    <th className="py-2 px-2">Funil</th>
                    <th className="py-2 px-2 text-right">Pontos</th>
                    <th className="py-2 px-2 text-right">Capturados</th>
                    <th className="py-2 px-2 text-right">Convertidos</th>
                    <th className="py-2 pl-2 text-right">Recrutados</th>
                  </tr>
                </thead>
                <tbody>
                  {details.map((d, i) => (
                    <tr key={`${d.consultant_id}-${i}`} className="border-b border-border/50">
                      <td className="py-2 pr-2 font-medium">{d.full_name || '—'}</td>
                      <td className="py-2 px-2 capitalize text-muted-foreground">{d.funnel_type}</td>
                      <td className="py-2 px-2 text-right font-semibold">{fmt(d.total_points)}</td>
                      <td className="py-2 px-2 text-right">{fmt(d.leads_captured)}</td>
                      <td className="py-2 px-2 text-right">{fmt(d.leads_converted)}</td>
                      <td className="py-2 pl-2 text-right">{fmt(d.consultants_recruited)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
