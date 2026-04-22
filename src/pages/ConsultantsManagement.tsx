import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentConsultant } from '@/lib/consultant-context';
import { Navigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { CreateConsultantDialog } from '@/components/super-admin/CreateConsultantDialog';
import { EditConsultantFunnelDialog } from '@/components/super-admin/EditConsultantFunnelDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Target, Flame, Loader2, MoreVertical, Copy, ExternalLink, UserX, UserCheck, Trash2, Users, CheckSquare, XSquare, Bot, BotOff, MessageSquare, BarChart3, Layers } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { calculateLeadPoints, NOVOS_CONSULTORES_BONUS } from '@/lib/ranking-service';
import { TableSkeleton } from '@/components/ui/page-skeleton';

export default function ConsultantsManagement() {
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [consultantToDelete, setConsultantToDelete] = useState<{ id: string; name: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [funnelEdit, setFunnelEdit] = useState<{ id: string; name: string } | null>(null);

  const { data: currentUser, isLoading: loadingUser } = useQuery({
    queryKey: ['current-user-consultants'],
    queryFn: getCurrentConsultant,
  });

  // Get Novos Consultores stage ID
  const { data: novosConsultoresStageId } = useQuery({
    queryKey: ['novos-consultores-stage', currentUser?.organization_id],
    queryFn: async () => {
      if (!currentUser?.organization_id) return null;
      const { data } = await supabase.rpc('get_novos_consultores_stage_id', {
        org_id: currentUser.organization_id
      });
      return data;
    },
    enabled: !!currentUser?.organization_id,
  });

  const { data: consultants, isLoading: loadingConsultants } = useQuery({
    queryKey: ['all-consultants-management', novosConsultoresStageId],
    queryFn: async () => {
      if (!currentUser) return [];

      const { data: users } = await supabase
        .from('users')
        .select('*')
        .eq('organization_id', currentUser.organization_id)
        .in('role', ['consultor', 'admin'])
        .order('created_at', { ascending: false });

      // Para cada consultor, buscar métricas
      const consultantsWithMetrics = await Promise.all(
        users?.map(async (user) => {
          const { count: totalLeads } = await supabase
            .from('quiz_submissions_new')
            .select('*', { count: 'exact', head: true })
            .eq('consultant_id', user.id)
            .eq('completion_percentage', 100);

          // Count leads by temperature (excluding those in Novos Consultores)
          let hotLeads = 0, warmLeads = 0, coldLeads = 0, novosConsultores = 0;

          if (novosConsultoresStageId) {
            // Get leads NOT in Novos Consultores for temperature counts
            const { data: tempLeads } = await supabase
              .from('quiz_submissions_new')
              .select('temperature')
              .eq('consultant_id', user.id)
              .eq('completion_percentage', 100)
              .neq('pipeline_stage_id', novosConsultoresStageId);

            hotLeads = tempLeads?.filter(l => l.temperature === 'hot').length || 0;
            warmLeads = tempLeads?.filter(l => l.temperature === 'warm').length || 0;
            coldLeads = tempLeads?.filter(l => l.temperature === 'cold').length || 0;

            // Count leads in Novos Consultores
            const { count } = await supabase
              .from('quiz_submissions_new')
              .select('*', { count: 'exact', head: true })
              .eq('consultant_id', user.id)
              .eq('pipeline_stage_id', novosConsultoresStageId);

            novosConsultores = count || 0;
          } else {
            // If no Novos Consultores stage, just count by temperature
            const { count: hotCount } = await supabase
              .from('quiz_submissions_new')
              .select('*', { count: 'exact', head: true })
              .eq('consultant_id', user.id)
              .eq('temperature', 'hot');

            hotLeads = hotCount || 0;
          }

          // Calculate score: leads by temperature + Novos Consultores bonus
          const leadPoints = calculateLeadPoints(hotLeads, warmLeads, coldLeads);
          const novosPoints = novosConsultores * NOVOS_CONSULTORES_BONUS;
          const totalScore = leadPoints + novosPoints;

          return {
            ...user,
            totalLeads: totalLeads || 0,
            novosConsultores,
            hotLeads,
            totalScore,
          };
        }) || []
      );

      return consultantsWithMetrics;
    },
    enabled: !!currentUser && novosConsultoresStageId !== undefined,
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('users')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ['all-consultants-management'] });
      toast.success(isActive ? 'Consultor ativado' : 'Consultor desativado');
    },
    onError: () => {
      toast.error('Erro ao alterar status do consultor');
    },
  });

  // Toggle AI enabled mutation
  const toggleAIMutation = useMutation({
    mutationFn: async ({ id, aiEnabled }: { id: string; aiEnabled: boolean }) => {
      const { error } = await supabase
        .from('users')
        .update({ ai_enabled: aiEnabled })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { aiEnabled }) => {
      queryClient.invalidateQueries({ queryKey: ['all-consultants-management'] });
      toast.success(aiEnabled ? 'IA ativada para o consultor' : 'IA desativada para o consultor');
    },
    onError: () => {
      toast.error('Erro ao alterar status da IA');
    },
  });

  // Toggle CRM mutation
  const toggleCrmMutation = useMutation({
    mutationFn: async ({ id, crmEnabled }: { id: string; crmEnabled: boolean }) => {
      const updateData: Record<string, any> = { crm_enabled: !crmEnabled };
      if (crmEnabled) {
        updateData.ai_enabled = false;
      }
      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', id);
      if (error) throw error;
      return !crmEnabled;
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['all-consultants-management'] });
      queryClient.invalidateQueries({ queryKey: ['current-user-layout'] });
      toast.success(newStatus ? 'CRM ativado!' : 'CRM e IA desativados!');
    },
    onError: () => {
      toast.error('Erro ao atualizar CRM');
    },
  });

  // Toggle Ranking mutation
  const toggleRankingMutation = useMutation({
    mutationFn: async ({ id, rankingVisible }: { id: string; rankingVisible: boolean }) => {
      const { error } = await supabase
        .from('users')
        .update({ ranking_visible: !rankingVisible } as any)
        .eq('id', id);
      if (error) throw error;
      return !rankingVisible;
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['all-consultants-management'] });
      queryClient.invalidateQueries({ queryKey: ['current-user-layout'] });
      toast.success(newStatus ? 'Ranking ativado!' : 'Ranking desativado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar ranking');
    },
  });

  // Delete single mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('delete-consultant', {
        body: { consultant_id: id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao excluir consultor');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-consultants-management'] });
      queryClient.invalidateQueries({ queryKey: ['unified-ranking'] });
      toast.success('Consultor excluído com sucesso');
      setDeleteDialogOpen(false);
      setConsultantToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao excluir consultor');
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.functions.invoke('delete-consultants-bulk', {
        body: { consultant_ids: ids },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao excluir consultores');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['all-consultants-management'] });
      queryClient.invalidateQueries({ queryKey: ['unified-ranking'] });
      toast.success(data.message);
      setBulkDeleteDialogOpen(false);
      setSelectedIds(new Set());
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao excluir consultores');
    },
  });

  const copyQuizLink = (slug: string) => {
    const url = `${window.location.origin}/quiz/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const openQuizLink = (slug: string) => {
    const url = `${window.location.origin}/quiz/${slug}`;
    window.open(url, '_blank');
  };

  const handleDelete = (consultant: { id: string; full_name: string }) => {
    setConsultantToDelete({ id: consultant.id, name: consultant.full_name });
    setDeleteDialogOpen(true);
  };

  // Filter out current user from selectable consultants
  const selectableConsultants = consultants?.filter(c => c.id !== currentUser?.id) || [];

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === selectableConsultants.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableConsultants.map(c => c.id)));
    }
  };

  const isAllSelected = selectableConsultants.length > 0 && selectedIds.size === selectableConsultants.length;
  const hasSelection = selectedIds.size > 0;

  if (loadingUser) {
    return (
      <AdminLayout>
        <TableSkeleton />
      </AdminLayout>
    );
  }

  // Redirecionar se não for super admin
  if (currentUser && currentUser.role !== 'super_admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6 min-w-0 w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Gestão de Consultores</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie todos os consultores e suas métricas
            </p>
          </div>
          <CreateConsultantDialog />
        </div>

        {/* Bulk Action Bar */}
        {hasSelection && (
           <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-muted/50 border border-border rounded-lg p-3 animate-in fade-in slide-in-from-top-2 overflow-hidden">
            <div className="flex items-center gap-3 min-w-0">
              <CheckSquare className="w-5 h-5 text-primary shrink-0" />
              <span className="font-medium text-sm sm:text-base truncate">
                {selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => setSelectedIds(new Set())}
              >
                <XSquare className="w-4 h-4 mr-1" />
                Limpar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => setBulkDeleteDialogOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Excluir Selecionados</span>
                <span className="sm:hidden">Excluir</span>
              </Button>
            </div>
          </div>
        )}

        {loadingConsultants ? (
          <TableSkeleton />
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Selecionar todos"
                    />
                  </TableHead>
                  <TableHead>Consultor</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead className="hidden md:table-cell">Slug</TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Target className="w-4 h-4" />
                      <span className="hidden sm:inline">Leads</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Users className="w-4 h-4" />
                      <span className="hidden sm:inline">Novos Cons.</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Flame className="w-4 h-4" />
                      <span className="hidden sm:inline">Quentes</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-center hidden md:table-cell">CRM</TableHead>
                  <TableHead className="text-center hidden md:table-cell">Ranking</TableHead>
                  <TableHead className="text-center hidden md:table-cell">Status</TableHead>
                  <TableHead className="text-center hidden md:table-cell">IA</TableHead>
                  <TableHead className="text-center hidden md:table-cell">Funis</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consultants?.map((consultant) => {
                  const isSelf = consultant.id === currentUser?.id;
                  const isSelected = selectedIds.has(consultant.id);
                  
                  return (
                    <TableRow 
                      key={consultant.id}
                      className={isSelected ? 'bg-muted/30' : ''}
                    >
                      <TableCell>
                        {!isSelf && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(consultant.id)}
                            aria-label={`Selecionar ${consultant.full_name}`}
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>
                          <p className="truncate max-w-[120px] sm:max-w-none">
                            {consultant.full_name}
                            {isSelf && (
                              <Badge variant="outline" className="ml-2 text-xs">Você</Badge>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground sm:hidden truncate">
                            {consultant.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden sm:table-cell">
                        {consultant.email}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {consultant.quiz_slug || '-'}
                        </code>
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {consultant.totalLeads}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-purple-600">
                        {consultant.novosConsultores}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-orange-600">
                        {consultant.hotLeads}
                      </TableCell>
                      <TableCell className="text-center hidden md:table-cell">
                        <Switch
                          checked={consultant.crm_enabled}
                          onCheckedChange={() => toggleCrmMutation.mutate({ id: consultant.id, crmEnabled: consultant.crm_enabled })}
                        />
                      </TableCell>
                      <TableCell className="text-center hidden md:table-cell">
                        <Switch
                          checked={(consultant as any).ranking_visible ?? true}
                          onCheckedChange={() => toggleRankingMutation.mutate({ id: consultant.id, rankingVisible: (consultant as any).ranking_visible ?? true })}
                        />
                      </TableCell>
                      <TableCell className="text-center hidden md:table-cell">
                        <Badge variant={consultant.is_active ? "default" : "secondary"}>
                          {consultant.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center hidden md:table-cell">
                        {consultant.ai_enabled ? (
                          <Bot className="w-4 h-4 text-primary mx-auto" />
                        ) : (
                          <BotOff className="w-4 h-4 text-muted-foreground mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center hidden md:table-cell">
                        <button
                          type="button"
                          onClick={() => setFunnelEdit({ id: consultant.id, name: consultant.full_name })}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted/60 transition-colors"
                          title="Editar funis de acesso"
                        >
                          {(['consultor', 'associado'] as const).map((f) => {
                            const allowed = ((consultant as any).allowed_funnels ?? ['consultor']).includes(f);
                            const isDefault = (consultant as any).default_funnel === f;
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
                        </button>
                      </TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {consultant.quiz_slug && (
                              <>
                                <DropdownMenuItem onClick={() => copyQuizLink(consultant.quiz_slug!)}>
                                  <Copy className="mr-2 h-4 w-4" />
                                  Copiar link
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openQuizLink(consultant.quiz_slug!)}>
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  Abrir quiz
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem 
                              onClick={() => toggleActiveMutation.mutate({ 
                                id: consultant.id, 
                                isActive: !consultant.is_active 
                              })}
                            >
                              {consultant.is_active ? (
                                <>
                                  <UserX className="mr-2 h-4 w-4" />
                                  Desativar
                                </>
                              ) : (
                                <>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Ativar
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => toggleAIMutation.mutate({ 
                                id: consultant.id, 
                                aiEnabled: !consultant.ai_enabled 
                              })}
                            >
                              {consultant.ai_enabled ? (
                                <>
                                  <BotOff className="mr-2 h-4 w-4" />
                                  Desativar IA
                                </>
                              ) : (
                                <>
                                  <Bot className="mr-2 h-4 w-4" />
                                  Ativar IA
                                </>
                              )}
                            </DropdownMenuItem>
                            {!isSelf && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDelete(consultant)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Excluir
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {consultants?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Nenhum consultor cadastrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Single Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir consultor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{consultantToDelete?.name}</strong>? 
              Os leads serão mantidos, mas desassociados deste consultor.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => consultantToDelete && deleteMutation.mutate(consultantToDelete.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} consultor{selectedIds.size > 1 ? 'es' : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{selectedIds.size} consultor{selectedIds.size > 1 ? 'es' : ''}</strong>?
              Os leads serão mantidos, mas desassociados destes consultores.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                `Excluir ${selectedIds.size}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
