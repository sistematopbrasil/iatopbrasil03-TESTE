import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface AccountData {
  ad_account_id: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  ctr: number;
  cpc: number;
  profile_visits: number;
}

interface AccountInfo {
  ad_account_id: string;
  name: string;
}

interface Props {
  byAccount: AccountData[];
  accounts: AccountInfo[];
  isLoading?: boolean;
}

const COLORS = [
  "hsl(var(--primary))", "#3b82f6", "#22c55e", "#a855f7",
  "#ec4899", "#f59e0b", "#14b8a6", "#ef4444"
];

const METRICS = [
  { key: "spend", label: "Gasto (R$)", format: (v: number) => `R$ ${v.toFixed(2)}` },
  { key: "impressions", label: "Impressões", format: (v: number) => v.toLocaleString("pt-BR") },
  { key: "clicks", label: "Cliques", format: (v: number) => v.toLocaleString("pt-BR") },
  { key: "reach", label: "Alcance", format: (v: number) => v.toLocaleString("pt-BR") },
  { key: "ctr", label: "CTR (%)", format: (v: number) => v.toFixed(2) + "%" },
  { key: "cpc", label: "CPC (R$)", format: (v: number) => `R$ ${v.toFixed(2)}` },
];

export function TrafficSpendChart({ byAccount, accounts, isLoading }: Props) {
  const [activeMetric, setActiveMetric] = useState("spend");

  const metric = METRICS.find((m) => m.key === activeMetric) || METRICS[0];

  const chartData = useMemo(() => {
    return byAccount.map((acc) => {
      const info = accounts.find((a) => a.ad_account_id === acc.ad_account_id);
      const name = info?.name || acc.ad_account_id;
      // Truncate long names
      const shortName = name.length > 18 ? name.substring(0, 16) + "…" : name;
      return { ...acc, name: shortName, fullName: name };
    });
  }, [byAccount, accounts]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Performance por Conta</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-[280px] w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold">Performance por Conta</CardTitle>
          <div className="flex flex-wrap gap-1">
            {METRICS.map((m) => (
              <Button
                key={m.key}
                size="sm"
                variant={activeMetric === m.key ? "default" : "ghost"}
                className="h-7 px-2.5 text-xs"
                onClick={() => setActiveMetric(m.key)}
              >
                {m.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!chartData.length ? (
          <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
            Nenhum dado disponível. Sincronize as contas primeiro.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 30, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/20" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                angle={-30}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => {
                  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
                  if (v >= 1_000) return (v / 1_000).toFixed(1) + "K";
                  return v.toFixed(0);
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  color: "hsl(var(--foreground))",
                  fontSize: "12px",
                }}
                formatter={(value: number, _, props) => [
                  metric.format(value),
                  props.payload?.fullName || metric.label
                ]}
              />
              <Bar dataKey={activeMetric} radius={[4, 4, 0, 0]}>
                {chartData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
