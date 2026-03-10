import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from "@/components/admin/AdminLayout";
import { getCurrentConsultant, isSuperAdmin } from "@/lib/consultant-context";
import { ConsultantDashboard } from '@/components/consultant/ConsultantDashboard';
import { DashboardSkeleton } from '@/components/ui/page-skeleton';
import { supabase } from '@/integrations/supabase/client';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { data: currentUser, isLoading } = useQuery({
    queryKey: ['current-user-dashboard'],
    queryFn: getCurrentConsultant,
  });

  // ✅ Realtime subscription para atualizações automáticas de leads
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-leads-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'quiz_submissions_new',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['all-leads-consultant'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['ranking'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'], exact: false });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Se for Super Admin, redirecionar para /admin/super
  useEffect(() => {
    if (!isLoading && currentUser && isSuperAdmin(currentUser.role)) {
      navigate('/admin/super', { replace: true });
    }
  }, [currentUser, isLoading, navigate]);

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  // Se for super admin, mostrar loading enquanto redireciona
  if (currentUser && isSuperAdmin(currentUser.role)) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6 overflow-x-hidden max-w-full">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Olá, {currentUser?.full_name?.split(' ')[0] || 'Consultor'}! 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe seus leads e evolua no ranking
          </p>
        </div>

        {/* Dashboard do Consultor */}
        <ConsultantDashboard />
      </div>
    </AdminLayout>
  );
}
