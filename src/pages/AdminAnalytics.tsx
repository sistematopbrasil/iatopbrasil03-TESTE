import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, CheckCircle, Clock, TrendingUp, AlertTriangle, Timer, CalendarDays } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ConversionFunnel } from "@/components/admin/ConversionFunnel";
import { TemporalChart } from "@/components/admin/TemporalChart";
import { getCurrentConsultant, isSuperAdmin } from "@/lib/consultant-context";

// Paleta moderna com gradientes - cores tecnológicas
const COLORS = [
  "#f97316", // laranja vibrante
  "#06b6d4", // ciano tech
  "#8b5cf6", // roxo moderno
  "#22c55e", // verde
  "#eab308", // amarelo
  "#ec4899", // pink
  "#3b82f6", // azul
  "#ef4444", // vermelho
];

type PeriodFilter = "7" | "30" | "90" | "all";

// Função para abreviar textos longos
const abbreviateText = (text: string): string => {
  const abbreviations: Record<string, string> = {
    "Possui ambos (carro e moto).": "Ambos",
    "Sim, possuo moto.": "Moto",
    "Sim, possuo carro.": "Carro",
    "Não tenho veículo.": "Sem veículo",
    "Sim, possuo CNH": "Sim",
    "Não possuo CNH": "Não",
    "Trabalho registrado (CLT)": "CLT",
    "Trabalho como autônomo": "Autônomo",
    "Estou desempregado no momento": "Desempregado",
    "Sou estudante": "Estudante",
    "Tenho um negócio próprio": "Empresário",
    "Já trabalhei, mas não atualmente": "Experiência anterior",
    "Nunca trabalhei com vendas": "Sem experiência",
    "Trabalho com vendas": "Trabalho atual",
    "Tenho interesse em aprender": "Interesse",
    "Solteiro(a)": "Solteiro",
    "Casado(a)": "Casado",
    "Divorciado(a)": "Divorciado",
    "Namorando": "Namorando",
    "Viúvo(a)": "Viúvo",
    "União Estável": "União Estável",
    "R$ 1.000 a R$ 2.000": "1-2k",
    "R$ 2.000 a R$ 3.000": "2-3k",
    "R$ 3.000 a R$ 5.000": "3-5k",
    "R$ 5.000 a R$ 8.000": "5-8k",
    "R$ 8.000 a R$ 15.000": "8-15k",
    "Acima de R$ 15.000": "+15k",
    "Menos de R$ 1.000": "-1k",
    "Sim, já trabalho ou já trabalhei com proteção veicular.": "Sim",
    "Não, mas tenho interesse em conhecer.": "Interesse",
    "Não tenho interesse.": "Sem interesse",
  };

  return abbreviations[text] || (text.length > 15 ? text.substring(0, 12) + "..." : text);
};

