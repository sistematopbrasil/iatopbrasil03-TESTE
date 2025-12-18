import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TemporalChartProps {
  submissions: any[] | undefined;
  isLoading: boolean;
  days?: number;
}

export function TemporalChart({ submissions, isLoading, days = 14 }: TemporalChartProps) {
  const chartData = useMemo(() => {
    if (!submissions) return [];

    const today = startOfDay(new Date());
    const startDate = subDays(today, days - 1);
    
    // Criar array com todos os dias do período
    const dateRange = eachDayOfInterval({ start: startDate, end: today });
    
    // Contar leads por dia
    const countsByDate: Record<string, { total: number; completed: number }> = {};
    
    dateRange.forEach(date => {
      const key = format(date, "yyyy-MM-dd");
      countsByDate[key] = { total: 0, completed: 0 };
    });

    submissions.forEach((sub: any) => {
      const date = format(new Date(sub.created_at), "yyyy-MM-dd");
      if (countsByDate[date]) {
        countsByDate[date].total++;
        if (sub.completion_percentage === 100) {
          countsByDate[date].completed++;
        }
      }
    });

    return dateRange.map(date => {
      const key = format(date, "yyyy-MM-dd");
      return {
        date: key,
        displayDate: format(date, "dd/MM", { locale: ptBR }),
        dayName: format(date, "EEE", { locale: ptBR }),
        total: countsByDate[key]?.total || 0,
        completed: countsByDate[key]?.completed || 0,
      };
    });
  }, [submissions, days]);

  const trend = useMemo(() => {
    if (chartData.length < 2) return { direction: "neutral", percentage: 0 };
    
    const midPoint = Math.floor(chartData.length / 2);
    const firstHalf = chartData.slice(0, midPoint);
    const secondHalf = chartData.slice(midPoint);
    
    const firstHalfAvg = firstHalf.reduce((acc, d) => acc + d.total, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((acc, d) => acc + d.total, 0) / secondHalf.length;
    
    if (firstHalfAvg === 0) return { direction: "up", percentage: 100 };
    
    const change = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
    
    return {
      direction: change > 5 ? "up" : change < -5 ? "down" : "neutral",
      percentage: Math.abs(change),
    };
  }, [chartData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card/95 backdrop-blur-xl border border-primary/30 rounded-xl p-3 shadow-2xl">
          <p className="text-xs text-muted-foreground mb-1">
            {data.dayName}, {data.displayDate}
          </p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-sm">
                <span className="font-bold text-primary">{data.total}</span>
                <span className="text-muted-foreground"> leads</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm">
                <span className="font-bold text-green-500">{data.completed}</span>
                <span className="text-muted-foreground"> completos</span>
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const totalInPeriod = chartData.reduce((acc, d) => acc + d.total, 0);
  const completedInPeriod = chartData.reduce((acc, d) => acc + d.completed, 0);

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Evolução Temporal
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Leads por dia nos últimos {days} dias
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            {/* Trend Indicator */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              trend.direction === "up" ? "bg-green-500/10 text-green-500" :
              trend.direction === "down" ? "bg-red-500/10 text-red-500" :
              "bg-muted text-muted-foreground"
            }`}>
              {trend.direction === "up" && <TrendingUp className="h-3 w-3" />}
              {trend.direction === "down" && <TrendingDown className="h-3 w-3" />}
              {trend.direction === "neutral" && <Minus className="h-3 w-3" />}
              {trend.percentage.toFixed(0)}%
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-primary">{totalInPeriod}</p>
              <p className="text-[10px] text-muted-foreground">no período</p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="hsl(var(--border))" 
              opacity={0.3}
              vertical={false}
            />
            
            <XAxis 
              dataKey="displayDate" 
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            
            <YAxis 
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            <Area
              type="monotone"
              dataKey="total"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#totalGradient)"
              animationDuration={1000}
            />
            
            <Area
              type="monotone"
              dataKey="completed"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#completedGradient)"
              animationDuration={1200}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-border/30">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">Total de leads</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-xs text-muted-foreground">Completos</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
