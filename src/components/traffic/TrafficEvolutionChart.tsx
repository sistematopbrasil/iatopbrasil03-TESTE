import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DailyData {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
}

interface Props {
  data: DailyData[];
  isLoading?: boolean;
}

export function TrafficEvolutionChart({ data, isLoading }: Props) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      label: format(parseISO(d.date), "dd/MM", { locale: ptBR }),
    }));
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Evolução</CardTitle></CardHeader>
        <CardContent><div className="h-[300px] bg-muted animate-pulse rounded" /></CardContent>
      </Card>
    );
  }

  if (!chartData.length) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Evolução</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Nenhum dado no período selecionado
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Evolução Temporal</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="clicksGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} className="text-muted-foreground" />
            <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                color: "hsl(var(--foreground))",
              }}
              formatter={(value: number, name: string) => {
                if (name === "spend") return [`R$ ${value.toFixed(2)}`, "Gasto"];
                if (name === "clicks") return [value, "Cliques"];
                return [value, name];
              }}
            />
            <Area type="monotone" dataKey="spend" stroke="hsl(var(--primary))" fill="url(#spendGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="clicks" stroke="#22c55e" fill="url(#clicksGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
