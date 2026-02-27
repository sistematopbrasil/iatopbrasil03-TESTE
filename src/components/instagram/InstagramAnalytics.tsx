import { useState } from "react";
import { useInstagramProfiles } from "@/hooks/useInstagramProfiles";
import { useInstagramMetrics } from "@/hooks/useInstagramMetrics";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ArrowUp, ArrowDown, Trophy, TrendingUp, Users, BarChart3 } from "lucide-react";
import { formatNumber, formatChange, getLatestMetric } from "@/lib/instagram-utils";
import { MiniSparkline } from "./MiniSparkline";
import { InstagramProfileDetail } from "./InstagramProfileDetail";
import { DatePeriodFilter, filterMetricsByDatePeriod, type DatePeriodValue } from "./DatePeriodFilter";
import { startOfDay, subDays } from "date-fns";

export function InstagramAnalytics() {
  const { data: profiles } = useInstagramProfiles();
  const { data: allMetrics } = useInstagramMetrics();
  const [datePeriod, setDatePeriod] = useState<DatePeriodValue>({
    preset: "7d",
    from: subDays(startOfDay(new Date()), 6),
    to: startOfDay(new Date()),
  });
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const activeProfiles = profiles?.filter(p => p.is_active) || [];
  const filteredMetrics = filterMetricsByDatePeriod(allMetrics || [], datePeriod);
  const selectedProfile = activeProfiles.find(p => p.id === selectedProfileId);

  const ranking = activeProfiles
    .map(p => {
      const metrics = filteredMetrics.filter(m => m.profile_id === p.id);
      const allProfileMetrics = allMetrics?.filter(m => m.profile_id === p.id) || [];
      const latest = getLatestMetric(allProfileMetrics);
      const totalChange = metrics.reduce((s, m) => s + (m.daily_change || 0), 0);
      const avgChange = metrics.length > 0 ? Math.round(totalChange / metrics.length) : 0;
      const sparkline = allProfileMetrics.slice(0, 14).reverse().map(m => m.follower_count);

      return { profile: p, followers: latest?.follower_count || 0, totalChange, avgChange, sparkline };
    })
    .sort((a, b) => b.totalChange - a.totalChange);

  const totalFollowers = ranking.reduce((s, r) => s + r.followers, 0);
  const totalGrowth = ranking.reduce((s, r) => s + r.totalChange, 0);
  const avgTotal = ranking.length > 0
    ? Math.round(ranking.reduce((s, r) => s + r.avgChange, 0) / ranking.length)
    : 0;

  const getMedal = (pos: number) => {
    if (pos === 0) return "🥇";
    if (pos === 1) return "🥈";
    if (pos === 2) return "🥉";
    return `${pos + 1}º`;
  };

  return (
    <div className="space-y-6">
      <DatePeriodFilter value={datePeriod} onChange={setDatePeriod} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="group relative overflow-hidden rounded-2xl border border-border/50 p-6 bg-gradient-to-br from-card to-card/80 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-full -translate-y-6 translate-x-6 group-hover:scale-150 transition-transform duration-500" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-blue-500" />
              <p className="text-sm text-muted-foreground">Total Seguidores</p>
            </div>
            <p className="text-2xl font-bold">{formatNumber(totalFollowers)}</p>
          </div>
        </div>
        
        <div className={`group relative overflow-hidden rounded-2xl border p-6 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 ${
          totalGrowth >= 0 ? "border-green-500/20 bg-gradient-to-br from-green-500/5 to-green-500/10" : "border-red-500/20 bg-gradient-to-br from-red-500/5 to-red-500/10"
        }`}>
          <div className={`absolute top-0 right-0 w-20 h-20 rounded-full -translate-y-6 translate-x-6 group-hover:scale-150 transition-transform duration-500 ${
            totalGrowth >= 0 ? "bg-green-500/10" : "bg-red-500/10"
          }`} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <p className="text-sm text-muted-foreground">Crescimento no Período</p>
            </div>
            <p className={`text-2xl font-bold ${totalGrowth >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatChange(totalGrowth)}
            </p>
          </div>
        </div>
        
        <div className="group relative overflow-hidden rounded-2xl border border-border/50 p-6 bg-gradient-to-br from-card to-card/80 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
          <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/5 rounded-full -translate-y-6 translate-x-6 group-hover:scale-150 transition-transform duration-500" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-purple-500" />
              <p className="text-sm text-muted-foreground">Média/Dia</p>
            </div>
            <p className="text-2xl font-bold">{formatChange(avgTotal)}/dia</p>
          </div>
        </div>
      </div>

      {/* Ranking */}
      <div className="rounded-2xl border border-border/50 overflow-hidden bg-card">
        <div className="p-6 pb-4 border-b border-border/30 bg-gradient-to-r from-amber-500/5 to-orange-500/5">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Ranking de Crescimento
          </h3>
        </div>
        <div className="p-4">
          {ranking.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum perfil para exibir.</p>
          ) : (
            <div className="space-y-2">
              {ranking.map((item, index) => (
                <div
                  key={item.profile.id}
                  className={`group flex items-center gap-3 p-3 rounded-xl transition-all duration-300 cursor-pointer hover:-translate-x-1 ${
                    index === 0 ? "bg-gradient-to-r from-amber-500/10 to-transparent hover:from-amber-500/15" :
                    index === 1 ? "bg-gradient-to-r from-slate-400/10 to-transparent hover:from-slate-400/15" :
                    index === 2 ? "bg-gradient-to-r from-orange-600/10 to-transparent hover:from-orange-600/15" :
                    "hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedProfileId(item.profile.id)}
                >
                  <span className="text-lg font-bold w-8 text-center shrink-0">{getMedal(index)}</span>
                  <Avatar className="h-10 w-10 shrink-0 ring-2 ring-border/30 group-hover:ring-primary/30 transition-all">
                    <AvatarImage src={item.profile.profile_picture || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {item.profile.username[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">@{item.profile.username}</p>
                    <p className="text-xs text-muted-foreground truncate">{formatNumber(item.followers)} seguidores</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`flex items-center justify-end gap-1 text-sm font-semibold ${
                      item.totalChange > 0 ? "text-green-500" : item.totalChange < 0 ? "text-red-500" : "text-muted-foreground"
                    }`}>
                      {item.totalChange > 0 ? <ArrowUp className="h-3 w-3" /> : item.totalChange < 0 ? <ArrowDown className="h-3 w-3" /> : null}
                      {formatChange(item.totalChange)}
                    </div>
                    <p className="text-xs text-muted-foreground">média {formatChange(item.avgChange)}/dia</p>
                  </div>
                  {item.sparkline.length > 1 && (
                    <div className="hidden sm:block shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
                      <MiniSparkline data={item.sparkline} width={60} height={24} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
