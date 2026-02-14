import { useInstagramProfiles } from "@/hooks/useInstagramProfiles";
import { useInstagramMetrics } from "@/hooks/useInstagramMetrics";
import { useInstagramUpdate } from "@/hooks/useInstagramUpdate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, TrendingUp, RefreshCw, Award, ArrowUp, ArrowDown } from "lucide-react";
import { formatNumber, formatChange, getLatestMetric, calculateAverage } from "@/lib/instagram-utils";
import { InstagramProfileCard } from "./InstagramProfileCard";
import { LastUpdatedBadge } from "./LastUpdatedBadge";
import { Skeleton } from "@/components/ui/skeleton";

export function InstagramDashboard() {
  const { data: profiles, isLoading: loadingProfiles } = useInstagramProfiles();
  const { data: allMetrics, isLoading: loadingMetrics } = useInstagramMetrics();
  const { updateAll } = useInstagramUpdate();

  const isLoading = loadingProfiles || loadingMetrics;

  // Calculate summary stats
  const activeProfiles = profiles?.filter(p => p.is_active) || [];
  const totalFollowers = activeProfiles.reduce((sum, p) => {
    const metrics = allMetrics?.filter(m => m.profile_id === p.id) || [];
    const latest = getLatestMetric(metrics);
    return sum + (latest?.follower_count || 0);
  }, 0);

  const avgGrowth = activeProfiles.length > 0
    ? activeProfiles.reduce((sum, p) => {
        const metrics = allMetrics?.filter(m => m.profile_id === p.id) || [];
        return sum + calculateAverage(metrics, "daily_change", 7);
      }, 0) / activeProfiles.length
    : 0;

  // Best profile by daily change
  const bestProfile = activeProfiles.reduce<{ profile: any; change: number } | null>((best, p) => {
    const metrics = allMetrics?.filter(m => m.profile_id === p.id) || [];
    const latest = getLatestMetric(metrics);
    const change = latest?.daily_change || 0;
    if (!best || change > best.change) return { profile: p, change };
    return best;
  }, null);

  // Last update time
  const lastUpdate = allMetrics?.length
    ? allMetrics.reduce((latest, m) => m.recorded_at > latest ? m.recorded_at : latest, allMetrics[0].recorded_at)
    : null;

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
      {/* Header actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          onClick={() => updateAll.mutate({})}
          disabled={updateAll.isPending}
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${updateAll.isPending ? "animate-spin" : ""}`} />
          Atualizar Todos
        </Button>
        {lastUpdate && <LastUpdatedBadge date={lastUpdate} />}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Perfis Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeProfiles.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Seguidores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalFollowers)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Média Crescimento/Dia</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
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
              <p className="text-xs text-green-500">{formatChange(bestProfile.change)} hoje</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Profile Cards Grid */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Perfis Monitorados</h3>
        {activeProfiles.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Nenhum perfil cadastrado. Adicione perfis na aba "Perfis".
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeProfiles.map(profile => (
              <InstagramProfileCard
                key={profile.id}
                profile={profile}
                metrics={allMetrics?.filter(m => m.profile_id === profile.id) || []}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
