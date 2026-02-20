import { useState } from "react";
import { RefreshCw, Clock, Filter } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { startOfDay, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrafficMetricCards } from "./TrafficMetricCards";
import { TrafficEvolutionChart } from "./TrafficEvolutionChart";
import { TrafficSpendChart } from "./TrafficSpendChart";
import { TrafficAccountsTable } from "./TrafficAccountsTable";
import { TrafficPeriodFilter } from "./TrafficPeriodFilter";
import { TrafficAccountDetail } from "./TrafficAccountDetail";
import { useTrafficMetrics } from "@/hooks/useTrafficMetrics";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { DatePeriodValue } from "@/components/instagram/DatePeriodFilter";

interface Props {
  organizationId: string;
}

export function TrafficDashboard({ organizationId }: Props) {
  const [period, setPeriod] = useState<DatePeriodValue>({
    preset: "7d",
    from: subDays(startOfDay(new Date()), 6),
    to: startOfDay(new Date()),
  });
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined);
  const [detailAccount, setDetailAccount] = useState<string | null>(null);

  const { data: metrics, isLoading } = useTrafficMetrics(organizationId, period, selectedAccountId);
  const { accounts, syncAllAccounts, toggleMonitoring } = useAdAccounts(organizationId);

  const monitoredAccounts = accounts.filter((a) => a.is_monitored);

  const lastSync = accounts.reduce((latest, acc) => {
    if (!acc.last_synced_at) return latest;
    const d = new Date(acc.last_synced_at);
    return d > latest ? d : latest;
  }, new Date(0));

  const lastSyncLabel = lastSync.getTime() > 0
    ? formatDistanceToNow(lastSync, { addSuffix: true, locale: ptBR })
    : "Nunca sincronizado";

  // Build table rows by joining account info with metrics byAccount
  const tableRows = accounts.map((acc) => {
    const accMetrics = metrics?.byAccount.find((b) => b.ad_account_id === acc.ad_account_id);
    return {
      id: acc.id,
      ad_account_id: acc.ad_account_id,
      name: acc.name,
      status: acc.status,
      is_monitored: acc.is_monitored,
      spend: accMetrics?.spend || 0,
      impressions: accMetrics?.impressions || 0,
      clicks: accMetrics?.clicks || 0,
      ctr: accMetrics?.ctr || 0,
      reach: accMetrics?.reach || 0,
      profile_visits: accMetrics?.profile_visits || 0,
      link_clicks: accMetrics?.link_clicks || 0,
    };
  });

  const detailAccountInfo = accounts.find((a) => a.ad_account_id === detailAccount) || null;

  return (
    <div className="space-y-5">
      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
          <TrafficPeriodFilter value={period} onChange={setPeriod} />

          {monitoredAccounts.length > 1 && (
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select
                value={selectedAccountId || "all"}
                onValueChange={(v) => setSelectedAccountId(v === "all" ? undefined : v)}
              >
                <SelectTrigger className="h-8 w-[200px] text-xs">
                  <SelectValue placeholder="Todas as contas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as contas</SelectItem>
                  {monitoredAccounts.map((acc) => (
                    <SelectItem key={acc.ad_account_id} value={acc.ad_account_id}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {lastSyncLabel}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => syncAllAccounts.mutate()}
            disabled={syncAllAccounts.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${syncAllAccounts.isPending ? "animate-spin" : ""}`} />
            Sincronizar
          </Button>
        </div>
      </div>

      {/* Metric cards */}
      <TrafficMetricCards
        totalSpend={metrics?.totalSpend || 0}
        totalImpressions={metrics?.totalImpressions || 0}
        totalClicks={metrics?.totalClicks || 0}
        totalReach={metrics?.totalReach || 0}
        totalProfileVisits={metrics?.totalProfileVisits || 0}
        totalLinkClicks={metrics?.totalLinkClicks || 0}
        totalVideoViews={metrics?.totalVideoViews || 0}
        avgCtr={metrics?.avgCtr || 0}
        avgCpc={metrics?.avgCpc || 0}
        avgFrequency={metrics?.avgFrequency || 0}
        avgCostPerVisit={metrics?.avgCostPerVisit || 0}
        isLoading={isLoading}
        lastDate={metrics?.lastDate}
      />

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TrafficEvolutionChart data={metrics?.dailyData || []} isLoading={isLoading} />
        <TrafficSpendChart
          byAccount={metrics?.byAccount || []}
          accounts={accounts}
          isLoading={isLoading}
        />
      </div>

      {/* Performance table */}
      <TrafficAccountsTable
        rows={tableRows}
        isLoading={isLoading}
        onViewDetail={(id) => setDetailAccount(id)}
        onToggleMonitoring={(id, is_monitored) => toggleMonitoring.mutate({ id, is_monitored })}
        isToggling={toggleMonitoring.isPending}
      />

      {/* Account Detail Sheet */}
      <TrafficAccountDetail
        open={!!detailAccount}
        onClose={() => setDetailAccount(null)}
        account={detailAccountInfo as any}
        organizationId={organizationId}
      />
    </div>
  );
}
