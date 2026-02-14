import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DatePeriodValue } from "@/components/instagram/DatePeriodFilter";
import { format } from "date-fns";

interface TrafficMetrics {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalReach: number;
  avgCtr: number;
  avgCpc: number;
  dailyData: Array<{
    date: string;
    spend: number;
    impressions: number;
    clicks: number;
    reach: number;
  }>;
}

export function useTrafficMetrics(organizationId?: string, period?: DatePeriodValue) {
  return useQuery({
    queryKey: ["ad-metrics", organizationId, period?.preset, period?.from?.toISOString(), period?.to?.toISOString()],
    queryFn: async (): Promise<TrafficMetrics> => {
      let query = supabase
        .from("ad_metrics")
        .select("*")
        .order("date", { ascending: true });

      if (period && period.preset !== "total" && period.from) {
        query = query.gte("date", format(period.from, "yyyy-MM-dd"));
      }
      if (period && period.preset !== "total" && period.to) {
        query = query.lte("date", format(period.to, "yyyy-MM-dd"));
      }

      const { data, error } = await query;
      if (error) throw error;

      const metrics = data || [];
      const totalSpend = metrics.reduce((s, m) => s + Number(m.spend), 0);
      const totalImpressions = metrics.reduce((s, m) => s + Number(m.impressions), 0);
      const totalClicks = metrics.reduce((s, m) => s + Number(m.clicks), 0);
      const totalReach = metrics.reduce((s, m) => s + Number(m.reach), 0);
      const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

      // Aggregate daily across all accounts
      const dailyMap = new Map<string, { spend: number; impressions: number; clicks: number; reach: number }>();
      for (const m of metrics) {
        const key = m.date;
        const existing = dailyMap.get(key) || { spend: 0, impressions: 0, clicks: 0, reach: 0 };
        existing.spend += Number(m.spend);
        existing.impressions += Number(m.impressions);
        existing.clicks += Number(m.clicks);
        existing.reach += Number(m.reach);
        dailyMap.set(key, existing);
      }

      const dailyData = Array.from(dailyMap.entries())
        .map(([date, vals]) => ({ date, ...vals }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return { totalSpend, totalImpressions, totalClicks, totalReach, avgCtr, avgCpc, dailyData };
    },
    enabled: !!organizationId,
  });
}
