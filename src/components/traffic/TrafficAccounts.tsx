import { useState } from "react";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useTrafficMetrics } from "@/hooks/useTrafficMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, RefreshCw, Clock, Eye } from "lucide-react";
import { ImportAccountsDialog } from "./ImportAccountsDialog";
import { TrafficAccountDetail } from "./TrafficAccountDetail";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  organizationId: string;
}

function formatCurrency(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatNumber(n: number) {
  return n.toLocaleString("pt-BR");
}

export function TrafficAccounts({ organizationId }: Props) {
  const [importOpen, setImportOpen] = useState(false);
  const [detailAccount, setDetailAccount] = useState<string | null>(null);
  const { accounts, isLoading, toggleMonitoring, syncHistory } = useAdAccounts(organizationId);
  const { data: metrics, isLoading: metricsLoading } = useTrafficMetrics(organizationId);

  const detailAccountInfo = accounts.find(a => a.ad_account_id === detailAccount) || null;

  // Build performance rows
  const tableRows = accounts.map(acc => {
    const accMetrics = metrics?.byAccount.find(b => b.ad_account_id === acc.ad_account_id);
    return {
      id: acc.id,
      ad_account_id: acc.ad_account_id,
      name: acc.name,
      status: acc.status,
      is_monitored: acc.is_monitored,
      last_synced_at: acc.last_synced_at,
      currency: acc.currency,
      spend: accMetrics?.spend || 0,
      impressions: accMetrics?.impressions || 0,
      clicks: accMetrics?.clicks || 0,
      ctr: accMetrics?.ctr || 0,
      reach: accMetrics?.reach || 0,
    };
  });

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Contas de Anúncios</h3>
        <Button onClick={() => setImportOpen(true)} size="sm">
          <Download className="h-4 w-4 mr-1.5" />
          Importar Contas
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">Nenhuma conta importada ainda</p>
            <Button onClick={() => setImportOpen(true)}>
              <Download className="h-4 w-4 mr-1.5" />
              Importar do Meta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Performance das Contas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="text-xs font-medium">Conta</TableHead>
                    <TableHead className="text-xs font-medium text-right">Gasto</TableHead>
                    <TableHead className="text-xs font-medium text-right hidden md:table-cell">Impressões</TableHead>
                    <TableHead className="text-xs font-medium text-right hidden md:table-cell">Cliques</TableHead>
                    <TableHead className="text-xs font-medium text-right hidden lg:table-cell">CTR</TableHead>
                    <TableHead className="text-xs font-medium text-right hidden lg:table-cell">Alcance</TableHead>
                    <TableHead className="text-xs font-medium text-center">Status</TableHead>
                    <TableHead className="text-xs font-medium text-center">Monitor</TableHead>
                    <TableHead className="text-xs font-medium text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map((row, idx) => (
                    <TableRow key={row.id} className={`border-border/30 hover:bg-muted/30 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}`}>
                      <TableCell className="py-3">
                        <div>
                          <p className="font-medium text-sm text-foreground truncate max-w-[180px]">{row.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>ID: {row.ad_account_id}</span>
                            {row.last_synced_at && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(row.last_synced_at), { addSuffix: true, locale: ptBR })}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-3">
                        <span className="font-semibold text-primary text-sm">{formatCurrency(row.spend)}</span>
                      </TableCell>
                      <TableCell className="text-right py-3 hidden md:table-cell text-sm text-muted-foreground">{formatNumber(row.impressions)}</TableCell>
                      <TableCell className="text-right py-3 hidden md:table-cell text-sm text-muted-foreground">{formatNumber(row.clicks)}</TableCell>
                      <TableCell className="text-right py-3 hidden lg:table-cell text-sm text-muted-foreground">{row.ctr.toFixed(2)}%</TableCell>
                      <TableCell className="text-right py-3 hidden lg:table-cell text-sm text-muted-foreground">{formatNumber(row.reach)}</TableCell>
                      <TableCell className="text-center py-3">
                        <Badge
                          variant={row.status === "active" ? "default" : "secondary"}
                          className={`text-xs ${row.status === "active" ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" : "bg-muted text-muted-foreground"}`}
                        >
                          {row.status === "active" ? "Ativa" : row.status || "Inativa"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center py-3">
                        <Switch
                          checked={row.is_monitored ?? false}
                          onCheckedChange={(checked) => toggleMonitoring.mutate({ id: row.id, is_monitored: checked })}
                          disabled={toggleMonitoring.isPending}
                        />
                      </TableCell>
                      <TableCell className="text-center py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:text-primary"
                            onClick={() => syncHistory.mutate({ ad_account_id: row.ad_account_id, organization_id: organizationId })}
                            disabled={syncHistory.isPending}
                            title="Sincronizar histórico"
                          >
                            <RefreshCw className={`h-4 w-4 ${syncHistory.isPending ? "animate-spin" : ""}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:text-primary"
                            onClick={() => setDetailAccount(row.ad_account_id)}
                            title="Ver detalhes"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <ImportAccountsDialog open={importOpen} onOpenChange={setImportOpen} organizationId={organizationId} />
      <TrafficAccountDetail
        open={!!detailAccount}
        onClose={() => setDetailAccount(null)}
        account={detailAccountInfo as any}
        organizationId={organizationId}
      />
    </div>
  );
}
