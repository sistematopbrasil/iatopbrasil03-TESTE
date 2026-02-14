import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useInstagramUpdate() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateAll = useMutation({
    mutationFn: async (options?: { profileId?: string; organizationId?: string }) => {
      const { data, error } = await supabase.functions.invoke("insta-update-profiles", {
        body: options || {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["insta-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["insta-profiles"] });
      toast({ title: "Atualização concluída", description: data?.message || "Perfis atualizados." });
    },
    onError: (err: any) => {
      toast({ title: "Erro na atualização", description: err.message, variant: "destructive" });
    },
  });

  const fetchPreview = useMutation({
    mutationFn: async (username: string) => {
      const { data, error } = await supabase.functions.invoke("insta-fetch-profile", {
        body: { username },
      });
      if (error) throw error;
      return data;
    },
  });

  return { updateAll, fetchPreview };
}
