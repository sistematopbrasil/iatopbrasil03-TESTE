import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { InstaMetric } from "@/lib/instagram-utils";

export function useInstagramMetrics(profileId?: string) {
  return useQuery({
    queryKey: ["insta-metrics", profileId || "all"],
    queryFn: async () => {
      let query = supabase
        .from("insta_follower_metrics")
        .select("*")
        .order("recorded_date", { ascending: false });

      if (profileId) {
        query = query.eq("profile_id", profileId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as InstaMetric[];
    },
    staleTime: 2 * 60 * 1000,
  });
}
