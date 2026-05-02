import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConsultantSingleProfileView } from "@/components/instagram/ConsultantSingleProfileView";
import { BioEditor } from "@/components/consultant/BioEditor";
import { getCurrentConsultant } from "@/lib/consultant-context";
import { UserCircle, Link as LinkIcon, Loader2 } from "lucide-react";

const LEGACY_TAB_MAP: Record<string, string> = {
  profiles: "meu-perfil",
  analytics: "meu-perfil",
};

const ConsultantInstagram = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: user, isLoading } = useQuery({
    queryKey: ["current-user-instagram-page"],
    queryFn: getCurrentConsultant,
    staleTime: 5 * 60 * 1000,
  });

  const instagramVisible = (user as any)?.instagram_visible !== false;
  const validTabs = instagramVisible ? ["meu-perfil", "top-bio"] : ["top-bio"];
  const requestedRaw = searchParams.get("tab");
  const requestedTab = requestedRaw ? (LEGACY_TAB_MAP[requestedRaw] || requestedRaw) : null;
  const initialTab = requestedTab && validTabs.includes(requestedTab)
    ? requestedTab
    : (instagramVisible ? "meu-perfil" : "top-bio");

  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const current = searchParams.get("tab");
    if (current !== activeTab) {
      const next = new URLSearchParams(searchParams);
      next.set("tab", activeTab);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (!isLoading && !instagramVisible && activeTab !== "top-bio") {
      setActiveTab("top-bio");
    }
  }, [isLoading, instagramVisible, activeTab]);

  const tabsCount = validTabs.length;
  const gridColsClass = tabsCount === 2 ? "grid-cols-2" : "grid-cols-1";

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6 overflow-x-hidden min-w-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Instagram</h1>
          <p className="text-muted-foreground mt-1">
            {instagramVisible
              ? "Acompanhe o crescimento do seu perfil e personalize seu Top Bio"
              : "Personalize seu Top Bio — sua página de link na bio"}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={`grid w-full max-w-md ${gridColsClass}`}>
            {instagramVisible && (
              <TabsTrigger value="meu-perfil" className="flex items-center gap-2">
                <UserCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Meu perfil</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="top-bio" className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Top Bio</span>
            </TabsTrigger>
          </TabsList>

          {instagramVisible && (
            <TabsContent value="meu-perfil" className="mt-6">
              <ConsultantSingleProfileView />
            </TabsContent>
          )}

          <TabsContent value="top-bio" className="mt-6">
            {isLoading || !user ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
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
