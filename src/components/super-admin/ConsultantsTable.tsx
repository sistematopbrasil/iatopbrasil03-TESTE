import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentConsultant, getQuizUrl } from '@/lib/consultant-context';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink, UserPlus, Trophy, Power, Trash2, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { CreateConsultantDialog } from './CreateConsultantDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { LEAD_TEMPERATURE_POINTS, CONVERSION_BONUS } from '@/lib/ranking-service';
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
  const queryClient = useQueryClient();
  
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentConsultant,
  });

  const { data: consultants, isLoading } = useQuery({
    queryKey: ['all-consultants', currentUser?.organization_id],
    queryFn: async () => {
      if (!currentUser) return [];

      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, quiz_slug, role, is_active, created_at')
        .eq('organization_id', currentUser.organization_id)
        .in('role', ['admin', 'consultor'])
        .order('full_name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentUser,
  });

  // Buscar stages de conversão
  const { data: conversionStageIds } = useQuery({
    queryKey: ['conversion-stages', currentUser?.organization_id],
    queryFn: async () => {
      if (!currentUser) return [];
      const { data } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('organization_id', currentUser.organization_id)
        .or('name.ilike.%convertido%,name.ilike.%consultor%');
      return data?.map(s => s.id) || [];
    },
    enabled: !!currentUser,
  });

  // Buscar métricas de leads por consultor (com contagem por temperatura)
  const { data: consultantMetrics } = useQuery({
    queryKey: ['consultant-metrics-all', currentUser?.organization_id, conversionStageIds],
    queryFn: async () => {
      if (!currentUser) return {};

      const { data, error } = await supabase
        .from('quiz_submissions_new')
        .select('consultant_id, temperature, pipeline_stage_id')
        .eq('organization_id', currentUser.organization_id)
        .eq('completion_percentage', 100);

      if (error) throw error;

      // Agregar métricas por consultant_id
      const metrics: Record<string, { 
        total: number; 
        converted: number; 
        hot: number; 
        warm: number;
        cold: number;
        convertedHot: number;
        convertedWarm: number;
      }> = {};
      
      data?.forEach((lead) => {
        if (lead.consultant_id) {
          if (!metrics[lead.consultant_id]) {
            metrics[lead.consultant_id] = { 
              total: 0, converted: 0, hot: 0, warm: 0, cold: 0,
              convertedHot: 0, convertedWarm: 0 
            };
          }
          metrics[lead.consultant_id].total++;
          
          const isConverted = lead.pipeline_stage_id && conversionStageIds?.includes(lead.pipeline_stage_id);
          if (isConverted) {
            metrics[lead.consultant_id].converted++;
          }
          
          if (lead.temperature === 'hot') {
            metrics[lead.consultant_id].hot++;
            if (isConverted) metrics[lead.consultant_id].convertedHot++;
          } else if (lead.temperature === 'warm') {
            metrics[lead.consultant_id].warm++;
            if (isConverted) metrics[lead.consultant_id].convertedWarm++;
          } else {
            metrics[lead.consultant_id].cold++;
          }
        }
      });
      return metrics;
    },
    enabled: !!currentUser && !!conversionStageIds,
  });

  // Buscar consultants_recruited da tabela ranking_scores
  const { data: recruitedCounts } = useQuery({
    queryKey: ['consultant-recruited-all', currentUser?.organization_id],
    queryFn: async () => {
      if (!currentUser) return {};

      const now = new Date();
      const periodStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const periodEnd = format(endOfMonth(now), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('ranking_scores')
        .select('consultant_id, consultants_recruited')
        .eq('organization_id', currentUser.organization_id)
        .eq('period_start', periodStart)
        .eq('period_end', periodEnd);

      if (error) throw error;

      const counts: Record<string, number> = {};
      data?.forEach((score) => {
        counts[score.consultant_id] = score.consultants_recruited || 0;
      });
      return counts;
    },
    enabled: !!currentUser,
  });

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
      queryClient.invalidateQueries({ queryKey: ['all-consultants'] });
      toast.success(newStatus ? 'Consultor ativado!' : 'Consultor desativado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar status do consultor');
    },
  });

  // Mutation para excluir consultor
  const deleteMutation = useMutation({
    mutationFn: async (consultantId: string) => {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', consultantId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-consultants'] });
      toast.success('Consultor excluído com sucesso!');
      setConsultantToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao excluir consultor');
    },
  });

  // Calcular pontuação total correta
  const calculateScore = (consultantId: string): number => {
    const m = consultantMetrics?.[consultantId] || { 
      hot: 0, warm: 0, cold: 0, convertedHot: 0, convertedWarm: 0 
    };
    const recruited = recruitedCounts?.[consultantId] || 0;
    
    // Pontos base por temperatura
    const basePoints = 
      (m.hot * LEAD_TEMPERATURE_POINTS.hot) +
      (m.warm * LEAD_TEMPERATURE_POINTS.warm) +
      (m.cold * LEAD_TEMPERATURE_POINTS.cold);
    
    // Bônus de conversão
    const conversionBonus = 
      (m.convertedHot * CONVERSION_BONUS) +
      (m.convertedWarm * CONVERSION_BONUS);
    
    // Bônus de recrutamento (100 pts cada)
    const recruitedBonus = recruited * 100;
    
    return basePoints + conversionBonus + recruitedBonus;
  };

  const copyQuizLink = (slug: string) => {
    const link = getQuizUrl(slug);
    navigator.clipboard.writeText(link);
    toast.success('Link do quiz copiado!');
  };

  const openQuizLink = (slug: string) => {
    window.open(getQuizUrl(slug), '_blank');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
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
            👥 Todos os Consultores ({consultants?.length || 0})
          </CardTitle>
          <Button onClick={() => setIsCreateOpen(true)} size="sm" className="w-full sm:w-auto">
            <UserPlus className="w-4 h-4 mr-2" />
            Novo Consultor
          </Button>
        </CardHeader>

        <CardContent className="p-0 overflow-x-hidden">
          {/* Mobile: Card-based layout */}
          <div className="block md:hidden space-y-3 p-4">
            {consultants?.map((consultant) => {
              const metrics = consultantMetrics?.[consultant.id] || { total: 0, converted: 0, hot: 0 };
              const score = calculateScore(consultant.id);
              const conversionRate = metrics.total > 0 
                ? ((metrics.converted / metrics.total) * 100).toFixed(1) 
                : '0.0';

              return (
                <div 
                  key={consultant.id} 
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
                        {score}
                      </span>
                    </div>
                  </div>
                  
                  {/* Stats row */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Leads</p>
                      <p className="text-sm font-semibold">{metrics.total}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Conv.</p>
                      <p className="text-sm font-semibold text-green-600">{metrics.converted}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Taxa</p>
                      <p className="text-sm font-medium">{conversionRate}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Quentes</p>
                      <p className="text-sm font-semibold text-orange-500">{metrics.hot}</p>
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
                            consultantId: consultant.id, 
                            isActive: consultant.is_active 
                          })}
                        >
                          <Power className="w-4 h-4 mr-2" />
                          {consultant.is_active ? 'Desativar' : 'Ativar'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setConsultantToDelete({ 
                            id: consultant.id, 
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
              );
            })}
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
                    Convertidos
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                    Quentes 🔥
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Quiz Slug
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
                {consultants?.map((consultant) => {
                  const metrics = consultantMetrics?.[consultant.id] || { total: 0, converted: 0, hot: 0 };
                  const score = calculateScore(consultant.id);

                  return (
                    <tr key={consultant.id} className="hover:bg-muted/30">
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
                            {score}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-semibold text-foreground">
                          {metrics.total}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-semibold text-green-600">
                          {metrics.converted}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-semibold text-orange-500">
                          {metrics.hot}
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
                        {consultant.is_active ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600">
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600">
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
                                  Copiar link do quiz
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
                                consultantId: consultant.id, 
                                isActive: consultant.is_active 
                              })}
                            >
                              <Power className="w-4 h-4 mr-2" />
                              {consultant.is_active ? 'Desativar' : 'Ativar'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setConsultantToDelete({ 
                                id: consultant.id, 
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
                  );
                })}
              </tbody>
            </table>

            {consultants?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum consultor cadastrado ainda.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <CreateConsultantDialog 
        open={isCreateOpen} 
        onOpenChange={setIsCreateOpen} 
      />

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!consultantToDelete} onOpenChange={() => setConsultantToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir consultor?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o consultor <strong>{consultantToDelete?.name}</strong>?
              Esta ação não pode ser desfeita. Todos os leads associados a este consultor serão mantidos,
              mas não terão mais um consultor responsável.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
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
