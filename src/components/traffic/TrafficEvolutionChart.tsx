import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface DailyData {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  profile_visits: number;
  link_clicks: number;
  ctr: number;
}

interface Props {
  data: DailyData[];
  isLoading?: boolean;
}

const METRICS = [
  { key: "spend", label: "Gasto (R$)", color: "hsl(var(--primary))", format: (v: number) => `R$ ${v.toFixed(2)}` },
  { key: "impressions", label: "Impressões", color: "#3b82f6", format: (v: number) => v.toLocaleString("pt-BR") },
  { key: "clicks", label: "Cliques", color: "#22c55e", format: (v: number) => v.toLocaleString("pt-BR") },
  { key: "reach", label: "Alcance", color: "#a855f7", format: (v: number) => v.toLocaleString("pt-BR") },
  { key: "profile_visits", label: "Visitas ao Perfil", color: "#ec4899", format: (v: number) => v.toLocaleString("pt-BR") },
  { key: "link_clicks", label: "Cliques no Link", color: "#8b5cf6", format: (v: number) => v.toLocaleString("pt-BR") },
  { key: "ctr", label: "CTR (%)", color: "#f59e0b", format: (v: number) => v.toFixed(2) + "%" },
];

export function TrafficEvolutionChart({ data, isLoading }: Props) {
  const [activeMetric, setActiveMetric] = useState("spend");

  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      label: format(parseISO(d.date), "dd/MM", { locale: ptBR }),
    }));
  }, [data]);

  const metric = METRICS.find((m) => m.key === activeMetric) || METRICS[0];

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Evolução Temporal</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-[320px] w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold">Evolução Temporal</CardTitle>
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
            {METRICS.map((m) => (
              <Button
                key={m.key}
                size="sm"
                variant={activeMetric === m.key ? "default" : "ghost"}
                className="h-7 px-2.5 text-xs whitespace-nowrap flex-shrink-0"
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
          <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
            Nenhum dado no período selecionado. Clique em "Sincronizar" para buscar dados.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <defs>
                <linearGradient id={`grad-${activeMetric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={metric.color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={metric.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/20" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
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
                formatter={(value: number) => [metric.format(value), metric.label]}
                labelStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: 4 }}
              />
              <Area
                type="monotone"
                dataKey={activeMetric}
                stroke={metric.color}
                fill={`url(#grad-${activeMetric})`}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: metric.color }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
