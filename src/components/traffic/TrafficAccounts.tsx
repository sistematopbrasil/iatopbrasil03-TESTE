import { useState } from "react";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCw, Clock } from "lucide-react";
import { ImportAccountsDialog } from "./ImportAccountsDialog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  organizationId: string;
}

export function TrafficAccounts({ organizationId }: Props) {
  const [importOpen, setImportOpen] = useState(false);
  const { accounts, isLoading, toggleMonitoring, syncHistory } = useAdAccounts(organizationId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Contas Monitoradas</h3>
        <Button onClick={() => setImportOpen(true)} size="sm">
          <Download className="h-4 w-4 mr-1.5" />
          Importar Contas
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
          ))}
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
        <div className="space-y-3">
          {accounts.map((acc) => (
            <Card key={acc.id} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-foreground truncate">{acc.name}</h4>
                      <Badge variant={acc.status === "active" ? "default" : "secondary"} className="text-xs">
                        {acc.status === "active" ? "Ativa" : "Inativa"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>ID: {acc.ad_account_id}</span>
                      {acc.currency && <span>{acc.currency}</span>}
                      {acc.last_synced_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(acc.last_synced_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => syncHistory.mutate({ ad_account_id: acc.ad_account_id, organization_id: organizationId })}
                      disabled={syncHistory.isPending}
                      title="Sincronizar histórico 30 dias"
                    >
                      <RefreshCw className={`h-4 w-4 ${syncHistory.isPending ? "animate-spin" : ""}`} />
                    </Button>
                    <Switch
                      checked={acc.is_monitored ?? false}
                      onCheckedChange={(checked) => toggleMonitoring.mutate({ id: acc.id, is_monitored: checked })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ImportAccountsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        organizationId={organizationId}
      />
    </div>
  );
}
