import { useState } from "react";
import { useInstagramMetrics } from "@/hooks/useInstagramMetrics";
import { useInstagramUpdate } from "@/hooks/useInstagramUpdate";
import { useInstagramProfiles } from "@/hooks/useInstagramProfiles";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUp, ArrowDown, ArrowLeft, ExternalLink, RefreshCw, Trash2, Archive, Pencil } from "lucide-react";
import { formatNumber, formatChange, formatPercentage, getLatestMetric, calculateAverage, filterMetricsByPeriod, type InstaProfile } from "@/lib/instagram-utils";
import { GrowthAreaChart } from "./GrowthAreaChart";
import { DailyChangeBarChart } from "./DailyChangeBarChart";
import { DailyMetricsTable } from "./DailyMetricsTable";
import { LastUpdatedBadge } from "./LastUpdatedBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EditProfileDialog } from "./EditProfileDialog";

interface Props {
  profile: InstaProfile;
  onClose: () => void;
}

export function InstagramProfileDetail({ profile, onClose }: Props) {
  const { data: metrics } = useInstagramMetrics(profile.id);
  const { updateAll } = useInstagramUpdate();
  const { updateProfile, deleteProfile } = useInstagramProfiles();
  const [period, setPeriod] = useState<string>("30");
  const [editOpen, setEditOpen] = useState(false);

  const latest = getLatestMetric(metrics || []);
  const periodDays = period === "all" ? null : parseInt(period);
  const filteredMetrics = filterMetricsByPeriod(metrics || [], periodDays);

  const avg7 = calculateAverage(metrics || [], "daily_change", 7);
  const avg30 = calculateAverage(metrics || [], "daily_change", 30);

  return (
    <div className="p-6 space-y-6">
      {/* Back Button */}
      <Button variant="ghost" size="sm" onClick={onClose} className="-ml-2 -mt-2 mb-2">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Voltar
      </Button>

      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={profile.profile_picture || undefined} />
          <AvatarFallback className="text-xl bg-primary/10 text-primary">
            {profile.username[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold">@{profile.username}</h2>
          {profile.display_name && (
            <p className="text-muted-foreground">{profile.display_name}</p>
          )}
          <div className="flex gap-2 mt-2 flex-wrap">
            {profile.category && <Badge variant="secondary">{profile.category}</Badge>}
            <Badge variant={profile.is_active ? "default" : "outline"}>
              {profile.is_active ? "Ativo" : "Arquivado"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4 mr-1" />
          Editar
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => updateAll.mutate({ profileId: profile.id })}
          disabled={updateAll.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${updateAll.isPending ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open(`https://instagram.com/${profile.username}`, "_blank")}
        >
          <ExternalLink className="h-4 w-4 mr-1" />
          Ver no Instagram
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => updateProfile.mutate({ id: profile.id, is_active: !profile.is_active })}
        >
          <Archive className="h-4 w-4 mr-1" />
          {profile.is_active ? "Arquivar" : "Reativar"}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive">
              <Trash2 className="h-4 w-4 mr-1" />
              Excluir
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir perfil?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso removerá @{profile.username} e todo o histórico de métricas permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => { deleteProfile.mutate(profile.id); onClose(); }}>
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {latest && <LastUpdatedBadge date={latest.recorded_at} />}
      </div>

      {/* Metric Cards */}
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
            <p className="text-xs text-muted-foreground">Média 7 Dias</p>
            <p className="text-xl font-bold tabular-nums">{formatChange(Math.round(avg7))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Média 30 Dias</p>
            <p className="text-xl font-bold tabular-nums">{formatChange(Math.round(avg30))}</p>
          </CardContent>
        </Card>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2">
        {[{ label: "7d", value: "7" }, { label: "30d", value: "30" }, { label: "90d", value: "90" }, { label: "Tudo", value: "all" }].map(p => (
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

      {/* Charts */}
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

      <EditProfileDialog profile={profile} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}
