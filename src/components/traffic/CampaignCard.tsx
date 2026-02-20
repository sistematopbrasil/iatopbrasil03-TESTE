import { useState } from "react";
import { Campaign } from "@/hooks/useAccountCampaigns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ChevronDown, ChevronUp, Target, Users, MapPin, Layers, Calendar,
  TrendingUp, MousePointer, Eye, Radio, DollarSign, Activity
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Ativa", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  PAUSED: { label: "Pausada", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  DELETED: { label: "Excluída", className: "bg-destructive/15 text-destructive border-destructive/30" },
  ARCHIVED: { label: "Arquivada", className: "bg-muted text-muted-foreground border-border" },
  IN_PROCESS: { label: "Em processo", className: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
};

const OBJECTIVE_MAP: Record<string, string> = {
  LINK_CLICKS: "Tráfego",
  TRAFFIC: "Tráfego",
  CONVERSIONS: "Conversões",
  OUTCOME_TRAFFIC: "Tráfego",
  OUTCOME_LEADS: "Geração de Leads",
  OUTCOME_SALES: "Vendas",
  OUTCOME_ENGAGEMENT: "Engajamento",
  OUTCOME_AWARENESS: "Reconhecimento",
  OUTCOME_APP_PROMOTION: "Promoção de App",
  LEAD_GENERATION: "Geração de Leads",
  BRAND_AWARENESS: "Reconhecimento",
  REACH: "Alcance",
  ENGAGEMENT: "Engajamento",
  VIDEO_VIEWS: "Visualizações de Vídeo",
  APP_INSTALLS: "Instalações de App",
  MESSAGES: "Mensagens",
  CATALOG_SALES: "Vendas de Catálogo",
  STORE_VISITS: "Visitas à Loja",
};

const PLACEMENT_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  audience_network: "Audience Network",
  messenger: "Messenger",
  fb_feed: "Feed FB",
  fb_right_column: "Coluna Direita",
  fb_video_feeds: "Vídeo FB",
  fb_marketplace: "Marketplace",
  fb_story: "Stories FB",
  ig_stream: "Feed IG",
  ig_story: "Stories IG",
  ig_reels: "Reels",
  ig_explore: "Explorar IG",
};

function formatCurrency(val: number | null) {
  if (val === null || val === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
}

function formatNumber(val: number) {
  if (!val) return "0";
  return new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(val);
}

interface MetricMiniCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
}

function MetricMiniCard({ label, value, icon }: MetricMiniCardProps) {
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

interface CampaignCardProps {
  campaign: Campaign;
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const [open, setOpen] = useState(false);

  const status = STATUS_MAP[campaign.status] || { label: campaign.status, className: "bg-muted text-muted-foreground border-border" };
  const objective = OBJECTIVE_MAP[campaign.objective] || campaign.objective?.replace(/_/g, " ") || "N/A";
  const hasBudget = campaign.daily_budget !== null || campaign.lifetime_budget !== null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border border-border/60 hover:border-primary/30 transition-colors">
        <CollapsibleTrigger asChild>
          <div className="flex items-start justify-between p-4 cursor-pointer select-none gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-semibold text-foreground text-sm truncate max-w-[300px]">{campaign.name}</span>
                <Badge variant="outline" className={`text-xs px-2 py-0.5 ${status.className}`}>
                  {status.label}
                </Badge>
              </div>
              <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  {objective}
                </span>
                {hasBudget && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {campaign.daily_budget !== null
                      ? `${formatCurrency(campaign.daily_budget)}/dia`
                      : `${formatCurrency(campaign.lifetime_budget)} total`}
                  </span>
                )}
                {campaign.insights.spend > 0 && (
                  <span className="flex items-center gap-1 text-primary font-medium">
                    <TrendingUp className="h-3 w-3" />
                    {formatCurrency(campaign.insights.spend)} gasto (30d)
                  </span>
                )}
              </div>
            </div>
            <div className="text-muted-foreground flex-shrink-0 mt-0.5">
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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

            {/* Público */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Users className="h-3 w-3" /> Público-alvo
                </p>
                <div className="space-y-1 text-sm">
                  <p className="text-foreground">
                    <span className="text-muted-foreground text-xs">Idade: </span>
                    {campaign.targeting.age_min}–{campaign.targeting.age_max} anos
                  </p>
                  <p className="text-foreground">
                    <span className="text-muted-foreground text-xs">Gênero: </span>
                    {campaign.targeting.gender}
                  </p>
                </div>

                {campaign.targeting.locations.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                      <MapPin className="h-3 w-3" /> Localizações
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {campaign.targeting.locations.slice(0, 5).map((loc, i) => (
                        <Badge key={i} variant="outline" className="text-xs px-1.5 py-0">{loc}</Badge>
                      ))}
                      {campaign.targeting.locations.length > 5 && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0 text-muted-foreground">
                          +{campaign.targeting.locations.length - 5}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {campaign.targeting.interests.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Interesses
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {campaign.targeting.interests.slice(0, 6).map((interest, i) => (
                        <Badge key={i} className="text-xs px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                          {interest}
                        </Badge>
                      ))}
                      {campaign.targeting.interests.length > 6 && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0 text-muted-foreground">
                          +{campaign.targeting.interests.length - 6}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {(campaign.targeting.placements.length > 0 || campaign.targeting.publisher_platforms.length > 0) && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Layers className="h-3 w-3" /> Posicionamentos
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {campaign.targeting.publisher_platforms.map((p, i) => (
                        <Badge key={i} variant="outline" className="text-xs px-1.5 py-0 capitalize">
                          {PLACEMENT_LABELS[p] || p}
                        </Badge>
                      ))}
                      {campaign.targeting.placements
                        .filter(p => !campaign.targeting.publisher_platforms.includes(p))
                        .slice(0, 4)
                        .map((p, i) => (
                          <Badge key={i} variant="outline" className="text-xs px-1.5 py-0">
                            {PLACEMENT_LABELS[p] || p}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Período */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
                <Calendar className="h-3 w-3" /> Período
              </p>
              <p className="text-sm text-foreground">
                {campaign.start_time
                  ? format(new Date(campaign.start_time), "dd/MM/yyyy", { locale: ptBR })
                  : "—"}
                {" → "}
                {campaign.stop_time
                  ? format(new Date(campaign.stop_time), "dd/MM/yyyy", { locale: ptBR })
                  : <span className="text-emerald-600 font-medium">Em andamento</span>}
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
