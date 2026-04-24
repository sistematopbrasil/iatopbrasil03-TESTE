import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getQuizUrl } from '@/lib/consultant-context';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Copy, ExternalLink, UserPlus, Trophy, Power, Trash2, MoreVertical, Loader2, MessageSquare, BarChart3, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { CreateConsultantDialog } from './CreateConsultantDialog';
import { EditConsultantFunnelDialog } from './EditConsultantFunnelDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRankingData, type ConsultantRankingData } from '@/hooks/useRankingData';
import { useFunnel } from '@/contexts/FunnelContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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

export function ConsultantsTable() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [consultantToDelete, setConsultantToDelete] = useState<{ id: string; name: string } | null>(null);
  const [funnelEdit, setFunnelEdit] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();
  
  // Usar hook centralizado para dados de ranking
  const { ranking, isLoading, currentUser } = useRankingData();
  const { activeFunnel } = useFunnel();
  const novosLabel =
    activeFunnel === 'associado' ? 'Novos Assoc.'
    : activeFunnel === 'consultor' ? 'Novos Cons.'
    : 'Novos Cons./Assoc.';

  // Helper: contagem de "novos" segundo o funil ativo
  const getNovosCount = (c: ConsultantRankingData) => {
    if (activeFunnel === 'consultor') return c.novos_consultores_count || 0;
    if (activeFunnel === 'associado') return c.novos_associados_count || 0;
    return (c.novos_consultores_count || 0) + (c.novos_associados_count || 0);
  };

  // Helper: badges compactos de origem (Q/C/W/R)
  const renderSources = (c: ConsultantRankingData) => {
    const s = c.lead_sources || { quiz: 0, capture: 0, whatsapp: 0, recruitment: 0 };
    const items: { key: string; label: string; count: number; cls: string; title: string }[] = [
      { key: 'q', label: 'Q', count: s.quiz, cls: 'bg-primary/15 text-primary', title: 'Quiz' },
      { key: 'c', label: 'C', count: s.capture, cls: 'bg-blue-500/15 text-blue-500', title: 'Captura' },
      { key: 'w', label: 'W', count: s.whatsapp, cls: 'bg-green-500/15 text-green-600', title: 'WhatsApp' },
      { key: 'r', label: 'R', count: s.recruitment, cls: 'bg-purple-500/15 text-purple-500', title: 'Recrutamento' },
    ];
    return (
      <div className="flex items-center justify-center gap-1 flex-wrap">
        {items.map((i) => (
          <span
            key={i.key}
            title={`${i.title}: ${i.count}`}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${i.count > 0 ? i.cls : 'bg-muted text-muted-foreground/50'}`}
          >
            <span>{i.label}</span>
            <span>{i.count}</span>
          </span>
        ))}
      </div>
    );
  };

  // Mutation para ativar/desativar consultor
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ consultantId, isActive }: { consultantId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !isActive })
        .eq('id', consultantId);
      
      if (error) throw error;
      return !isActive;
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['unified-ranking'], refetchType: 'all' });
      toast.success(newStatus ? 'Consultor ativado!' : 'Consultor desativado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar status do consultor');
    },
  });

  // Mutation para ativar/desativar CRM
  const toggleCrmMutation = useMutation({
    mutationFn: async ({ consultantId, crmEnabled }: { consultantId: string; crmEnabled: boolean }) => {
      const updateData: Record<string, any> = { crm_enabled: !crmEnabled };
      if (crmEnabled) {
        updateData.ai_enabled = false;
      }
      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', consultantId);
      if (error) throw error;
      return !crmEnabled;
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['unified-ranking'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['current-user-layout'] });
      toast.success(newStatus ? 'CRM ativado!' : 'CRM e IA desativados!');
    },
    onError: () => {
      toast.error('Erro ao atualizar CRM');
    },
  });

  // Mutation para ativar/desativar Ranking
  const toggleRankingMutation = useMutation({
    mutationFn: async ({ consultantId, rankingVisible }: { consultantId: string; rankingVisible: boolean }) => {
      const { error } = await supabase
        .from('users')
        .update({ ranking_visible: !rankingVisible } as any)
        .eq('id', consultantId);
      if (error) throw error;
      return !rankingVisible;
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['unified-ranking'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['current-user-layout'] });
      toast.success(newStatus ? 'Ranking ativado!' : 'Ranking desativado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar ranking');
    },
  });


  const deleteMutation = useMutation({
    mutationFn: async (consultantId: string) => {
      const { data, error } = await supabase.functions.invoke('delete-consultant', {
        body: { consultant_id: consultantId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao excluir consultor');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unified-ranking'] });
      toast.success('Consultor excluído com sucesso!');
      setConsultantToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao excluir consultor');
    },
  });

  const copyQuizLink = (slug: string) => {
    const link = getQuizUrl(slug);
    navigator.clipboard.writeText(link);
    toast.success('Link do quiz copiado!');
  };

  const openQuizLink = (slug: string) => {
    window.open(getQuizUrl(slug), '_blank');
  };

  // Só mostrar loading se não temos dados
  if (isLoading && (!ranking || ranking.length === 0)) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-muted-foreground">Carregando consultores...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4">
          <CardTitle className="text-base sm:text-lg">
            👥 Todos os Consultores ({ranking?.length || 0})
          </CardTitle>
          <Button onClick={() => setIsCreateOpen(true)} size="sm" className="w-full sm:w-auto">
            <UserPlus className="w-4 h-4 mr-2" />
            Novo Consultor
          </Button>
        </CardHeader>

        <CardContent className="p-0 overflow-x-hidden">
          {/* Mobile: Card-based layout */}
          <div className="block md:hidden space-y-3 p-4">
            {ranking?.map((consultant) => (
              <div 
                key={consultant.consultant_id} 
                className="bg-muted/30 rounded-lg p-3 space-y-2"
              >
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {consultant.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {consultant.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-bold text-foreground">
                      {consultant.total_points}
                    </span>
                  </div>
                </div>
                
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Leads</p>
                    <p className="text-sm font-semibold">{consultant.total_leads}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{novosLabel}</p>
                    <p className="text-sm font-semibold text-green-600">{getNovosCount(consultant)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Quentes</p>
                    <p className="text-sm font-semibold text-orange-500">{consultant.hot_leads}</p>
                  </div>
                </div>

                {/* Origens dos leads (mobile) */}
                <div className="pt-1">
                  <p className="text-[10px] text-muted-foreground mb-1 text-center uppercase tracking-wide">Origens</p>
                  {renderSources(consultant)}
                </div>

                {/* Funis row (mobile) */}
                <button
                  type="button"
                  onClick={() => setFunnelEdit({ id: consultant.consultant_id, name: consultant.full_name })}
                  className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md border border-border/60 bg-background hover:bg-muted/50 transition-colors"
                >
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                    Funis
                  </span>
                  <span className="flex items-center gap-1">
                    {(['consultor','associado'] as const).map((f) => {
                      const allowed = (consultant.allowed_funnels ?? ['consultor']).includes(f);
                      const isDefault = consultant.default_funnel === f;
                      return (
                        <span
                          key={f}
                          className={
                            'inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ' +
                            (allowed
                              ? isDefault
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-primary/15 text-primary'
                              : 'bg-muted text-muted-foreground/40 line-through')
                          }
                          title={`${f === 'consultor' ? 'Consultor' : 'Associado'}${isDefault ? ' (padrão)' : ''}`}
                        >
                          {f === 'consultor' ? 'C' : 'A'}
                        </span>
                      );
                    })}
                  </span>
                </button>

                {/* CRM toggle */}
                <div className="flex items-center justify-between pt-1 border-t border-border/50">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">CRM</span>
                      <Switch
                        checked={consultant.crm_enabled}
                        onCheckedChange={() => toggleCrmMutation.mutate({ consultantId: consultant.consultant_id, crmEnabled: consultant.crm_enabled })}
                        className="scale-75"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Ranking</span>
                      <Switch
                        checked={consultant.ranking_visible}
                        onCheckedChange={() => toggleRankingMutation.mutate({ consultantId: consultant.consultant_id, rankingVisible: consultant.ranking_visible })}
                        className="scale-75"
                      />
                    </div>
                  </div>
                </div>

                {/* Actions row */}
                <div className="flex items-center justify-between pt-1 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    {consultant.is_active ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600">
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600">
                        Inativo
                      </span>
                    )}
                    {consultant.quiz_slug && (
                      <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded truncate max-w-[100px]">
                        /{consultant.quiz_slug}
                      </code>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <MoreVertical className="w-3.5 h-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {consultant.quiz_slug && (
                        <>
                          <DropdownMenuItem onClick={() => copyQuizLink(consultant.quiz_slug!)}>
                            <Copy className="w-4 h-4 mr-2" />
                            Copiar link
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openQuizLink(consultant.quiz_slug!)}>
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Abrir quiz
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem
                        onClick={() => toggleActiveMutation.mutate({ 
                          consultantId: consultant.consultant_id, 
                          isActive: consultant.is_active 
                        })}
                      >
                        <Power className="w-4 h-4 mr-2" />
                        {consultant.is_active ? 'Desativar' : 'Ativar'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setFunnelEdit({
                          id: consultant.consultant_id,
                          name: consultant.full_name,
                        })}
                      >
                        <Layers className="w-4 h-4 mr-2" />
                        Editar funis de acesso
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setConsultantToDelete({ 
                          id: consultant.consultant_id, 
                          name: consultant.full_name 
                        })}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: Table layout */}
          <div className="hidden md:block overflow-x-auto min-w-0">
            <table className="w-full">
              <thead className="bg-muted/50 border-y border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Consultor
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                    Pontuação
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                    Leads
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                    {novosLabel}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                    Origens
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                    Quentes 🔥
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Quiz Slug
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                    Funis
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                    CRM
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                    Ranking
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ranking?.map((consultant) => (
                  <tr key={consultant.consultant_id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {consultant.full_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {consultant.email}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Trophy className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-bold text-foreground">
                          {consultant.total_points}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-semibold text-foreground">
                        {consultant.total_leads}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-semibold text-green-600">
                        {getNovosCount(consultant)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {renderSources(consultant)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-semibold text-orange-500">
                        {consultant.hot_leads}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {consultant.quiz_slug ? (
                        <code className="text-xs bg-muted px-2 py-1 rounded text-foreground">
                          /quiz/{consultant.quiz_slug}
                        </code>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => setFunnelEdit({ id: consultant.consultant_id, name: consultant.full_name })}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted/60 transition-colors"
                        title="Editar funis de acesso"
                      >
                        {(['consultor','associado'] as const).map((f) => {
                          const allowed = (consultant.allowed_funnels ?? ['consultor']).includes(f);
                          const isDefault = consultant.default_funnel === f;
                          return (
                            <span
                              key={f}
                              className={
                                'inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-bold ' +
                                (allowed
                                  ? isDefault
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-primary/15 text-primary'
                                  : 'bg-muted text-muted-foreground/40 line-through')
                              }
                              title={`${f === 'consultor' ? 'Consultor' : 'Associado'}${isDefault ? ' (padrão)' : ''}${!allowed ? ' — sem acesso' : ''}`}
                            >
                              {f === 'consultor' ? 'C' : 'A'}
                            </span>
                          );
                        })}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Switch
                        checked={consultant.crm_enabled}
                        onCheckedChange={() => toggleCrmMutation.mutate({ consultantId: consultant.consultant_id, crmEnabled: consultant.crm_enabled })}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Switch
                        checked={consultant.ranking_visible}
                        onCheckedChange={() => toggleRankingMutation.mutate({ consultantId: consultant.consultant_id, rankingVisible: consultant.ranking_visible })}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {consultant.is_active ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-600">
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-600">
                          Inativo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {consultant.quiz_slug && (
                            <>
                              <DropdownMenuItem onClick={() => copyQuizLink(consultant.quiz_slug!)}>
                                <Copy className="w-4 h-4 mr-2" />
                                Copiar link
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openQuizLink(consultant.quiz_slug!)}>
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Abrir quiz
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem
                            onClick={() => toggleActiveMutation.mutate({ 
                              consultantId: consultant.consultant_id, 
                              isActive: consultant.is_active 
                            })}
                          >
                            <Power className="w-4 h-4 mr-2" />
                            {consultant.is_active ? 'Desativar' : 'Ativar'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setFunnelEdit({
                              id: consultant.consultant_id,
                              name: consultant.full_name,
                            })}
                          >
                            <Layers className="w-4 h-4 mr-2" />
                            Editar funis de acesso
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setConsultantToDelete({ 
                              id: consultant.consultant_id, 
                              name: consultant.full_name 
                            })}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {ranking?.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhum consultor encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateConsultantDialog 
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />

      {funnelEdit && (
        <EditConsultantFunnelDialog
          open={!!funnelEdit}
          onOpenChange={(o) => !o && setFunnelEdit(null)}
          consultantId={funnelEdit.id}
          consultantName={funnelEdit.name}
        />
      )}

      <AlertDialog open={!!consultantToDelete} onOpenChange={() => setConsultantToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Consultor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o consultor <strong>{consultantToDelete?.name}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => consultantToDelete && deleteMutation.mutate(consultantToDelete.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
