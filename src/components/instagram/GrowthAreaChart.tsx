import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import type { InstaMetric } from "@/lib/instagram-utils";

interface Props {
  metrics: InstaMetric[];
}

export function GrowthAreaChart({ metrics }: Props) {
  const sorted = [...metrics].sort((a, b) => a.recorded_date.localeCompare(b.recorded_date));
  const data = sorted.map(m => ({
    date: m.recorded_date,
    followers: m.follower_count,
  }));

  // Calculate dynamic Y domain for better visualization of growth
  const values = data.map(d => d.followers);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal;
  const padding = Math.max(range * 0.15, 10); // At least 15% padding or 10
  const yMin = Math.max(0, Math.floor((minVal - padding) / 10) * 10);
  const yMax = Math.ceil((maxVal + padding) / 10) * 10;

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Sem dados para o período selecionado.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="followerGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => format(parseISO(v), "dd/MM", { locale: ptBR })}
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              domain={[yMin, yMax]}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              labelFormatter={(v) => format(parseISO(v as string), "dd/MM/yyyy", { locale: ptBR })}
              formatter={(v: number) => [v.toLocaleString("pt-BR"), "Seguidores"]}
            />
            <Area
              type="monotone"
              dataKey="followers"
              stroke="hsl(var(--primary))"
              fill="url(#followerGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
