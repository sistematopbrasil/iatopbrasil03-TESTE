import { useState } from "react";
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
import { RefreshCw, Megaphone, Bot, LayoutList, AlertCircle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface CampaignsTabProps {
  organizationId: string;
  aiEnabled: boolean;
}

export function CampaignsTab({ organizationId, aiEnabled }: CampaignsTabProps) {
  const isMobile = useIsMobile();
  const { accounts } = useAdAccounts(organizationId);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

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
    const sorted = [...campaigns].sort((a, b) => (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5));

    return (
      <div className="space-y-2">
        {sorted.map(campaign => (
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
            <div className="h-[500px]">
              <TrafficAIChat
                accountName={selectedAccount?.name || ""}
                adAccountId={selectedAccountId}
                campaigns={campaigns}
                metricsSummary={metricsSummary}
              />
            </div>
          </TabsContent>
        </Tabs>
      ) : aiEnabled && selectedAccountId ? (
        // Desktop: 2-column layout
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">
          <div className="overflow-y-auto max-h-[calc(100vh-280px)] pr-2">
            <CampaignsList />
          </div>
          <div className="h-[calc(100vh-280px)] min-h-[500px] sticky top-4">
            <TrafficAIChat
              accountName={selectedAccount?.name || ""}
              adAccountId={selectedAccountId}
              campaigns={campaigns}
              metricsSummary={metricsSummary}
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
