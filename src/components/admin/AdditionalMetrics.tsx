import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Activity, Timer, Target } from "lucide-react";
import { format, getHours } from "date-fns";

interface AdditionalMetricsProps {
  submissions: any[] | undefined;
  isLoading: boolean;
}

export function AdditionalMetrics({ submissions, isLoading }: AdditionalMetricsProps) {
  const metrics = useMemo(() => {
    if (!submissions || submissions.length === 0) {
      return {
        peakHour: "--",
        peakHourCount: 0,
        abandonmentRate: 0,
        avgCompletionTime: "--",
        todayLeads: 0,
      };
    }

    // Horário de pico
    const hourCounts: Record<number, number> = {};
    submissions.forEach((sub: any) => {
      const hour = getHours(new Date(sub.created_at));
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    const peakHourEntry = Object.entries(hourCounts).reduce(
      (max, [hour, count]) => (count > max.count ? { hour: parseInt(hour), count } : max),
      { hour: 0, count: 0 }
    );

    // Taxa de abandono
    const incomplete = submissions.filter((s: any) => s.completion_percentage < 100).length;
    const abandonmentRate = (incomplete / submissions.length) * 100;

    // Leads de hoje
    const today = format(new Date(), "yyyy-MM-dd");
    const todayLeads = submissions.filter((s: any) => 
      format(new Date(s.created_at), "yyyy-MM-dd") === today
    ).length;

    // Estimativa de tempo médio (baseado na diferença entre created_at e updated_at)
    const completedWithTime = submissions.filter((s: any) => {
      if (s.completion_percentage !== 100) return false;
      const created = new Date(s.created_at).getTime();
      const updated = new Date(s.updated_at).getTime();
      const diff = (updated - created) / 1000 / 60; // em minutos
      return diff > 0 && diff < 60; // Ignorar valores inválidos
    });

    let avgCompletionTime = "--";
    if (completedWithTime.length > 0) {
      const avgMinutes = completedWithTime.reduce((acc, s) => {
        const diff = (new Date(s.updated_at).getTime() - new Date(s.created_at).getTime()) / 1000 / 60;
        return acc + diff;
      }, 0) / completedWithTime.length;
      
      if (avgMinutes < 1) {
        avgCompletionTime = "<1min";
      } else {
        avgCompletionTime = `${Math.round(avgMinutes)}min`;
      }
    }

    return {
      peakHour: `${peakHourEntry.hour.toString().padStart(2, "0")}:00`,
      peakHourCount: peakHourEntry.count,
      abandonmentRate,
      avgCompletionTime,
      todayLeads,
    };
  }, [submissions]);

  const MetricCard = ({ 
    icon: Icon, 
    label, 
    value, 
    subValue, 
    color = "primary" 
  }: { 
    icon: any; 
    label: string; 
    value: string | number; 
    subValue?: string;
    color?: "primary" | "green" | "yellow" | "cyan";
  }) => {
    const colorClasses = {
      primary: "from-primary/20 to-primary/5 border-primary/20 text-primary",
      green: "from-green-500/20 to-green-500/5 border-green-500/20 text-green-500",
      yellow: "from-yellow-500/20 to-yellow-500/5 border-yellow-500/20 text-yellow-500",
      cyan: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/20 text-cyan-500",
    };

    if (isLoading) {
      return (
        <Card className="border-border/30 bg-card">
          <CardContent className="p-4">
            <Skeleton className="h-8 w-8 rounded-lg mb-2" />
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-6 w-12" />
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="group border-border/30 bg-gradient-to-br from-card to-card/80 hover:border-border/50 transition-all duration-300">
        <CardContent className="p-4">
          <div className={`p-2 bg-gradient-to-br ${colorClasses[color]} rounded-lg w-fit border mb-2`}>
            <Icon className={`h-4 w-4 ${color === "primary" ? "text-primary" : color === "green" ? "text-green-500" : color === "yellow" ? "text-yellow-500" : "text-cyan-500"}`} />
          </div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            {label}
          </p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold text-foreground">{value}</span>
            {subValue && (
              <span className="text-xs text-muted-foreground">{subValue}</span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard
        icon={Clock}
        label="Horário de Pico"
        value={metrics.peakHour}
        subValue={`(${metrics.peakHourCount} leads)`}
        color="cyan"
      />
      <MetricCard
        icon={Activity}
        label="Taxa Abandono"
        value={`${metrics.abandonmentRate.toFixed(1)}%`}
        color="yellow"
      />
      <MetricCard
        icon={Timer}
        label="Tempo Médio"
        value={metrics.avgCompletionTime}
        color="green"
      />
      <MetricCard
        icon={Target}
        label="Leads Hoje"
        value={metrics.todayLeads}
        color="primary"
      />
    </div>
  );
}
