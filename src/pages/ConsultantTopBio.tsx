import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { BioEditor } from "@/components/consultant/BioEditor";
import { getCurrentConsultant } from "@/lib/consultant-context";
import { Loader2 } from "lucide-react";

const ConsultantTopBio = () => {
  const { data: user, isLoading } = useQuery({
    queryKey: ["current-user-top-bio"],
    queryFn: getCurrentConsultant,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6 overflow-x-hidden min-w-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Top Bio</h1>
          <p className="text-muted-foreground mt-1">
            Sua página de link na bio — personalize e compartilhe seu link único
          </p>
        </div>

        {isLoading || !user ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <BioEditor
            userId={user.id}
            organizationId={(user as any).organization_id}
            fullName={user.full_name || ""}
            username={(user as any).username || ""}
          />
        )}
      </div>
    </AdminLayout>
  );
};

export default ConsultantTopBio;
