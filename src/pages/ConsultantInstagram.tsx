import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InstagramAnalytics } from "@/components/instagram/InstagramAnalytics";
import { InstagramProfilesList } from "@/components/instagram/InstagramProfilesList";
import { UserCircle, TrendingUp } from "lucide-react";

const ConsultantInstagram = () => {
  const [activeTab, setActiveTab] = useState("profiles");

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6 overflow-x-hidden min-w-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Instagram</h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe o crescimento dos seus perfis vinculados
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="profiles" className="flex items-center gap-2">
              <UserCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Meus perfis</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Análises</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profiles" className="mt-6">
            <InstagramProfilesList canManage={false} />
          </TabsContent>
          <TabsContent value="analytics" className="mt-6">
            <InstagramAnalytics />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default ConsultantInstagram;
