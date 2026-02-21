import { DollarSign, Eye, MousePointerClick, Target, BarChart3, TrendingUp, Users, Repeat, Heart, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalReach: number;
  totalProfileVisits: number;
  totalPostEngagement: number;
  totalConversions: number;
  avgCtr: number;
  avgCpc: number;
  avgFrequency: number;
  avgCostPerVisit: number;
  isLoading?: boolean;
  lastDate?: string | null;
}

function formatNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}

function formatCurrency(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const metricsConfig = [
  {
    key: "spend", label: "Total Gasto", icon: DollarSign,
    format: formatCurrency, colorClass: "text-primary", borderClass: "border-l-primary", featured: true
  },
  {
    key: "impressions", label: "Impressões", icon: Eye,
    format: formatNumber, colorClass: "text-blue-500", borderClass: "border-l-blue-500"
  },
  {
    key: "clicks", label: "Cliques", icon: MousePointerClick,
    format: formatNumber, colorClass: "text-emerald-500", borderClass: "border-l-emerald-500"
  },
  {
    key: "ctr", label: "CTR Médio", icon: BarChart3,
    format: (n: number) => n.toFixed(2) + "%", colorClass: "text-yellow-500", borderClass: "border-l-yellow-500"
  },
  {
    key: "reach", label: "Alcance", icon: Target,
    format: formatNumber, colorClass: "text-purple-500", borderClass: "border-l-purple-500"
  },
  {
    key: "cpc", label: "CPC Médio", icon: TrendingUp,
    format: formatCurrency, colorClass: "text-orange-500", borderClass: "border-l-orange-500"
  },
  {
    key: "profileVisits", label: "Visitas ao Perfil", icon: Users,
    format: formatNumber, colorClass: "text-pink-500", borderClass: "border-l-pink-500"
  },
  {
    key: "frequency", label: "Frequência Média", icon: Repeat,
    format: (n: number) => n.toFixed(2) + "x", colorClass: "text-cyan-500", borderClass: "border-l-cyan-500"
  },
  {
    key: "postEngagement", label: "Engajamento", icon: Heart,
    format: formatNumber, colorClass: "text-violet-500", borderClass: "border-l-violet-500"
  },
  {
    key: "conversions", label: "Conversões", icon: CheckCircle,
    format: formatNumber, colorClass: "text-rose-500", borderClass: "border-l-rose-500"
  },
];

export function TrafficMetricCards({
  totalSpend, totalImpressions, totalClicks, totalReach,
  totalProfileVisits, totalPostEngagement, totalConversions,
  avgCtr, avgCpc, avgFrequency, avgCostPerVisit,
  isLoading, lastDate
}: Props) {
  const values: Record<string, number> = {
    spend: totalSpend,
    impressions: totalImpressions,
    clicks: totalClicks,
    ctr: avgCtr,
    reach: totalReach,
    cpc: avgCpc,
    profileVisits: totalProfileVisits,
    frequency: avgFrequency,
    postEngagement: totalPostEngagement,
    conversions: totalConversions,
  };

  return (
    <div className="space-y-3">
      {lastDate && (
        <p className="text-xs text-muted-foreground">
          Dados atualizados até: <span className="font-medium text-foreground">{lastDate}</span>
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {metricsConfig.map((m) => {
          const Icon = m.icon;
          return (
            <Card
              key={m.key}
              className={`border-l-4 ${m.borderClass} border-border/50 transition-all hover:shadow-md hover:border-border`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-3.5 w-3.5 ${m.colorClass} flex-shrink-0`} />
                  <span className="text-xs text-muted-foreground truncate">{m.label}</span>
                </div>
                {isLoading ? (
                  <Skeleton className="h-7 w-full" />
                ) : (
                  <p className={`text-base sm:text-lg font-bold ${m.featured ? "text-primary" : "text-foreground"} truncate`}>
                    {m.format(values[m.key])}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
