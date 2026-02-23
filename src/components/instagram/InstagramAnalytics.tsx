import { useState } from "react";
import { useInstagramProfiles } from "@/hooks/useInstagramProfiles";
import { useInstagramMetrics } from "@/hooks/useInstagramMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ArrowUp, ArrowDown, Trophy } from "lucide-react";
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Seguidores</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatNumber(totalFollowers)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Crescimento no Período</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totalGrowth >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatChange(totalGrowth)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Média/Dia</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatChange(avgTotal)}/dia</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Ranking de Crescimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ranking.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Nenhum perfil para exibir.</p>
          ) : (
            <div className="space-y-3">
              {ranking.map((item, index) => (
                <div
                  key={item.profile.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedProfileId(item.profile.id)}
                >
                  <span className="text-lg font-bold w-8 text-center shrink-0">{getMedal(index)}</span>
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={item.profile.profile_picture || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {item.profile.username[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">@{item.profile.username}</p>
                    <p className="text-xs text-muted-foreground">{formatNumber(item.followers)} seguidores</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`flex items-center gap-1 text-sm font-medium ${
                      item.totalChange > 0 ? "text-green-500" : item.totalChange < 0 ? "text-red-500" : "text-muted-foreground"
                    }`}>
                      {item.totalChange > 0 ? <ArrowUp className="h-3 w-3" /> : item.totalChange < 0 ? <ArrowDown className="h-3 w-3" /> : null}
                      {formatChange(item.totalChange)}
                    </div>
                    <p className="text-xs text-muted-foreground">média {formatChange(item.avgChange)}/dia</p>
                  </div>
                  {item.sparkline.length > 1 && (
                    <MiniSparkline data={item.sparkline} width={60} height={24} />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