const AdminAnalytics = () => {
  const [period, setPeriod] = useState<PeriodFilter>("30");

  const { data: currentUser } = useQuery({
    queryKey: ['current-user-analytics'],
    queryFn: getCurrentConsultant,
  });

  // Buscar submissões da tabela correta (quiz_submissions_new)
  const { data: allSubmissions, isLoading } = useQuery({
    queryKey: ["quiz-submissions-analytics", period, currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];

      let query = supabase
        .from("quiz_submissions_new")
        .select("*")
        .eq("organization_id", currentUser.organization_id);

      // Se não for super admin, filtrar apenas leads do consultor
      if (!isSuperAdmin(currentUser.role)) {
        query = query.eq("consultant_id", currentUser.id);
      }

      if (period !== "all") {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(period));
        query = query.gte("created_at", daysAgo.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!currentUser,
  });

  const stats = useMemo(() => {
    if (!allSubmissions) return { total: 0, completed: 0, rate: 0, abandoned: 0, abandonRate: 0 };
    const total = allSubmissions.length;
    const completed = allSubmissions.filter((s) => s.completion_percentage === 100).length;
    const abandoned = total - completed;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const abandonRate = total > 0 ? Math.round((abandoned / total) * 100) : 0;
    return { total, completed, rate, abandoned, abandonRate };
  }, [allSubmissions]);

  // Métricas adicionais
  const additionalMetrics = useMemo(() => {
    if (!allSubmissions) return { peakHour: '--', peakCount: 0, avgTime: '--', leadsToday: 0 };

    // Horário de pico
    const hourCounts: Record<number, number> = {};
    allSubmissions.forEach((sub) => {
      const hour = new Date(sub.created_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const peakEntry = Object.entries(hourCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
    const peakHour = peakEntry ? `${peakEntry[0]}h` : '--';
    const peakCount = peakEntry ? Number(peakEntry[1]) : 0;

    // Leads hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const leadsToday = allSubmissions.filter(s => new Date(s.created_at) >= today).length;

    // Tempo médio (estimativa baseada em updated_at - created_at para completos)
    const completedSubs = allSubmissions.filter(s => s.completion_percentage === 100);
    let avgTime = '--';
    if (completedSubs.length > 0) {
      const times = completedSubs.map(s => {
        const start = new Date(s.created_at).getTime();
        const end = new Date(s.updated_at).getTime();
        return (end - start) / 1000 / 60; // minutos
      }).filter(t => t > 0 && t < 60); // Filtrar tempos razoáveis (< 60 min)

      if (times.length > 0) {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        avgTime = `${Math.round(avg)} min`;
      }
    }

    return { peakHour, peakCount, avgTime, leadsToday };
  }, [allSubmissions]);

  // Agregar dados excluindo valores nulos
  const aggregateData = (field: string) => {
    if (!allSubmissions) return [];
    const counts: Record<string, number> = {};

    allSubmissions.forEach((sub: any) => {
      const value = sub[field];
      if (value !== null && value !== undefined && value !== "") {
        counts[value] = (counts[value] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([name, value]) => ({
        name,
        value,
        displayName: abbreviateText(name)
      }))
      .sort((a, b) => b.value - a.value);
  };

  const CustomTooltip = ({ active, payload, chartTotal }: any) => {
    if (active && payload && payload.length) {
      const percentage = chartTotal > 0 ? ((payload[0].value / chartTotal) * 100).toFixed(1) : 0;
      const originalName = payload[0].payload?.name || payload[0].name;
      return (
        <div
          className="bg-card/95 backdrop-blur-xl border border-primary/30 rounded-xl p-4 shadow-2xl"
          style={{
            zIndex: 9999,
            boxShadow: '0 25px 50px -12px rgba(249, 115, 22, 0.25), 0 0 30px rgba(249, 115, 22, 0.1)'
          }}
        >
          <p className="font-semibold text-foreground text-sm mb-2">{originalName}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
              {payload[0].value}
            </span>
            <span className="text-muted-foreground text-sm">respostas</span>
          </div>
          <div className="mt-2 pt-2 border-t border-border/50">
            <span className="text-xs text-muted-foreground">
              <span className="text-primary font-semibold">{percentage}%</span> do total
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderDonutChart = (
    data: { name: string; value: number; displayName: string }[],
    title: string,
    description: string
  ) => {
    const filteredData = data.filter(item => item.value > 0);
    const total = filteredData.reduce((acc, curr) => acc + curr.value, 0);

    return (
      <Card className="border-border/50 bg-card hover:border-primary/30 transition-all duration-300">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <CardTitle className="text-base sm:text-lg font-bold text-foreground">{title}</CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground">{description}</CardDescription>
        </CardHeader>

        <CardContent className="px-2 sm:px-4">
          {isLoading ? (
            <div className="h-[280px] sm:h-[300px] flex items-center justify-center">
              <Skeleton className="h-32 w-32 rounded-full" />
            </div>
          ) : filteredData.length === 0 ? (
            <div className="h-[280px] sm:h-[300px] flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Clock className="h-8 w-8 text-muted-foreground/50" />
              <span className="text-sm">Sem dados disponíveis</span>
            </div>
          ) : (
            <div className="relative">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={filteredData}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="displayName"
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                    animationBegin={0}
                    animationDuration={600}
                  >
                    {filteredData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                        className="cursor-pointer transition-opacity hover:opacity-80"
                      />
                    ))}
                  </Pie>

                  <Tooltip
                    content={<CustomTooltip chartTotal={total} />}
                    wrapperStyle={{ zIndex: 100 }}
                  />

                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    wrapperStyle={{
                      paddingTop: "8px",
                      fontSize: "11px"
                    }}
                    formatter={(value, entry: any) => {
                      const dataItem = entry.payload;
                      if (!dataItem || dataItem.value === 0) return null;
                      const percent = total > 0 ? ((dataItem.value / total) * 100).toFixed(0) : 0;
                      return (
                        <span className="text-foreground text-[10px] sm:text-xs">
                          {value} <span className="text-primary font-medium">({percent}%)</span>
                        </span>
                      );
                    }}
                    iconType="circle"
                    iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div
                className="absolute pointer-events-none"
                style={{
                  top: '135px',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center'
                }}
              >
                <div className="text-2xl sm:text-3xl font-bold text-primary" style={{ lineHeight: 1 }}>
                  {total}
                </div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider" style={{ marginTop: '4px' }}>
                  respostas
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const relationshipData = aggregateData("relationship_status");
  const vehicleData = aggregateData("has_vehicle");
  const licenseData = aggregateData("has_driver_license");
  const employmentData = aggregateData("employment_status");
  const salesExpData = aggregateData("sales_experience");
  const protectionExpData = aggregateData("vehicle_protection_experience");
  const currentIncomeData = aggregateData("current_income");
  const desiredIncomeData = aggregateData("desired_income");

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6 overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 animate-fade-in">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              Analytics
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">
              Estatísticas detalhadas das respostas do quiz
            </p>
          </div>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
            <SelectTrigger className="w-full sm:w-[180px] border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-colors">
              <SelectValue placeholder="Selecionar período" />
            </SelectTrigger>
            <SelectContent className="bg-card/95 backdrop-blur-xl border-border/50">
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="all">Todo o período</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Métricas Adicionais - Nova Linha */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 animate-fade-in" style={{ animationDelay: "50ms" }}>
          <Card className="group relative overflow-hidden border-border/30 bg-gradient-to-br from-card via-card to-card/80 hover:border-red-500/40 transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="p-4 sm:p-6 relative z-10">
              <div className="flex flex-col gap-3">
                <div className="p-2.5 sm:p-3 bg-gradient-to-br from-red-500/20 to-red-500/5 rounded-xl w-fit border border-red-500/20">
                  <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-500" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">Taxa Abandono</p>
                  <p className="text-2xl sm:text-3xl font-black text-foreground mt-1">{stats.abandonRate}%</p>
                  <p className="text-xs text-muted-foreground">{stats.abandoned} leads</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-border/30 bg-gradient-to-br from-card via-card to-card/80 hover:border-purple-500/40 transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="p-4 sm:p-6 relative z-10">
              <div className="flex flex-col gap-3">
                <div className="p-2.5 sm:p-3 bg-gradient-to-br from-purple-500/20 to-purple-500/5 rounded-xl w-fit border border-purple-500/20">
                  <Timer className="h-5 w-5 sm:h-6 sm:w-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">Tempo Médio</p>
                  <p className="text-2xl sm:text-3xl font-black text-foreground mt-1">{additionalMetrics.avgTime}</p>
                  <p className="text-xs text-muted-foreground">conclusão</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-border/30 bg-gradient-to-br from-card via-card to-card/80 hover:border-emerald-500/40 transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="p-4 sm:p-6 relative z-10">
              <div className="flex flex-col gap-3">
                <div className="p-2.5 sm:p-3 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 rounded-xl w-fit border border-emerald-500/20">
                  <CalendarDays className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">Leads Hoje</p>
                  <p className="text-2xl sm:text-3xl font-black text-foreground mt-1">{additionalMetrics.leadsToday}</p>
                  <p className="text-xs text-muted-foreground">novos leads</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" style={{ animationDelay: "100ms" }}>
          <Card className="group relative overflow-hidden border-border/30 bg-gradient-to-br from-card via-card to-card/80 hover:border-primary/40 transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="p-4 sm:p-6 relative z-10">
              <div className="flex flex-col gap-3">
                <div className="p-2.5 sm:p-3 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl w-fit border border-primary/20">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Leads</p>
                  <p className="text-2xl sm:text-3xl font-black text-foreground mt-1">{isLoading ? "..." : stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-border/30 bg-gradient-to-br from-card via-card to-card/80 hover:border-green-500/40 transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="p-4 sm:p-6 relative z-10">
              <div className="flex flex-col gap-3">
                <div className="p-2.5 sm:p-3 bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-xl w-fit border border-green-500/20">
                  <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">Completos</p>
                  <p className="text-2xl sm:text-3xl font-black text-foreground mt-1">{isLoading ? "..." : stats.completed}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-border/30 bg-gradient-to-br from-card via-card to-card/80 hover:border-yellow-500/40 transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="p-4 sm:p-6 relative z-10">
              <div className="flex flex-col gap-3">
                <div className="p-2.5 sm:p-3 bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 rounded-xl w-fit border border-yellow-500/20">
                  <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">Incompletos</p>
                  <p className="text-2xl sm:text-3xl font-black text-foreground mt-1">{isLoading ? "..." : stats.total - stats.completed}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-border/30 bg-gradient-to-br from-card via-card to-card/80 hover:border-primary/40 transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="p-4 sm:p-6 relative z-10">
              <div className="flex flex-col gap-3">
                <div className="p-2.5 sm:p-3 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl w-fit border border-primary/20">
                  <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">Taxa Conclusão</p>
                  <p className="text-2xl sm:text-3xl font-black text-primary mt-1">{isLoading ? "..." : `${stats.rate}%`}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Temporal Evolution Chart */}
        <div className="animate-fade-in" style={{ animationDelay: "150ms" }}>
          <TemporalChart
            submissions={allSubmissions}
            isLoading={isLoading}
            days={period === "7" ? 7 : period === "30" ? 30 : period === "90" ? 90 : 30}
          />
        </div>

        {/* Conversion Funnel */}
        <div className="animate-fade-in" style={{ animationDelay: "200ms" }}>
          <ConversionFunnel submissions={allSubmissions} isLoading={isLoading} />
        </div>

        {/* Charts Grid - Todos os gráficos de respostas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="animate-fade-in" style={{ animationDelay: "250ms" }}>
            {renderDonutChart(relationshipData, "Estado Civil", "Distribuição por estado civil")}
          </div>
          <div className="animate-fade-in" style={{ animationDelay: "300ms" }}>
            {renderDonutChart(vehicleData, "Possui Veículo", "Leads com veículo próprio")}
          </div>
          <div className="animate-fade-in" style={{ animationDelay: "350ms" }}>
            {renderDonutChart(licenseData, "Possui CNH", "Carteira de motorista")}
          </div>
          <div className="animate-fade-in" style={{ animationDelay: "400ms" }}>
            {renderDonutChart(employmentData, "Situação Profissional", "Distribuição por emprego")}
          </div>
          <div className="animate-fade-in" style={{ animationDelay: "450ms" }}>
            {renderDonutChart(salesExpData, "Experiência com Vendas", "Experiência em vendas")}
          </div>
          <div className="animate-fade-in" style={{ animationDelay: "500ms" }}>
            {renderDonutChart(protectionExpData, "Exp. Proteção Veicular", "Experiência no ramo")}
          </div>
          <div className="animate-fade-in" style={{ animationDelay: "550ms" }}>
            {renderDonutChart(currentIncomeData, "Faixa de Ganhos Atual", "Renda atual")}
          </div>
          <div className="animate-fade-in" style={{ animationDelay: "600ms" }}>
            {renderDonutChart(desiredIncomeData, "Ganhos Desejados", "Expectativa de ganhos")}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAnalytics;
