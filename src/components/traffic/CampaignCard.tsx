import { useState } from "react";
import { Campaign, AdSet, Ad } from "@/hooks/useAccountCampaigns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ChevronDown, ChevronUp, Target, Users, MapPin, Layers, Calendar,
  TrendingUp, MousePointer, Eye, Radio, DollarSign, Activity, Loader2,
  Image, FileText
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Ativa", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  PAUSED: { label: "Pausada", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  DELETED: { label: "Excluída", className: "bg-destructive/15 text-destructive border-destructive/30" },
  ARCHIVED: { label: "Arquivada", className: "bg-muted text-muted-foreground border-border" },
  IN_PROCESS: { label: "Em processo", className: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
};

const OBJECTIVE_MAP: Record<string, string> = {
  LINK_CLICKS: "Tráfego", TRAFFIC: "Tráfego", CONVERSIONS: "Conversões",
  OUTCOME_TRAFFIC: "Tráfego", OUTCOME_LEADS: "Geração de Leads", OUTCOME_SALES: "Vendas",
  OUTCOME_ENGAGEMENT: "Engajamento", OUTCOME_AWARENESS: "Reconhecimento",
  OUTCOME_APP_PROMOTION: "Promoção de App", LEAD_GENERATION: "Geração de Leads",
  BRAND_AWARENESS: "Reconhecimento", REACH: "Alcance", ENGAGEMENT: "Engajamento",
  VIDEO_VIEWS: "Visualizações de Vídeo", APP_INSTALLS: "Instalações de App",
  MESSAGES: "Mensagens", CATALOG_SALES: "Vendas de Catálogo", STORE_VISITS: "Visitas à Loja",
};

const PLACEMENT_LABELS: Record<string, string> = {
  facebook: "Facebook", instagram: "Instagram", audience_network: "Audience Network",
  messenger: "Messenger", fb_feed: "Feed FB", fb_right_column: "Coluna Direita",
  fb_video_feeds: "Vídeo FB", fb_marketplace: "Marketplace", fb_story: "Stories FB",
  ig_stream: "Feed IG", ig_story: "Stories IG", ig_reels: "Reels", ig_explore: "Explorar IG",
};

function formatCurrency(val: number | null) {
  if (val === null || val === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
}

function formatNumber(val: number) {
  if (!val) return "0";
  return new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(val);
}

function MetricMiniCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/40 border border-border/40 min-w-[90px]">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className="text-sm font-bold text-foreground">{value}</span>
    </div>
  );
}

