import { useState } from "react";
import { useInstagramProfiles } from "@/hooks/useInstagramProfiles";
import { useInstagramMetrics } from "@/hooks/useInstagramMetrics";
import { useInstagramUpdate } from "@/hooks/useInstagramUpdate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { UsersRound, Zap, RefreshCw, Award, ArrowUp, ArrowDown } from "lucide-react";
import { formatNumber, formatChange, getLatestMetric } from "@/lib/instagram-utils";
import { InstagramProfileCard } from "./InstagramProfileCard";
import { InstagramProfileDetail } from "./InstagramProfileDetail";
import { LastUpdatedBadge } from "./LastUpdatedBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { DatePeriodFilter, filterMetricsByDatePeriod, type DatePeriodValue } from "./DatePeriodFilter";
import { startOfDay, subDays } from "date-fns";

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

  const avgGrowth = activeProfiles.length > 0
    ? activeProfiles.reduce((sum, p) => {
        const metrics = filteredAllMetrics.filter(m => m.profile_id === p.id);
        if (metrics.length === 0) return sum;
        const avg = metrics.reduce((s, m) => s + (m.daily_change || 0), 0) / metrics.length;
        return sum + avg;
      }, 0) / activeProfiles.length
    : 0;

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
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={() => updateAll.mutate({})} disabled={updateAll.isPending} size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${updateAll.isPending ? "animate-spin" : ""}`} />
          Atualizar Todos
        </Button>
        <DatePeriodFilter value={datePeriod} onChange={setDatePeriod} />
        {lastUpdate && <LastUpdatedBadge date={lastUpdate} />}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Perfis Ativos</CardTitle>
            <UsersRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{activeProfiles.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Seguidores</CardTitle>
            <UsersRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatNumber(totalFollowers)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Média Crescimento/Dia</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              {avgGrowth >= 0 ? <ArrowUp className="h-4 w-4 text-green-500" /> : <ArrowDown className="h-4 w-4 text-red-500" />}
              {formatChange(Math.round(avgGrowth))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Melhor Perfil</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">
              {bestProfile ? `@${bestProfile.profile.username}` : "—"}
            </div>
            {bestProfile && (
              <p className="text-xs text-green-500">{formatChange(bestProfile.change)} no período</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Perfis Monitorados</h3>
        {sortedProfiles.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Nenhum perfil cadastrado. Adicione perfis na aba "Perfis".
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedProfiles.map(profile => {
              const profileFilteredMetrics = filteredAllMetrics.filter(m => m.profile_id === profile.id);
              const periodChange = profileFilteredMetrics.reduce((s, m) => s + (m.daily_change || 0), 0);
              return (
                <InstagramProfileCard
                  key={profile.id}
                  profile={profile}
                  metrics={allMetrics?.filter(m => m.profile_id === profile.id) || []}
                  periodChange={periodChange}
                  onClick={() => setSelectedProfileId(profile.id)}
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
