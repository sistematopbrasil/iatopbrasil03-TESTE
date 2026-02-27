import { useState, useEffect, useRef } from "react";
import { useInstagramProfiles } from "@/hooks/useInstagramProfiles";
import { useInstagramMetrics } from "@/hooks/useInstagramMetrics";
import { useInstagramUpdate } from "@/hooks/useInstagramUpdate";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { UsersRound, TrendingUp, RefreshCw, Award, ArrowUp, ArrowDown, Sparkles } from "lucide-react";
import { formatNumber, formatChange, getLatestMetric } from "@/lib/instagram-utils";
import { InstagramProfileCard } from "./InstagramProfileCard";
import { InstagramProfileDetail } from "./InstagramProfileDetail";
import { LastUpdatedBadge } from "./LastUpdatedBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { DatePeriodFilter, filterMetricsByDatePeriod, type DatePeriodValue } from "./DatePeriodFilter";
import { startOfDay, subDays } from "date-fns";

function AnimatedNumber({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | null>(null);
  
  useEffect(() => {
    const start = ref.current ?? 0;
    const diff = value - start;
    if (diff === 0) { setDisplay(value); return; }
    const startTime = performance.now();
    
    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + diff * eased);
      setDisplay(current);
      if (progress < 1) requestAnimationFrame(tick);
      else ref.current = value;
    }
    requestAnimationFrame(tick);
    return () => { ref.current = value; };
  }, [value, duration]);
  
  return <>{display.toLocaleString("pt-BR")}</>;
}

