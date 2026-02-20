import { useState } from "react";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, RefreshCw, Clock, TrendingUp, DollarSign, Eye, MousePointerClick, Target, BarChart3, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TrafficEvolutionChart } from "./TrafficEvolutionChart";
import { TrafficPeriodFilter } from "./TrafficPeriodFilter";
import { useTrafficMetrics } from "@/hooks/useTrafficMetrics";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { DatePeriodValue } from "@/components/instagram/DatePeriodFilter";

interface AccountInfo {
  id: string;
  ad_account_id: string;
  name: string;
  status: string | null;
  currency: string | null;
  timezone: string | null;
  last_synced_at: string | null;
  is_monitored: boolean | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  account: AccountInfo | null;
  organizationId: string;
}

function formatCurrency(n: number, currency = "BRL") {
  return n.toLocaleString("pt-BR", { style: "currency", currency });
}
function formatNumber(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(0);
}

const MetricCard = ({ icon: Icon, label, value, color }: any) => (
  <Card className="border-border/50">
    <CardContent className="p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-base font-bold text-foreground">{value}</p>
    </CardContent>
  </Card>
);

export function TrafficAccountDetail({ open, onClose, account, organizationId }: Props) {
  const [period, setPeriod] = useState<DatePeriodValue>({
    preset: "30d",
    from: subDays(startOfDay(new Date()), 29),
    to: startOfDay(new Date()),
  });

  const { data: metrics, isLoading } = useTrafficMetrics(
    organizationId,
    period,
    account?.ad_account_id
  );
  const { syncSingleAccount } = useAdAccounts(organizationId);

  if (!account) return null;

  const currency = account.currency || "BRL";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="p-6 pb-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base font-semibold truncate">{account.name}</SheetTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-muted-foreground">ID: {account.ad_account_id}</span>
                {account.currency && <span className="text-xs text-muted-foreground">• {account.currency}</span>}
                {account.timezone && <span className="text-xs text-muted-foreground">• {account.timezone}</span>}
                <Badge
                  variant={account.status === "active" ? "default" : "secondary"}
                  className={`text-xs ${account.status === "active" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" : ""}`}
                >
                  {account.status === "active" ? "Ativa" : account.status || "Inativa"}
                </Badge>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => syncSingleAccount.mutate({ ad_account_id: account.ad_account_id })}
              disabled={syncSingleAccount.isPending}
              className="flex-shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncSingleAccount.isPending ? "animate-spin" : ""}`} />
              Sincronizar
            </Button>
          </div>
          {account.last_synced_at && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2 ml-11">
              <Clock className="h-3 w-3" />
              Última sync: {formatDistanceToNow(new Date(account.last_synced_at), { addSuffix: true, locale: ptBR })}
            </div>
          )}
        </SheetHeader>

        <div className="p-6 space-y-5">
          <TrafficPeriodFilter value={period} onChange={setPeriod} />

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MetricCard icon={DollarSign} label="Total Gasto" value={formatCurrency(metrics?.totalSpend || 0, currency)} color="text-primary" />
              <MetricCard icon={Eye} label="Impressões" value={formatNumber(metrics?.totalImpressions || 0)} color="text-blue-500" />
              <MetricCard icon={MousePointerClick} label="Cliques" value={formatNumber(metrics?.totalClicks || 0)} color="text-emerald-500" />
              <MetricCard icon={BarChart3} label="CTR" value={(metrics?.avgCtr || 0).toFixed(2) + "%"} color="text-yellow-500" />
              <MetricCard icon={Target} label="Alcance" value={formatNumber(metrics?.totalReach || 0)} color="text-purple-500" />
              <MetricCard icon={TrendingUp} label="CPC" value={formatCurrency(metrics?.avgCpc || 0, currency)} color="text-orange-500" />
              <MetricCard icon={Users} label="Visitas ao Perfil" value={formatNumber(metrics?.totalProfileVisits || 0)} color="text-pink-500" />
              <MetricCard icon={TrendingUp} label="Frequência" value={(metrics?.avgFrequency || 0).toFixed(2) + "x"} color="text-cyan-500" />
              <MetricCard icon={DollarSign} label="Custo/Visita" value={formatCurrency(metrics?.avgCostPerVisit || 0, currency)} color="text-rose-500" />
            </div>
          )}

          <TrafficEvolutionChart data={metrics?.dailyData || []} isLoading={isLoading} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
