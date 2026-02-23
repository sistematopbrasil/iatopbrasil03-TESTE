import { useState, useCallback } from "react";
import { Campaign, AdSet, Ad } from "@/hooks/useAccountCampaigns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
  Target, Users, Layers, DollarSign, Activity, Eye, MousePointer,
  TrendingUp, Radio, ChevronDown, ChevronUp, Loader2, Save, Image,
  MapPin, Settings2, Pencil
} from "lucide-react";
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
  LEAD_GENERATION: "Geração de Leads", REACH: "Alcance", MESSAGES: "Mensagens",
};

const PLATFORM_OPTIONS = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "audience_network", label: "Audience Network" },
  { value: "messenger", label: "Messenger" },
];

function formatCurrency(val: number | null) {
  if (val === null || val === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
}

function formatNumber(val: number) {
  if (!val) return "0";
  return new Intl.NumberFormat("pt-BR").format(val);
}

function MetricItem({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-muted/40 border border-border/40 flex-1 min-w-[80px]">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-medium uppercase">{label}</span>
      </div>
      <span className="text-sm font-bold text-foreground">{value}</span>
    </div>
  );
}

interface CampaignEditDialogProps {
  campaign: Campaign;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CampaignEditDialog({ campaign, open, onOpenChange }: CampaignEditDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const status = STATUS_MAP[campaign.status] || { label: campaign.status, className: "bg-muted text-muted-foreground" };
  const objective = OBJECTIVE_MAP[campaign.objective] || campaign.objective?.replace(/_/g, " ") || "N/A";

  const toggleEntity = useMutation({
    mutationFn: async ({ entityId, entityType, newStatus }: { entityId: string; entityType: string; newStatus: string }) => {
      const { data, error } = await supabase.functions.invoke("toggle-campaign-status", {
        body: { entity_id: entityId, entity_type: entityType, status: newStatus },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-campaigns"] });
      toast({ title: "Status atualizado!" });
    },
    onError: (e: Error) => {
      toast({ title: "Erro ao alterar status", description: e.message, variant: "destructive" });
    },
  });

  const updateTargeting = useMutation({
    mutationFn: async (params: Record<string, any>) => {
      const { data, error } = await supabase.functions.invoke("update-campaign-targeting", {
        body: params,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-campaigns"] });
      toast({ title: "Segmentação atualizada!" });
    },
    onError: (e: Error) => {
      toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-5 pb-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-bold truncate">{campaign.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge variant="outline" className={`text-xs ${status.className}`}>{status.label}</Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Target className="h-3 w-3" /> {objective}
                </span>
                {campaign.daily_budget && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> {formatCurrency(campaign.daily_budget)}/dia
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              {(campaign.status === "ACTIVE" || campaign.status === "PAUSED") && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{campaign.status === "ACTIVE" ? "Ativa" : "Pausada"}</span>
                  <Switch
                    checked={campaign.status === "ACTIVE"}
                    disabled={toggleEntity.isPending}
                    onCheckedChange={(checked) =>
                      toggleEntity.mutate({ entityId: campaign.id, entityType: "campaign", newStatus: checked ? "ACTIVE" : "PAUSED" })
                    }
                  />
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(90vh-100px)]">
          <div className="p-5 pt-4 space-y-5">
            {/* Metrics Summary */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <Activity className="h-3 w-3" /> Métricas (30 dias)
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <MetricItem label="Gasto" value={formatCurrency(campaign.insights.spend)} icon={<DollarSign className="h-3 w-3" />} />
                <MetricItem label="Impressões" value={formatNumber(campaign.insights.impressions)} icon={<Eye className="h-3 w-3" />} />
                <MetricItem label="Cliques" value={formatNumber(campaign.insights.clicks)} icon={<MousePointer className="h-3 w-3" />} />
                <MetricItem label="CTR" value={`${campaign.insights.ctr.toFixed(2)}%`} icon={<TrendingUp className="h-3 w-3" />} />
                <MetricItem label="Alcance" value={formatNumber(campaign.insights.reach)} icon={<Users className="h-3 w-3" />} />
                <MetricItem label="CPC" value={campaign.insights.cpc > 0 ? formatCurrency(campaign.insights.cpc) : "—"} icon={<DollarSign className="h-3 w-3" />} />
              </div>
            </div>

            <Separator />

            {/* Ad Sets */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
                <Layers className="h-3 w-3" /> Conjuntos de Anúncios ({campaign.adsets?.length || 0})
              </p>
              <div className="space-y-3">
                {(campaign.adsets || []).map((adset) => (
                  <AdSetEditor
                    key={adset.id}
                    adset={adset}
                    onToggleStatus={(id, status) => toggleEntity.mutate({ entityId: id, entityType: "adset", newStatus: status })}
                    onUpdateTargeting={(params) => updateTargeting.mutate(params)}
                    isToggling={toggleEntity.isPending}
                    isUpdating={updateTargeting.isPending}
                  />
                ))}
                {(!campaign.adsets || campaign.adsets.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum conjunto de anúncios encontrado</p>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

interface AdSetEditorProps {
  adset: AdSet;
  onToggleStatus: (id: string, status: string) => void;
  onUpdateTargeting: (params: Record<string, any>) => void;
  isToggling: boolean;
  isUpdating: boolean;
}

function AdSetEditor({ adset, onToggleStatus, onUpdateTargeting, isToggling, isUpdating }: AdSetEditorProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [ageMin, setAgeMin] = useState(adset.targeting?.age_min || 18);
  const [ageMax, setAgeMax] = useState(adset.targeting?.age_max || 65);
  const [gender, setGender] = useState<string>(
    adset.targeting?.gender === "Masculino" ? "1" : adset.targeting?.gender === "Feminino" ? "2" : "0"
  );
  const [platforms, setPlatforms] = useState<string[]>(adset.targeting?.publisher_platforms || []);
  const [budget, setBudget] = useState<string>(adset.daily_budget?.toString() || "");

  const status = STATUS_MAP[adset.status] || { label: adset.status, className: "bg-muted text-muted-foreground" };
  const canToggle = adset.status === "ACTIVE" || adset.status === "PAUSED";
  const isActive = adset.status === "ACTIVE";

  const handleSave = () => {
    const params: Record<string, any> = { adset_id: adset.id };
    if (ageMin !== (adset.targeting?.age_min || 18)) params.age_min = ageMin;
    if (ageMax !== (adset.targeting?.age_max || 65)) params.age_max = ageMax;
    
    const genderArray = gender === "0" ? [] : [Number(gender)];
    params.genders = genderArray;
    
    if (platforms.length > 0) params.publisher_platforms = platforms;
    if (budget && Number(budget) !== adset.daily_budget) params.daily_budget = Number(budget);

    onUpdateTargeting(params);
    setEditing(false);
  };

  const togglePlatform = (p: string) => {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  return (
    <Card className="border border-border/50">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-muted/20 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Layers className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-medium truncate">{adset.name}</span>
                <Badge variant="outline" className={`text-xs px-1.5 py-0 ${status.className}`}>{status.label}</Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                {adset.targeting && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {adset.targeting.gender}, {adset.targeting.age_min}–{adset.targeting.age_max}
                  </span>
                )}
                {adset.daily_budget && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {formatCurrency(adset.daily_budget)}/dia
                  </span>
                )}
                <span>{adset.ads?.length || 0} anúncio(s)</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              {canToggle && (
                <Switch
                  checked={isActive}
                  disabled={isToggling}
                  onCheckedChange={(checked) => onToggleStatus(adset.id, checked ? "ACTIVE" : "PAUSED")}
                />
              )}
              {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 space-y-4">
            <Separator />

            {/* AdSet Metrics */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <MetricItem label="Gasto" value={formatCurrency(adset.insights?.spend)} icon={<DollarSign className="h-3 w-3" />} />
              <MetricItem label="Impressões" value={formatNumber(adset.insights?.impressions || 0)} icon={<Eye className="h-3 w-3" />} />
              <MetricItem label="Cliques" value={formatNumber(adset.insights?.clicks || 0)} icon={<MousePointer className="h-3 w-3" />} />
              <MetricItem label="CTR" value={`${(adset.insights?.ctr || 0).toFixed(2)}%`} icon={<TrendingUp className="h-3 w-3" />} />
              <MetricItem label="Alcance" value={formatNumber(adset.insights?.reach || 0)} icon={<Users className="h-3 w-3" />} />
              <MetricItem label="Freq." value={(adset.insights?.frequency || 0).toFixed(2)} icon={<Radio className="h-3 w-3" />} />
            </div>

            {/* Targeting Info / Editor */}
            <div className="rounded-lg border border-border/40 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Settings2 className="h-3 w-3" /> Segmentação
                </p>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setEditing(!editing)}>
                  <Pencil className="h-3 w-3" />
                  {editing ? "Cancelar" : "Editar"}
                </Button>
              </div>

              {editing ? (
                <div className="space-y-4">
                  {/* Age Range */}
                  <div className="space-y-2">
                    <Label className="text-xs">Idade: {ageMin} – {ageMax}</Label>
                    <div className="flex items-center gap-3">
                      <Input type="number" value={ageMin} onChange={e => setAgeMin(Number(e.target.value))} className="w-20 h-8 text-xs" min={13} max={65} />
                      <span className="text-xs text-muted-foreground">até</span>
                      <Input type="number" value={ageMax} onChange={e => setAgeMax(Number(e.target.value))} className="w-20 h-8 text-xs" min={13} max={65} />
                    </div>
                  </div>

                  {/* Gender */}
                  <div className="space-y-2">
                    <Label className="text-xs">Gênero</Label>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Todos</SelectItem>
                        <SelectItem value="1">Masculino</SelectItem>
                        <SelectItem value="2">Feminino</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Platforms */}
                  <div className="space-y-2">
                    <Label className="text-xs">Plataformas</Label>
                    <div className="flex flex-wrap gap-2">
                      {PLATFORM_OPTIONS.map(p => (
                        <Badge
                          key={p.value}
                          variant={platforms.includes(p.value) ? "default" : "outline"}
                          className="cursor-pointer text-xs"
                          onClick={() => togglePlatform(p.value)}
                        >
                          {p.label}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Budget */}
                  <div className="space-y-2">
                    <Label className="text-xs">Orçamento diário (R$)</Label>
                    <Input
                      type="number"
                      value={budget}
                      onChange={e => setBudget(e.target.value)}
                      className="h-8 text-xs w-32"
                      placeholder="Ex: 50.00"
                      step="0.01"
                    />
                  </div>

                  <Button size="sm" className="gap-1" onClick={handleSave} disabled={isUpdating}>
                    {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Salvar alterações
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Idade:</span>{" "}
                    <span className="font-medium">{adset.targeting?.age_min || 18} – {adset.targeting?.age_max || 65}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Gênero:</span>{" "}
                    <span className="font-medium">{adset.targeting?.gender || "Todos"}</span>
                  </div>
                  {adset.targeting?.locations?.length > 0 && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Locais:</span>{" "}
                      <span className="font-medium">{adset.targeting.locations.slice(0, 5).join(", ")}</span>
                    </div>
                  )}
                  {adset.targeting?.publisher_platforms?.length > 0 && (
                    <div className="col-span-2 flex items-center gap-1 flex-wrap">
                      <span className="text-muted-foreground">Plataformas:</span>
                      {adset.targeting.publisher_platforms.map((p, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{p}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Ads list */}
            {adset.ads?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Anúncios ({adset.ads.length})
                </p>
                <div className="space-y-2">
                  {adset.ads.map(ad => (
                    <AdEditor key={ad.id} ad={ad} onToggleStatus={onToggleStatus} isToggling={isToggling} />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function AdEditor({ ad, onToggleStatus, isToggling }: { ad: Ad; onToggleStatus: (id: string, status: string) => void; isToggling: boolean }) {
  const status = STATUS_MAP[ad.status] || { label: ad.status, className: "bg-muted text-muted-foreground" };
  const canToggle = ad.status === "ACTIVE" || ad.status === "PAUSED";
  const thumbnailUrl = ad.creative?.thumbnail_url || ad.creative?.image_url;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/30">
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={ad.name}
          className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-border/40"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-muted/60 flex items-center justify-center flex-shrink-0 border border-border/40">
          <Image className="h-5 w-5 text-muted-foreground/50" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{ad.name}</span>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${status.className}`}>{status.label}</Badge>
        </div>
        {ad.creative?.title && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{ad.creative.title}</p>
        )}
        {ad.creative?.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ad.creative.body}</p>
        )}
      </div>
      {canToggle && (
        <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={ad.status === "ACTIVE"}
            disabled={isToggling}
            onCheckedChange={(checked) => onToggleStatus(ad.id, checked ? "ACTIVE" : "PAUSED")}
          />
        </div>
      )}
    </div>
  );
}
