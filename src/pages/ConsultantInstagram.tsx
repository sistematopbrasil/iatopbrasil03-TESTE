import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InstagramAnalytics } from "@/components/instagram/InstagramAnalytics";
import { InstagramProfilesList } from "@/components/instagram/InstagramProfilesList";
import { BioEditor } from "@/components/consultant/BioEditor";
import { getCurrentConsultant } from "@/lib/consultant-context";
import { UserCircle, TrendingUp, Link as LinkIcon, Loader2 } from "lucide-react";

const ConsultantInstagram = () => {
  const [activeTab, setActiveTab] = useState("profiles");
  const { data: user, isLoading } = useQuery({
    queryKey: ["current-user-instagram"],
    queryFn: getCurrentConsultant,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6 overflow-x-hidden min-w-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Instagram</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie seus perfis, acompanhe o crescimento e configure seu Top Bio
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-xl grid-cols-3">
            <TabsTrigger value="profiles" className="flex items-center gap-2">
              <UserCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Meus perfis</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Análises</span>
            </TabsTrigger>
            <TabsTrigger value="bio" className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Top Bio</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profiles" className="mt-6">
            <InstagramProfilesList />
          </TabsContent>
          <TabsContent value="analytics" className="mt-6">
            <InstagramAnalytics />
          </TabsContent>
          <TabsContent value="bio" className="mt-6">
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
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default ConsultantInstagram;
