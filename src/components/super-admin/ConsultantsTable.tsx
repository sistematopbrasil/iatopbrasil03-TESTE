import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getQuizUrl } from '@/lib/consultant-context';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Copy, ExternalLink, UserPlus, Trophy, Power, Trash2, MoreVertical, Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { CreateConsultantDialog } from './CreateConsultantDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRankingData } from '@/hooks/useRankingData';
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
  
  // Usar hook centralizado para dados de ranking
  const { ranking, isLoading, currentUser } = useRankingData();

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
      queryClient.invalidateQueries({ queryKey: ['unified-ranking'] });
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
      queryClient.invalidateQueries({ queryKey: ['unified-ranking'] });
      queryClient.invalidateQueries({ queryKey: ['current-user-layout'] });
      toast.success(newStatus ? 'CRM ativado!' : 'CRM e IA desativados!');
    },
    onError: () => {
      toast.error('Erro ao atualizar CRM');
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
                    <p className="text-xs text-muted-foreground">Novos Cons.</p>
                    <p className="text-sm font-semibold text-green-600">{consultant.novos_consultores_count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Quentes</p>
                    <p className="text-sm font-semibold text-orange-500">{consultant.hot_leads}</p>
                  </div>
                </div>

                {/* CRM toggle */}
                <div className="flex items-center justify-between pt-1 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">CRM</span>
                    <Switch
                      checked={consultant.crm_enabled}
                      onCheckedChange={() => toggleCrmMutation.mutate({ consultantId: consultant.consultant_id, crmEnabled: consultant.crm_enabled })}
                      className="scale-75"
                    />
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
                    Novos Cons.
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                    Quentes 🔥
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Quiz Slug
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                    CRM
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
                        {consultant.novos_consultores_count}
                      </span>
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
                      <Switch
                        checked={consultant.crm_enabled}
                        onCheckedChange={() => toggleCrmMutation.mutate({ consultantId: consultant.consultant_id, crmEnabled: consultant.crm_enabled })}
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
