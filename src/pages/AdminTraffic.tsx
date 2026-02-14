import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrafficDashboard } from "@/components/traffic/TrafficDashboard";
import { TrafficAccounts } from "@/components/traffic/TrafficAccounts";
import { TrafficSettings } from "@/components/traffic/TrafficSettings";
import { getCurrentConsultant } from "@/lib/consultant-context";
import { Megaphone } from "lucide-react";

const AdminTraffic = () => {
  const { data: consultant } = useQuery({
    queryKey: ["current-consultant-traffic"],
    queryFn: getCurrentConsultant,
  });

  const organizationId = consultant?.organization_id;

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Megaphone className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tráfego Meta Ads</h1>
            <p className="text-sm text-muted-foreground">Gerencie suas contas de anúncios e acompanhe métricas</p>
          </div>
        </div>

        {organizationId ? (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="accounts">Contas</TabsTrigger>
              <TabsTrigger value="settings">Configurações</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <TrafficDashboard organizationId={organizationId} />
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