export function InstagramDashboard() {
  const { data: profiles, isLoading: loadingProfiles } = useInstagramProfiles();
  const { data: allMetrics, isLoading: loadingMetrics } = useInstagramMetrics();
  const { updateAll } = useInstagramUpdate();
  const [datePeriod, setDatePeriod] = useState<DatePeriodValue>({
    preset: "7d",
    from: subDays(startOfDay(new Date()), 6),
    to: startOfDay(new Date()),
  });
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const isLoading = loadingProfiles || loadingMetrics;
  const activeProfiles = profiles?.filter(p => p.is_active) || [];
  const filteredAllMetrics = filterMetricsByDatePeriod(allMetrics || [], datePeriod);
  const selectedProfile = activeProfiles.find(p => p.id === selectedProfileId);

  const totalFollowers = activeProfiles.reduce((sum, p) => {
    const metrics = allMetrics?.filter(m => m.profile_id === p.id) || [];
    const latest = getLatestMetric(metrics);
    return sum + (latest?.follower_count || 0);
  }, 0);

  // ✅ Seguidores ganhos no período (soma de daily_change)
  const totalGainedInPeriod = filteredAllMetrics.reduce((sum, m) => sum + (m.daily_change || 0), 0);

  const bestProfile = activeProfiles.reduce<{ profile: any; change: number } | null>((best, p) => {
    const metrics = filteredAllMetrics.filter(m => m.profile_id === p.id);
    const totalChange = metrics.reduce((s, m) => s + (m.daily_change || 0), 0);
    if (!best || totalChange > best.change) return { profile: p, change: totalChange };
    return best;
  }, null);

  const lastUpdate = allMetrics?.length
    ? allMetrics.reduce((latest, m) => m.recorded_at > latest ? m.recorded_at : latest, allMetrics[0].recorded_at)
    : null;

  const sortedProfiles = [...activeProfiles].sort((a, b) => {
    const aMetrics = filteredAllMetrics.filter(m => m.profile_id === a.id);
    const bMetrics = filteredAllMetrics.filter(m => m.profile_id === b.id);
    const aChange = aMetrics.reduce((s, m) => s + (m.daily_change || 0), 0);
    const bChange = bMetrics.reduce((s, m) => s + (m.daily_change || 0), 0);
    return bChange - aChange;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-2xl border border-border/50 p-6 bg-card">
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={() => updateAll.mutate({})} disabled={updateAll.isPending} size="sm"
          className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md hover:shadow-lg transition-all duration-300">
          <RefreshCw className={`h-4 w-4 mr-2 ${updateAll.isPending ? "animate-spin" : ""}`} />
          Atualizar Todos
        </Button>
        <DatePeriodFilter value={datePeriod} onChange={setDatePeriod} />
        {lastUpdate && (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <LastUpdatedBadge date={lastUpdate} />
          </div>
        )}
      </div>

      {/* Stat Cards with gradients */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Perfis Ativos */}
        <div className="group relative overflow-hidden rounded-2xl border border-border/50 p-6 bg-gradient-to-br from-card to-card/80 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-8 translate-x-8 group-hover:scale-150 transition-transform duration-500" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Perfis Ativos</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 group-hover:scale-110 transition-transform">
                <UsersRound className="h-5 w-5 text-primary" />
              </div>
            </div>
            <p className="text-3xl font-bold tracking-tight">
              <AnimatedNumber value={activeProfiles.length} />
            </p>
          </div>
        </div>

        {/* Total Seguidores */}
        <div className="group relative overflow-hidden rounded-2xl border border-border/50 p-6 bg-gradient-to-br from-card to-card/80 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -translate-y-8 translate-x-8 group-hover:scale-150 transition-transform duration-500" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Total Seguidores</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 group-hover:scale-110 transition-transform">
                <UsersRound className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            <p className="text-3xl font-bold tracking-tight">
              <AnimatedNumber value={totalFollowers} />
            </p>
          </div>
        </div>

        {/* Seguidores Ganhos no Período */}
        <div className={`group relative overflow-hidden rounded-2xl border p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ${
          totalGainedInPeriod >= 0 
            ? "border-green-500/20 bg-gradient-to-br from-green-500/5 to-green-500/10" 
            : "border-red-500/20 bg-gradient-to-br from-red-500/5 to-red-500/10"
        }`}>
          <div className={`absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-8 translate-x-8 group-hover:scale-150 transition-transform duration-500 ${
            totalGainedInPeriod >= 0 ? "bg-green-500/10" : "bg-red-500/10"
          }`} />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Seguidores Ganhos</p>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl group-hover:scale-110 transition-transform ${
                totalGainedInPeriod >= 0 ? "bg-green-500/10" : "bg-red-500/10"
              }`}>
                {totalGainedInPeriod >= 0 
                  ? <TrendingUp className="h-5 w-5 text-green-500" />
                  : <ArrowDown className="h-5 w-5 text-red-500" />
                }
              </div>
            </div>
            <div className="flex items-center gap-2">
              {totalGainedInPeriod >= 0 
                ? <ArrowUp className="h-5 w-5 text-green-500" />
                : <ArrowDown className="h-5 w-5 text-red-500" />
              }
              <p className={`text-3xl font-bold tracking-tight ${
                totalGainedInPeriod >= 0 ? "text-green-500" : "text-red-500"
              }`}>
                {formatChange(totalGainedInPeriod)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">no período selecionado</p>
          </div>
        </div>

        {/* Melhor Perfil */}
        <div className="group relative overflow-hidden rounded-2xl border border-amber-500/20 p-6 bg-gradient-to-br from-amber-500/5 to-orange-500/10 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full -translate-y-8 translate-x-8 group-hover:scale-150 transition-transform duration-500" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Melhor Perfil</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 group-hover:scale-110 transition-transform">
                <Award className="h-5 w-5 text-amber-500" />
              </div>
            </div>
            <p className="text-lg font-bold truncate">
              {bestProfile ? `@${bestProfile.profile.username}` : "—"}
            </p>
            {bestProfile && (
              <p className="text-sm font-medium text-green-500 mt-1 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                {formatChange(bestProfile.change)} no período
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Perfis Monitorados */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          Perfis Monitorados
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-normal">
            {sortedProfiles.length}
          </span>
        </h3>
        {sortedProfiles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/50 p-12 text-center text-muted-foreground bg-card/50">
            <UsersRound className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum perfil cadastrado. Adicione perfis na aba "Perfis".</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedProfiles.map((profile, index) => {
              const profileFilteredMetrics = filteredAllMetrics.filter(m => m.profile_id === profile.id);
              const periodChange = profileFilteredMetrics.reduce((s, m) => s + (m.daily_change || 0), 0);
              return (
                <InstagramProfileCard
                  key={profile.id}
                  profile={profile}
                  metrics={allMetrics?.filter(m => m.profile_id === profile.id) || []}
                  periodChange={periodChange}
                  onClick={() => setSelectedProfileId(profile.id)}
                  rank={index + 1}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Profile Detail Sheet */}
      <Sheet open={!!selectedProfile} onOpenChange={(open) => !open && setSelectedProfileId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {selectedProfile && (
            <InstagramProfileDetail profile={selectedProfile} onClose={() => setSelectedProfileId(null)} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
