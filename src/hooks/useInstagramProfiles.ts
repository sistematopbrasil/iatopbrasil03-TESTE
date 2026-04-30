import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { InstaProfile } from "@/lib/instagram-utils";

export function useInstagramProfiles() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const profilesQuery = useQuery({
    queryKey: ["insta-profiles"],
    queryFn: async () => {
      // RLS aplica o filtro: admin vê todos da org, consultor só os vinculados
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("insta_profiles")
        .select("*")
        .order("username");
      if (error) throw error;
      return (data as InstaProfile[]).filter((p) => p && (p.organization_id || p.id));
    },
    staleTime: 2 * 60 * 1000,
  });

  const addProfile = useMutation({
    mutationFn: async (profile: {
      username: string;
      display_name?: string;
      profile_picture?: string;
      category?: string;
      notes?: string;
      organization_id: string;
    }) => {
      const { data, error } = await supabase
        .from("insta_profiles")
        .insert({
          username: profile.username,
          display_name: profile.display_name || null,
          profile_picture: profile.profile_picture || null,
          profile_url: `https://instagram.com/${profile.username}`,
          category: profile.category || null,
          notes: profile.notes || null,
          organization_id: profile.organization_id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insta-profiles"] });
      toast({ title: "Perfil adicionado com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao adicionar perfil", description: err.message, variant: "destructive" });
    },
  });

  const updateProfile = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InstaProfile> & { id: string }) => {
      const { error } = await supabase
        .from("insta_profiles")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insta-profiles"] });
      toast({ title: "Perfil atualizado!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar perfil", description: err.message, variant: "destructive" });
    },
  });

  const deleteProfile = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("insta_profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insta-profiles"] });
      toast({ title: "Perfil removido!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao remover perfil", description: err.message, variant: "destructive" });
    },
  });

  return { ...profilesQuery, addProfile, updateProfile, deleteProfile };
}
