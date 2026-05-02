import { useState } from "react";
import { useInstagramProfiles } from "@/hooks/useInstagramProfiles";
import { useInstagramUpdate } from "@/hooks/useInstagramUpdate";
import { useInstagramMetrics } from "@/hooks/useInstagramMetrics";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUp, ArrowDown, ExternalLink, RefreshCw, UserCircle } from "lucide-react";
import {
  formatNumber, formatChange, getLatestMetric, calculateTotal, getYesterdayMetric, filterMetricsByPeriod,
} from "@/lib/instagram-utils";
import { format, subDays } from "date-fns";
import { GrowthAreaChart } from "./GrowthAreaChart";
import { DailyChangeBarChart } from "./DailyChangeBarChart";
import { DailyMetricsTable } from "./DailyMetricsTable";
import { LastUpdatedBadge } from "./LastUpdatedBadge";

export function ConsultantSingleProfileView() {
  const { data: profiles, isLoading } = useInstagramProfiles();
  const { updateAll } = useInstagramUpdate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>("30");

  const activeProfiles = (profiles || []).filter(p => p.is_active);
  const list = activeProfiles.length > 0 ? activeProfiles : (profiles || []);
  const profile = list.find(p => p.id === selectedId) || list[0];

  const { data: metrics } = useInstagramMetrics(profile?.id);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-24 rounded-lg bg-muted animate-pulse" />
        <div className="h-48 rounded-lg bg-muted animate-pulse" />
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="p-10 text-center space-y-3">
          <UserCircle className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Nenhum perfil do Instagram vinculado.</p>
          <p className="text-xs text-muted-foreground">Solicite ao administrador a inclusão do seu @ para começar a acompanhar seu crescimento.</p>
        </CardContent>
      </Card>
    );
  }

  const latest = getLatestMetric(metrics || []);
  const yesterday = getYesterdayMetric(metrics || []);

  let filteredMetrics = metrics || [];
  if (period === "yesterday") {
    const y = format(subDays(new Date(), 1), "yyyy-MM-dd");
    filteredMetrics = (metrics || []).filter(m => m.recorded_date === y);
  } else if (period !== "all") {
    filteredMetrics = filterMetricsByPeriod(metrics || [], parseInt(period));
  }

  const total7 = calculateTotal(metrics || [], "daily_change", 7);
  const total30 = calculateTotal(metrics || [], "daily_change", 30);

  return (
    <div className="space-y-6">
      {/* Multi-profile selector (chips) — só aparece quando há mais de um */}
      {list.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {list.map(p => (
            <Button
              key={p.id}
              size="sm"
              variant={p.id === profile.id ? "default" : "outline"}
              onClick={() => setSelectedId(p.id)}
              className="h-8"
            >
              @{p.username}
            </Button>
          ))}
        </div>
      )}

      {/* Header do perfil */}
      <div className="flex items-start gap-4">
        <Avatar className="h-16 w-16 ring-2 ring-border/40">
          <AvatarImage src={profile.profile_picture || undefined} />
          <AvatarFallback className="text-xl bg-primary/10 text-primary">
            {profile.username[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold truncate">@{profile.username}</h2>
          {profile.display_name && (
            <p className="text-muted-foreground truncate">{profile.display_name}</p>
          )}
          <div className="flex gap-2 mt-2 flex-wrap">
            {profile.category && <Badge variant="secondary">{profile.category}</Badge>}
            <Badge variant={profile.is_active ? "default" : "outline"}>
              {profile.is_active ? "Ativo" : "Arquivado"}
            </Badge>
            {latest && <LastUpdatedBadge date={latest.recorded_at} />}
          </div>
        </div>
      </div>

      {/* Ações disponíveis ao consultor */}
      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          onClick={() => updateAll.mutate({ profileId: profile.id })}
          disabled={updateAll.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${updateAll.isPending ? "animate-spin" : ""}`} />
          Atualizar agora
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open(`https://instagram.com/${profile.username}`, "_blank")}
        >
          <ExternalLink className="h-4 w-4 mr-1" />
          Ver no Instagram
        </Button>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Seguidores</p>
            <p className="text-xl font-bold tabular-nums">{formatNumber(latest?.follower_count || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Hoje</p>
            <p className={`text-xl font-bold tabular-nums flex items-center gap-1 ${
              (latest?.daily_change || 0) > 0 ? "text-green-500" : (latest?.daily_change || 0) < 0 ? "text-red-500" : ""
            }`}>
              {(latest?.daily_change || 0) > 0 ? <ArrowUp className="h-4 w-4" /> : (latest?.daily_change || 0) < 0 ? <ArrowDown className="h-4 w-4" /> : null}
              {formatChange(latest?.daily_change || 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total 7 dias</p>
            <p className="text-xl font-bold tabular-nums">{formatChange(total7)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total 30 dias</p>
            <p className="text-xl font-bold tabular-nums">{formatChange(total30)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Seletor de período */}
      <div className="flex gap-2 flex-wrap">
        {[{ label: "Ontem", value: "yesterday" }, { label: "7 dias", value: "7" }, { label: "30 dias", value: "30" }, { label: "90 dias", value: "90" }, { label: "Tudo", value: "all" }].map(p => (
          <Button
            key={p.value}
            variant={period === p.value ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod(p.value)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Gráficos / histórico */}
      <Tabs defaultValue="growth">
        <TabsList>
          <TabsTrigger value="growth">Crescimento</TabsTrigger>
          <TabsTrigger value="daily">Diário</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="growth" className="mt-4">
          <GrowthAreaChart metrics={filteredMetrics} />
        </TabsContent>
        <TabsContent value="daily" className="mt-4">
          <DailyChangeBarChart metrics={filteredMetrics} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <DailyMetricsTable metrics={filteredMetrics} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
