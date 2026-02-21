import { useState, useMemo } from "react";
import { RefreshCw, Clock, Filter } from "lucide-react";
import { formatDistanceToNow, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { startOfDay, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrafficMetricCards } from "./TrafficMetricCards";
import { TrafficPeriodFilter } from "./TrafficPeriodFilter";
import { TrafficAccountDetail } from "./TrafficAccountDetail";
import { useTrafficMetrics } from "@/hooks/useTrafficMetrics";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { DatePeriodValue } from "@/components/instagram/DatePeriodFilter";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";

interface Props {
  organizationId: string;
}

// ---- Fixed Chart: Spend Evolution ----
function SpendChart({ data, isLoading }: { data: any[]; isLoading?: boolean }) {
  const chartData = useMemo(() =>
    data.map(d => ({ ...d, label: format(parseISO(d.date), "dd/MM", { locale: ptBR }) })),
    [data]
  );

  if (isLoading) return <Card><CardHeader><CardTitle className="text-base">Evolução de Gasto</CardTitle></CardHeader><CardContent><Skeleton className="h-[280px] w-full" /></CardContent></Card>;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Evolução de Gasto (R$)</CardTitle>
      </CardHeader>
      <CardContent>
        {!chartData.length ? (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">Sem dados no período</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <defs>
                <linearGradient id="grad-spend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/20" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? (v/1000).toFixed(1)+"K" : v.toFixed(0)} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))", fontSize: "12px" }} formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Gasto"]} labelStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: 4 }} />
              <Area type="monotone" dataKey="spend" stroke="hsl(var(--primary))" fill="url(#grad-spend)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "hsl(var(--primary))" }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Fixed Chart: Impressions vs Clicks ----
function ImpressionsClicksChart({ data, isLoading }: { data: any[]; isLoading?: boolean }) {
  const chartData = useMemo(() =>
    data.map(d => ({ ...d, label: format(parseISO(d.date), "dd/MM", { locale: ptBR }) })),
    [data]
  );

  if (isLoading) return <Card><CardHeader><CardTitle className="text-base">Impressões vs Cliques</CardTitle></CardHeader><CardContent><Skeleton className="h-[280px] w-full" /></CardContent></Card>;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Impressões vs Cliques</CardTitle>
      </CardHeader>
      <CardContent>
        {!chartData.length ? (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">Sem dados no período</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <defs>
                <linearGradient id="grad-impressions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-clicks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/20" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={v => { if (v >= 1_000_000) return (v/1_000_000).toFixed(1)+"M"; if (v >= 1_000) return (v/1_000).toFixed(1)+"K"; return v.toFixed(0); }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))", fontSize: "12px" }} formatter={(v: number, name: string) => [v.toLocaleString("pt-BR"), name === "impressions" ? "Impressões" : "Cliques"]} labelStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: 4 }} />
              <Area type="monotone" dataKey="impressions" stroke="#3b82f6" fill="url(#grad-impressions)" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: "#3b82f6" }} />
              <Area type="monotone" dataKey="clicks" stroke="#22c55e" fill="url(#grad-clicks)" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: "#22c55e" }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Selectable Chart: Metric Explorer ----
const EXPLORER_METRICS = [
  { key: "reach", label: "Alcance", color: "#a855f7", format: (v: number) => v.toLocaleString("pt-BR") },
  { key: "ctr", label: "CTR (%)", color: "#f59e0b", format: (v: number) => v.toFixed(2) + "%" },
  { key: "cpc", label: "CPC (R$)", color: "#ef4444", format: (v: number) => `R$ ${v.toFixed(2)}` },
  { key: "profile_visits", label: "Visitas ao Perfil", color: "#ec4899", format: (v: number) => v.toLocaleString("pt-BR") },
  { key: "frequency", label: "Frequência", color: "#14b8a6", format: (v: number) => v.toFixed(2) },
];

function MetricExplorerChart({ data, isLoading }: { data: any[]; isLoading?: boolean }) {
  const [activeMetric, setActiveMetric] = useState("reach");
  const metric = EXPLORER_METRICS.find(m => m.key === activeMetric) || EXPLORER_METRICS[0];

  const chartData = useMemo(() =>
    data.map(d => ({ ...d, label: format(parseISO(d.date), "dd/MM", { locale: ptBR }) })),
    [data]
  );

  if (isLoading) return <Card><CardHeader><CardTitle className="text-base">Explorar Métricas</CardTitle></CardHeader><CardContent><Skeleton className="h-[280px] w-full" /></CardContent></Card>;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold">Explorar Métricas</CardTitle>
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
            {EXPLORER_METRICS.map(m => (
              <Button key={m.key} size="sm" variant={activeMetric === m.key ? "default" : "ghost"} className="h-7 px-2.5 text-xs whitespace-nowrap flex-shrink-0" onClick={() => setActiveMetric(m.key)}>
                {m.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!chartData.length ? (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">Sem dados no período</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <defs>
                <linearGradient id={`grad-explorer-${activeMetric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={metric.color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={metric.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/20" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={v => { if (v >= 1_000_000) return (v/1_000_000).toFixed(1)+"M"; if (v >= 1_000) return (v/1_000).toFixed(1)+"K"; return v.toFixed(v < 10 ? 2 : 0); }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))", fontSize: "12px" }} formatter={(value: number) => [metric.format(value), metric.label]} labelStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: 4 }} />
              <Area type="monotone" dataKey={activeMetric} stroke={metric.color} fill={`url(#grad-explorer-${activeMetric})`} strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: metric.color }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
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
        avgCtr={metrics?.avgCtr || 0}
        avgCpc={metrics?.avgCpc || 0}
        avgFrequency={metrics?.avgFrequency || 0}
        avgCostPerVisit={metrics?.avgCostPerVisit || 0}
        isLoading={isLoading}
        lastDate={metrics?.lastDate}
      />

      {/* Charts: 2 fixed + 1 selectable */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SpendChart data={metrics?.dailyData || []} isLoading={isLoading} />
        <ImpressionsClicksChart data={metrics?.dailyData || []} isLoading={isLoading} />
      </div>
      <MetricExplorerChart data={metrics?.dailyData || []} isLoading={isLoading} />

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