function AdSetSection({ adset }: { adset: AdSet }) {
  const [open, setOpen] = useState(false);
  const status = STATUS_MAP[adset.status] || { label: adset.status, className: "bg-muted text-muted-foreground border-border" };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/30 cursor-pointer hover:bg-muted/40 transition-colors">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Layers className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium truncate">{adset.name}</span>
              <Badge variant="outline" className={`text-xs px-1.5 py-0 ${status.className}`}>{status.label}</Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              {adset.targeting && (
                <span>{adset.targeting.gender}, {adset.targeting.age_min}–{adset.targeting.age_max}</span>
              )}
              {(adset.daily_budget || adset.lifetime_budget) && (
                <span className="flex items-center gap-0.5">
                  <DollarSign className="h-3 w-3" />
                  {adset.daily_budget ? `${formatCurrency(adset.daily_budget)}/dia` : formatCurrency(adset.lifetime_budget)}
                </span>
              )}
              <span>{adset.ads?.length || 0} anúncio(s)</span>
            </div>
          </div>
          {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-4 mt-2 space-y-3 border-l-2 border-border/30 pl-4">
          {/* Targeting details */}
          <div className="flex flex-wrap gap-3 text-xs">
            {adset.targeting?.locations?.length > 0 && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {adset.targeting.locations.slice(0, 3).join(", ")}
                {adset.targeting.locations.length > 3 && ` +${adset.targeting.locations.length - 3}`}
              </div>
            )}
            {adset.targeting?.publisher_platforms?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {adset.targeting.publisher_platforms.map((p, i) => (
                  <Badge key={i} variant="outline" className="text-xs px-1.5 py-0 capitalize">
                    {PLACEMENT_LABELS[p] || p}
                  </Badge>
                ))}
              </div>
            )}
            {adset.optimization_goal && (
              <span className="text-muted-foreground">Meta: {adset.optimization_goal.replace(/_/g, " ")}</span>
            )}
          </div>

          {/* Ads */}
          {adset.ads?.length > 0 && (
            <div className="space-y-2">
              {adset.ads.map((ad) => (
                <AdItem key={ad.id} ad={ad} />
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function AdItem({ ad }: { ad: Ad }) {
  const status = STATUS_MAP[ad.status] || { label: ad.status, className: "bg-muted text-muted-foreground border-border" };
  const thumbnailUrl = ad.creative?.thumbnail_url || ad.creative?.image_url;

  return (
    <div className="flex items-start gap-3 p-2.5 rounded-lg bg-background border border-border/30">
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={ad.name}
          className="w-12 h-12 rounded object-cover flex-shrink-0 border border-border/40"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div className="w-12 h-12 rounded bg-muted/60 flex items-center justify-center flex-shrink-0 border border-border/40">
          <Image className="h-5 w-5 text-muted-foreground/50" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium truncate">{ad.name}</span>
          <Badge variant="outline" className={`text-[10px] px-1 py-0 ${status.className}`}>{status.label}</Badge>
        </div>
        {ad.creative?.title && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate flex items-center gap-1">
            <FileText className="h-3 w-3 flex-shrink-0" />
            {ad.creative.title}
          </p>
        )}
      </div>
    </div>
  );
}

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const toggleStatus = useMutation({
    mutationFn: async (newStatus: "ACTIVE" | "PAUSED") => {
      const { data, error } = await supabase.functions.invoke("toggle-campaign-status", {
        body: { campaign_id: campaign.id, status: newStatus },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["account-campaigns"] });
      toast({ title: `Campanha ${newStatus === "ACTIVE" ? "ativada" : "pausada"} com sucesso!` });
    },
    onError: (e: Error) => {
      toast({ title: "Erro ao alterar status", description: e.message, variant: "destructive" });
    },
  });

  const canToggle = campaign.status === "ACTIVE" || campaign.status === "PAUSED";
  const isActive = campaign.status === "ACTIVE";
  const status = STATUS_MAP[campaign.status] || { label: campaign.status, className: "bg-muted text-muted-foreground border-border" };
  const objective = OBJECTIVE_MAP[campaign.objective] || campaign.objective?.replace(/_/g, " ") || "N/A";
  const hasBudget = campaign.daily_budget !== null || campaign.lifetime_budget !== null;
  const totalAds = (campaign.adsets || []).reduce((s, as) => s + (as.ads?.length || 0), 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border border-border/60 hover:border-primary/30 transition-colors">
        <CollapsibleTrigger asChild>
          <div className="flex items-start justify-between p-4 cursor-pointer select-none gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-semibold text-foreground text-sm truncate max-w-[300px]">{campaign.name}</span>
                <Badge variant="outline" className={`text-xs px-2 py-0.5 ${status.className}`}>{status.label}</Badge>
              </div>
              <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Target className="h-3 w-3" />{objective}</span>
                {hasBudget && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {campaign.daily_budget !== null ? `${formatCurrency(campaign.daily_budget)}/dia` : `${formatCurrency(campaign.lifetime_budget)} total`}
                  </span>
                )}
                {campaign.insights.spend > 0 && (
                  <span className="flex items-center gap-1 text-primary font-medium">
                    <TrendingUp className="h-3 w-3" />{formatCurrency(campaign.insights.spend)} gasto (30d)
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  {campaign.adsets_count} conj. · {totalAds} anúnc.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
              {canToggle && (
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {toggleStatus.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch checked={isActive} onCheckedChange={(checked) => toggleStatus.mutate(checked ? "ACTIVE" : "PAUSED")} disabled={toggleStatus.isPending} />
                  )}
                </div>
              )}
              {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 space-y-4">
            <div className="h-px bg-border/40" />

            {/* Métricas */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <Activity className="h-3 w-3" /> Métricas (últimos 30 dias)
              </p>
              <div className="flex flex-wrap gap-2">
                <MetricMiniCard label="Impressões" value={formatNumber(campaign.insights.impressions)} icon={<Eye className="h-3 w-3" />} />
                <MetricMiniCard label="Cliques" value={formatNumber(campaign.insights.clicks)} icon={<MousePointer className="h-3 w-3" />} />
                <MetricMiniCard label="CTR" value={`${campaign.insights.ctr.toFixed(2)}%`} icon={<TrendingUp className="h-3 w-3" />} />
                <MetricMiniCard label="Alcance" value={formatNumber(campaign.insights.reach)} icon={<Users className="h-3 w-3" />} />
                <MetricMiniCard label="Frequência" value={campaign.insights.frequency.toFixed(2)} icon={<Radio className="h-3 w-3" />} />
                <MetricMiniCard label="CPC" value={campaign.insights.cpc > 0 ? formatCurrency(campaign.insights.cpc) : "—"} icon={<DollarSign className="h-3 w-3" />} />
              </div>
            </div>

            {/* Conjuntos de Anúncios */}
            {campaign.adsets?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Layers className="h-3 w-3" /> Conjuntos de Anúncios ({campaign.adsets.length})
                </p>
                <div className="space-y-2">
                  {campaign.adsets.map((adset) => (
                    <AdSetSection key={adset.id} adset={adset} />
                  ))}
                </div>
              </div>
            )}

            {/* Período */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
                <Calendar className="h-3 w-3" /> Período
              </p>
              <p className="text-sm text-foreground">
                {campaign.start_time ? format(new Date(campaign.start_time), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                {" → "}
                {campaign.stop_time ? format(new Date(campaign.stop_time), "dd/MM/yyyy", { locale: ptBR }) : <span className="text-emerald-600 font-medium">Em andamento</span>}
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
