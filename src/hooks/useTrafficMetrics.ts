import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DatePeriodValue } from "@/components/instagram/DatePeriodFilter";
import { format } from "date-fns";

export interface TrafficMetrics {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalReach: number;
  totalProfileVisits: number;
  avgCtr: number;
  avgCpc: number;
  avgFrequency: number;
  avgCostPerVisit: number;
  dailyData: Array<{
    date: string;
    spend: number;
    impressions: number;
    clicks: number;
    reach: number;
    profile_visits: number;
    ctr: number;
    cpc: number;
    frequency: number;
  }>;
  byAccount: Array<{
    ad_account_id: string;
    spend: number;
    impressions: number;
    clicks: number;
    reach: number;
    ctr: number;
    cpc: number;
    profile_visits: number;
  }>;
  lastDate: string | null;
}

export function useTrafficMetrics(
  organizationId?: string,
  period?: DatePeriodValue,
  accountId?: string
) {
  return useQuery({
    queryKey: ["ad-metrics", organizationId, period?.preset, period?.from?.toISOString(), period?.to?.toISOString(), accountId],
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

      if (accountId) {
        query = query.eq("ad_account_id", accountId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const metrics = data || [];

      const totalSpend = metrics.reduce((s, m) => s + Number(m.spend || 0), 0);
      const totalImpressions = metrics.reduce((s, m) => s + Number(m.impressions || 0), 0);
      const totalClicks = metrics.reduce((s, m) => s + Number(m.clicks || 0), 0);
      const totalReach = metrics.reduce((s, m) => s + Number(m.reach || 0), 0);
      const totalProfileVisits = metrics.reduce((s, m) => s + Number(m.profile_visits || 0), 0);

      const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
      const avgFrequency = totalReach > 0 ? totalImpressions / totalReach : 0;
      const avgCostPerVisit = totalProfileVisits > 0 ? totalSpend / totalProfileVisits : 0;

      // Aggregate daily across all accounts
      const dailyMap = new Map<string, {
        spend: number; impressions: number; clicks: number; reach: number;
        profile_visits: number;
      }>();
      for (const m of metrics) {
        const key = m.date;
        const existing = dailyMap.get(key) || {
          spend: 0, impressions: 0, clicks: 0, reach: 0,
          profile_visits: 0,
        };
        existing.spend += Number(m.spend || 0);
        existing.impressions += Number(m.impressions || 0);
        existing.clicks += Number(m.clicks || 0);
        existing.reach += Number(m.reach || 0);
        existing.profile_visits += Number(m.profile_visits || 0);
        dailyMap.set(key, existing);
      }

      const dailyData = Array.from(dailyMap.entries())
        .map(([date, vals]) => ({
          date,
          spend: vals.spend,
          impressions: vals.impressions,
          clicks: vals.clicks,
          reach: vals.reach,
          profile_visits: vals.profile_visits,
          ctr: vals.impressions > 0 ? (vals.clicks / vals.impressions) * 100 : 0,
          cpc: vals.clicks > 0 ? vals.spend / vals.clicks : 0,
          frequency: vals.reach > 0 ? vals.impressions / vals.reach : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Aggregate by account
      const accountMap = new Map<string, {
        spend: number; impressions: number; clicks: number; reach: number;
        profile_visits: number;
        ctr_sum: number; cpc_sum: number; count: number;
      }>();
      for (const m of metrics) {
        const key = m.ad_account_id;
        const existing = accountMap.get(key) || {
          spend: 0, impressions: 0, clicks: 0, reach: 0,
          profile_visits: 0,
          ctr_sum: 0, cpc_sum: 0, count: 0
        };
        existing.spend += Number(m.spend || 0);
        existing.impressions += Number(m.impressions || 0);
        existing.clicks += Number(m.clicks || 0);
        existing.reach += Number(m.reach || 0);
        existing.profile_visits += Number((m as any).profile_visits || 0);
        existing.ctr_sum += Number(m.ctr || 0);
        existing.cpc_sum += Number(m.cpc || 0);
        existing.count += 1;
        accountMap.set(key, existing);
      }

      const byAccount = Array.from(accountMap.entries()).map(([ad_account_id, vals]) => ({
        ad_account_id,
        spend: vals.spend,
        impressions: vals.impressions,
        clicks: vals.clicks,
        reach: vals.reach,
        ctr: vals.impressions > 0 ? (vals.clicks / vals.impressions) * 100 : 0,
        cpc: vals.clicks > 0 ? vals.spend / vals.clicks : 0,
        profile_visits: vals.profile_visits,
      })).sort((a, b) => b.spend - a.spend);

      const lastDate = metrics.length > 0 ? metrics[metrics.length - 1].date : null;

      return {
        totalSpend, totalImpressions, totalClicks, totalReach,
        totalProfileVisits,
        avgCtr, avgCpc, avgFrequency, avgCostPerVisit,
        dailyData, byAccount, lastDate
      };
    },
    enabled: !!organizationId,
    refetchInterval: 5 * 60 * 1000,
  });
}
