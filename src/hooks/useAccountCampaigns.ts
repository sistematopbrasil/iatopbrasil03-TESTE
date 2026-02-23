import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CampaignInsights {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  ctr: number;
  cpc: number;
  frequency: number;
}

export interface CampaignTargeting {
  age_min: number;
  age_max: number;
  gender: string;
  locations: string[];
  interests: string[];
  placements: string[];
  publisher_platforms: string[];
}

export interface AdCreative {
  id: string;
  name: string;
  thumbnail_url: string | null;
  image_url: string | null;
  body: string | null;
  title: string | null;
}

export interface Ad {
  id: string;
  name: string;
  status: string;
  creative: AdCreative | null;
}

export interface AdSet {
  id: string;
  name: string;
  status: string;
  daily_budget: number | null;
  lifetime_budget: number | null;
  optimization_goal: string | null;
  targeting: CampaignTargeting;
  insights: CampaignInsights;
  ads: Ad[];
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget: number | null;
  lifetime_budget: number | null;
  budget_remaining: number | null;
  start_time: string | null;
  stop_time: string | null;
  created_time: string;
  insights: CampaignInsights;
  targeting: CampaignTargeting;
  adsets_count: number;
  adsets: AdSet[];
}

export function useAccountCampaigns(ad_account_id?: string | null) {
  return useQuery<Campaign[]>({
    queryKey: ["account-campaigns", ad_account_id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-account-campaigns", {
        body: { ad_account_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.campaigns || [];
    },
    enabled: !!ad_account_id,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    retry: 1,
  });
}
