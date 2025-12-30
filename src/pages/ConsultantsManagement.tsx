import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentConsultant } from '@/lib/consultant-context';
import { Navigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { CreateConsultantDialog } from '@/components/super-admin/CreateConsultantDialog';
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
import { Target, Flame, Loader2, MoreVertical, Copy, ExternalLink, UserX, UserCheck, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { calculateLeadPoints, NOVOS_CONSULTORES_BONUS } from '@/lib/ranking-service';

export default function ConsultantsManagement() {
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [consultantToDelete, setConsultantToDelete] = useState<{ id: string; name: string } | null>(null);

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

  // Delete mutation - using edge function to properly delete auth user
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
      toast.success('Consultor excluído completamente');
      setDeleteDialogOpen(false);
      setConsultantToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao excluir consultor');
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

  if (loadingUser) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  // Redirecionar se não for super admin
  if (currentUser && currentUser.role !== 'super_admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6 overflow-x-hidden max-w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Gestão de Consultores</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie todos os consultores e suas métricas
            </p>
          </div>
          <CreateConsultantDialog />
        </div>

        {loadingConsultants ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
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
                  <TableHead className="text-center hidden md:table-cell">Status</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consultants?.map((consultant) => (
                  <TableRow key={consultant.id}>
                    <TableCell className="font-medium">
                      <div>
                        <p className="truncate max-w-[120px] sm:max-w-none">{consultant.full_name}</p>
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
                      <Badge variant={consultant.is_active ? "default" : "secondary"}>
                        {consultant.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
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
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(consultant)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {consultants?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum consultor cadastrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir consultor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{consultantToDelete?.name}</strong>? 
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
    </AdminLayout>
  );
}