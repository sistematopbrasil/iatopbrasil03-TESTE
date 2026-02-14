import { DollarSign, Eye, MousePointerClick, Target, BarChart3, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalReach: number;
  avgCtr: number;
  avgCpc: number;
  isLoading?: boolean;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(0);
}

function formatCurrency(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const metrics = [
  { key: "spend", label: "Total Gasto", icon: DollarSign, format: formatCurrency, color: "text-red-500" },
  { key: "impressions", label: "Impressões", icon: Eye, format: formatNumber, color: "text-blue-500" },
  { key: "clicks", label: "Cliques", icon: MousePointerClick, format: formatNumber, color: "text-green-500" },
  { key: "ctr", label: "CTR Médio", icon: BarChart3, format: (n: number) => n.toFixed(2) + "%", color: "text-yellow-500" },
  { key: "reach", label: "Alcance", icon: Target, format: formatNumber, color: "text-purple-500" },
  { key: "cpc", label: "CPC Médio", icon: TrendingUp, format: formatCurrency, color: "text-orange-500" },
];

export function TrafficMetricCards({ totalSpend, totalImpressions, totalClicks, totalReach, avgCtr, avgCpc, isLoading }: Props) {
  const values: Record<string, number> = {
    spend: totalSpend,
    impressions: totalImpressions,
    clicks: totalClicks,
    ctr: avgCtr,
    reach: totalReach,
    cpc: avgCpc,
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <Card key={m.key} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${m.color}`} />
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
              {isLoading ? (
                <div className="h-7 bg-muted animate-pulse rounded" />
              ) : (
                <p className="text-lg font-bold text-foreground">{m.format(values[m.key])}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
