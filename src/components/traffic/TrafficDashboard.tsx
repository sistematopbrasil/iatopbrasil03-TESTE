import { useState } from "react";
import { DatePeriodFilter, DatePeriodValue } from "@/components/instagram/DatePeriodFilter";
import { TrafficMetricCards } from "./TrafficMetricCards";
import { TrafficEvolutionChart } from "./TrafficEvolutionChart";
import { useTrafficMetrics } from "@/hooks/useTrafficMetrics";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { Button } from "@/components/ui/button";
import { RefreshCw, Clock } from "lucide-react";
import { startOfDay, subDays } from "date-fns";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  organizationId: string;
}

export function TrafficDashboard({ organizationId }: Props) {
  const [period, setPeriod] = useState<DatePeriodValue>({
    preset: "7d",
    from: subDays(startOfDay(new Date()), 6),
    to: startOfDay(new Date()),
  });

  const { data: metrics, isLoading } = useTrafficMetrics(organizationId, period);
  const { accounts, syncAllAccounts } = useAdAccounts(organizationId);

  const lastSync = accounts.reduce((latest, acc) => {
    if (!acc.last_synced_at) return latest;
    const d = new Date(acc.last_synced_at);
    return d > latest ? d : latest;
  }, new Date(0));

  const lastSyncLabel = lastSync.getTime() > 0
    ? formatDistanceToNow(lastSync, { addSuffix: true, locale: ptBR })
    : "Nunca sincronizado";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <DatePeriodFilter value={period} onChange={setPeriod} />
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

      <TrafficMetricCards
        totalSpend={metrics?.totalSpend || 0}
        totalImpressions={metrics?.totalImpressions || 0}
        totalClicks={metrics?.totalClicks || 0}
        totalReach={metrics?.totalReach || 0}
        avgCtr={metrics?.avgCtr || 0}
        avgCpc={metrics?.avgCpc || 0}
        isLoading={isLoading}
      />

      <TrafficEvolutionChart data={metrics?.dailyData || []} isLoading={isLoading} />
    </div>
  );
}
