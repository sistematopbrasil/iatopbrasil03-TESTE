import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useAdAccounts(organizationId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const accountsQuery = useQuery({
    queryKey: ["ad-accounts", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ad_accounts")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const listMetaAccounts = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("list-meta-ad-accounts");
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data.accounts;
    },
  });

  const importAccounts = useMutation({
    mutationFn: async (accounts: any[]) => {
      const { data, error } = await supabase.functions.invoke("sync-ad-accounts", {
        body: { accounts, organization_id: organizationId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ad-accounts"] });
      toast({ title: "Contas importadas com sucesso!" });
    },
    onError: (e: Error) => {
      toast({ title: "Erro ao importar contas", description: e.message, variant: "destructive" });
    },
  });

  const toggleMonitoring = useMutation({
    mutationFn: async ({ id, is_monitored }: { id: string; is_monitored: boolean }) => {
      const { error } = await supabase
        .from("ad_accounts")
        .update({ is_monitored })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ad-accounts"] });
    },
  });

  const validateToken = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("validate-meta-token");
      if (error) throw error;
      return data;
    },
  });

  const syncAllAccounts = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-all-accounts");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ad-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["ad-metrics"] });
      toast({ title: `Sincronização concluída! ${data?.synced || 0} contas atualizadas.` });
    },
    onError: (e: Error) => {
      toast({ title: "Erro na sincronização", description: e.message, variant: "destructive" });
    },
  });

  const syncSingleAccount = useMutation({
    mutationFn: async ({ ad_account_id, force60d }: { ad_account_id: string; force60d?: boolean }) => {
      const { data, error } = await supabase.functions.invoke("fetch-meta-ads-data", {
        body: {
          ad_account_id,
          organization_id: organizationId,
          date_preset: force60d ? "last_90d" : "last_3d",
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ad-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["ad-accounts"] });
      toast({ title: `Conta sincronizada! ${data?.synced || 0} dias atualizados.` });
    },
    onError: (e: Error) => {
      toast({ title: "Erro na sincronização", description: e.message, variant: "destructive" });
    },
  });

  const syncHistory = useMutation({
    mutationFn: async (params?: { ad_account_id?: string; organization_id?: string }) => {
      const { data, error } = await supabase.functions.invoke("sync-history", {
        body: params || { organization_id: organizationId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ad-metrics"] });
      toast({ title: "Histórico sincronizado!" });
    },
  });

  return {
    accounts: accountsQuery.data || [],
    isLoading: accountsQuery.isLoading,
    listMetaAccounts,
    importAccounts,
    toggleMonitoring,
    validateToken,
    syncAllAccounts,
    syncSingleAccount,
    syncHistory,
  };
}
