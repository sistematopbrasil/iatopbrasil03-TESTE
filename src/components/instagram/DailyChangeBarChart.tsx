import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import type { InstaMetric } from "@/lib/instagram-utils";

interface Props {
  metrics: InstaMetric[];
}

export function DailyChangeBarChart({ metrics }: Props) {
  const sorted = [...metrics].sort((a, b) => a.recorded_date.localeCompare(b.recorded_date));
  const data = sorted.map(m => ({
    date: m.recorded_date,
    change: m.daily_change,
  }));

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
          <BarChart data={data}>
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
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              labelFormatter={(v) => format(parseISO(v as string), "dd/MM/yyyy", { locale: ptBR })}
              formatter={(v: number) => [v > 0 ? `+${v}` : v, "Variação"]}
            />
            <Bar dataKey="change" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.change >= 0 ? "#22c55e" : "#ef4444"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
