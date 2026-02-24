import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrafficDashboard } from "@/components/traffic/TrafficDashboard";
import { TrafficAccounts } from "@/components/traffic/TrafficAccounts";
import { TrafficSettings } from "@/components/traffic/TrafficSettings";
import { CampaignsTab } from "@/components/traffic/CampaignsTab";
import { getCurrentConsultant } from "@/lib/consultant-context";
import { supabase } from "@/integrations/supabase/client";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { Megaphone } from "lucide-react";

const AdminTraffic = () => {
  const { data: consultant } = useQuery({
    queryKey: ["current-consultant-traffic"],
    queryFn: getCurrentConsultant,
  });

  const organizationId = consultant?.organization_id;

  const { data: trafficSettings } = useQuery({
    queryKey: ["traffic-settings", organizationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("traffic_settings")
        .select("ai_enabled")
        .eq("organization_id", organizationId!)
        .single();
      return data;
    },
    enabled: !!organizationId,
  });

  const aiEnabled = trafficSettings?.ai_enabled ?? false;

  // Auto-sync on mount
  const { syncAllAccounts } = useAdAccounts(organizationId);
  const hasSynced = useRef(false);

  useEffect(() => {
    if (organizationId && !hasSynced.current) {
      hasSynced.current = true;
      // Background sync — don't show toast for auto-sync
      supabase.functions.invoke("sync-all-accounts").catch(() => {});
    }
  }, [organizationId]);

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6 min-w-0 w-full">
        <div className="flex items-center gap-3">
          <Megaphone className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tráfego Meta Ads</h1>
            <p className="text-sm text-muted-foreground">Gerencie suas contas de anúncios e acompanhe métricas</p>
          </div>
        </div>

        {organizationId ? (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full sm:w-auto overflow-x-auto">
              <TabsTrigger value="overview" className="text-xs sm:text-sm">Visão Geral</TabsTrigger>
              <TabsTrigger value="campaigns" className="text-xs sm:text-sm">Campanhas</TabsTrigger>
              <TabsTrigger value="accounts" className="text-xs sm:text-sm">Contas</TabsTrigger>
              <TabsTrigger value="settings" className="text-xs sm:text-sm">Configurações</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <TrafficDashboard organizationId={organizationId} />
            </TabsContent>

            <TabsContent value="campaigns">
              <CampaignsTab organizationId={organizationId} aiEnabled={aiEnabled} />
            </TabsContent>

            <TabsContent value="accounts">
              <TrafficAccounts organizationId={organizationId} />
            </TabsContent>

            <TabsContent value="settings">
              <TrafficSettings organizationId={organizationId} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminTraffic;
