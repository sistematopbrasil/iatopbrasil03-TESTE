import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { getCurrentConsultant, isSuperAdmin } from "@/lib/consultant-context";
import { ConsultantSettings } from "@/components/consultant/ConsultantSettings";
import { SuperAdminSettings } from "@/components/super-admin/SuperAdminSettings";
import { Loader2 } from "lucide-react";

export default function AdminSettings() {
  const { data: currentUser, isLoading } = useQuery({
    queryKey: ['current-user-settings'],
    queryFn: getCurrentConsultant,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  // Só mostrar loading se não temos dados ainda
  if (isLoading && !currentUser) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  // Renderizar configurações baseado no role
  if (currentUser && isSuperAdmin(currentUser.role)) {
    return (
      <AdminLayout>
        <SuperAdminSettings />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <ConsultantSettings />
    </AdminLayout>
  );
}
