import { useState, useMemo } from "react";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useAccountCampaigns } from "@/hooks/useAccountCampaigns";
import { useTrafficMetrics } from "@/hooks/useTrafficMetrics";
import { CampaignCard } from "./CampaignCard";
import { TrafficAIChat } from "./TrafficAIChat";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshCw, Megaphone, Bot, LayoutList, AlertCircle, ArrowUpDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface CampaignsTabProps {
  organizationId: string;
  aiEnabled: boolean;
}

export function CampaignsTab({ organizationId, aiEnabled }: CampaignsTabProps) {
  const isMobile = useIsMobile();
  const { accounts } = useAdAccounts(organizationId);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("status");
  const [onlyActive, setOnlyActive] = useState(false);

  const monitoredAccounts = accounts.filter(a => a.is_monitored);
  const selectedAccount = monitoredAccounts.find(a => a.ad_account_id === selectedAccountId);

  const { data: campaigns = [], isLoading, refetch, error } = useAccountCampaigns(selectedAccountId || null);
  const metricsQuery = useTrafficMetrics(organizationId, undefined, selectedAccountId);
  const metricsData = metricsQuery.data;

  // Build metrics summary for AI context
  const metricsSummary = metricsData
    ? {
        total_spend: metricsData.totalSpend,
        total_impressions: metricsData.totalImpressions,
        total_clicks: metricsData.totalClicks,
        avg_ctr: metricsData.avgCtr,
        avg_cpc: metricsData.avgCpc,
        total_reach: metricsData.totalReach,
        avg_frequency: metricsData.avgFrequency,
      }
    : undefined;

  const CampaignsList = () => {
    if (!selectedAccountId) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
          <Megaphone className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="font-medium text-foreground">Selecione uma conta</p>
            <p className="text-sm text-muted-foreground mt-1">Escolha uma conta acima para ver suas campanhas</p>
          </div>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
          <AlertCircle className="h-8 w-8 text-destructive/60" />
          <div>
            <p className="font-medium text-foreground">Erro ao carregar campanhas</p>
            <p className="text-xs text-muted-foreground mt-1">{(error as Error).message}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3 mr-1" /> Tentar novamente
          </Button>
        </div>
      );
    }

    if (campaigns.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
          <Megaphone className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Nenhuma campanha encontrada para esta conta</p>
        </div>
      );
    }

    const statusOrder: Record<string, number> = { ACTIVE: 0, IN_PROCESS: 1, PAUSED: 2, ARCHIVED: 3, DELETED: 4 };
    
    let filtered = onlyActive ? campaigns.filter(c => c.status === "ACTIVE") : [...campaigns];
    
    if (sortBy === "status") {
      filtered.sort((a, b) => (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5));
    } else if (sortBy === "date_newest") {
      filtered.sort((a, b) => new Date(b.created_time || 0).getTime() - new Date(a.created_time || 0).getTime());
    } else if (sortBy === "date_oldest") {
      filtered.sort((a, b) => new Date(a.created_time || 0).getTime() - new Date(b.created_time || 0).getTime());
    } else if (sortBy === "budget_high") {
      filtered.sort((a, b) => Number(b.daily_budget || b.lifetime_budget || 0) - Number(a.daily_budget || a.lifetime_budget || 0));
    } else if (sortBy === "budget_low") {
      filtered.sort((a, b) => Number(a.daily_budget || a.lifetime_budget || 0) - Number(b.daily_budget || b.lifetime_budget || 0));
    }

    if (filtered.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
          <Megaphone className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            {onlyActive ? "Nenhuma campanha ativa encontrada" : "Nenhuma campanha encontrada para esta conta"}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {filtered.map(campaign => (
          <CampaignCard key={campaign.id} campaign={campaign} />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Account selector bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder="Selecionar conta..." />
          </SelectTrigger>
          <SelectContent>
            {monitoredAccounts.length === 0 ? (
              <div className="p-3 text-center text-sm text-muted-foreground">
                Nenhuma conta monitorada
              </div>
            ) : (
              monitoredAccounts.map(acc => (
                <SelectItem key={acc.ad_account_id} value={acc.ad_account_id}>
                  {acc.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        {selectedAccountId && (
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        )}

        {selectedAccount && (
          <div className="flex items-center gap-2 ml-auto">
            <Badge variant="outline" className="text-xs">
              ID: {selectedAccount.ad_account_id}
            </Badge>
            {campaigns.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {campaigns.length} campanhas
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Filters bar */}
      {selectedAccountId && campaigns.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="Ordenar por..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="date_newest">Mais recentes</SelectItem>
                <SelectItem value="date_oldest">Mais antigas</SelectItem>
                <SelectItem value="budget_high">Maior orçamento</SelectItem>
                <SelectItem value="budget_low">Menor orçamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="only-active"
              checked={onlyActive}
              onCheckedChange={(checked) => setOnlyActive(checked === true)}
            />
            <label htmlFor="only-active" className="text-xs text-muted-foreground cursor-pointer">
              Apenas ativas
            </label>
          </div>
        </div>
      )}

      {/* Content layout */}
      {isMobile && aiEnabled && selectedAccountId && campaigns.length > 0 ? (
        // Mobile: tabs for campaigns vs AI chat
        <Tabs defaultValue="campaigns">
          <TabsList className="w-full">
            <TabsTrigger value="campaigns" className="flex-1">
              <LayoutList className="h-3.5 w-3.5 mr-1.5" />
              Campanhas
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex-1">
              <Bot className="h-3.5 w-3.5 mr-1.5" />
              Chat IA
            </TabsTrigger>
          </TabsList>
          <TabsContent value="campaigns" className="mt-3">
            <CampaignsList />
          </TabsContent>
          <TabsContent value="chat" className="mt-3">
            <div className="h-[600px]">
              <TrafficAIChat
                accountName={selectedAccount?.name || ""}
                adAccountId={selectedAccountId}
                campaigns={campaigns}
                metricsSummary={metricsSummary}
                organizationId={organizationId}
              />
            </div>
          </TabsContent>
        </Tabs>
      ) : aiEnabled && selectedAccountId ? (
        // Desktop: 2-column layout — fit viewport
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4 items-start" style={{ height: "calc(100vh - 260px)" }}>
          <div className="overflow-y-auto h-full pr-2">
            <CampaignsList />
          </div>
          <div className="h-full min-h-[400px] sticky top-4">
            <TrafficAIChat
              accountName={selectedAccount?.name || ""}
              adAccountId={selectedAccountId}
              campaigns={campaigns}
              metricsSummary={metricsSummary}
              organizationId={organizationId}
            />
          </div>
        </div>
      ) : (
        // No AI or no account: full width campaigns list
        <CampaignsList />
      )}
    </div>
  );
}
