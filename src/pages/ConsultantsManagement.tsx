import { useQuery } from '@tanstack/react-query';
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
import { Target, TrendingUp, Flame, Loader2 } from 'lucide-react';

export default function ConsultantsManagement() {
  const { data: currentUser, isLoading: loadingUser } = useQuery({
    queryKey: ['current-user-consultants'],
    queryFn: getCurrentConsultant,
  });

  const { data: consultants, isLoading: loadingConsultants } = useQuery({
    queryKey: ['all-consultants-management'],
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

          const { count: convertedLeads } = await supabase
            .from('quiz_submissions_new')
            .select('*', { count: 'exact', head: true })
            .eq('consultant_id', user.id)
            .eq('stage', 'convertido');

          const { count: hotLeads } = await supabase
            .from('quiz_submissions_new')
            .select('*', { count: 'exact', head: true })
            .eq('consultant_id', user.id)
            .eq('temperature', 'hot');

          const conversionRate = totalLeads && totalLeads > 0 
            ? ((convertedLeads || 0) / totalLeads * 100).toFixed(1) 
            : '0.0';

          return {
            ...user,
            totalLeads: totalLeads || 0,
            convertedLeads: convertedLeads || 0,
            hotLeads: hotLeads || 0,
            conversionRate,
          };
        }) || []
      );

      return consultantsWithMetrics;
    },
    enabled: !!currentUser,
  });

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
      <div className="space-y-6">
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
                      <TrendingUp className="w-4 h-4" />
                      <span className="hidden sm:inline">Conv.</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Flame className="w-4 h-4" />
                      <span className="hidden sm:inline">Quentes</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-center hidden sm:table-cell">Taxa</TableHead>
                  <TableHead className="text-center hidden md:table-cell">Status</TableHead>
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
                    <TableCell className="text-center font-semibold text-green-600">
                      {consultant.convertedLeads}
                    </TableCell>
                    <TableCell className="text-center font-semibold text-orange-600">
                      {consultant.hotLeads}
                    </TableCell>
                    <TableCell className="text-center hidden sm:table-cell">
                      <Badge variant="outline">
                        {consultant.conversionRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center hidden md:table-cell">
                      <Badge variant={consultant.is_active ? "default" : "secondary"}>
                        {consultant.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
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
    </AdminLayout>
  );
}
