import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface AccountRow {
  id: string;
  ad_account_id: string;
  name: string;
  status: string | null;
  is_monitored: boolean | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  reach: number;
  profile_visits: number;
  link_clicks: number;
}

interface Props {
  rows: AccountRow[];
  isLoading?: boolean;
  onViewDetail: (ad_account_id: string) => void;
  onToggleMonitoring: (id: string, is_monitored: boolean) => void;
  isToggling?: boolean;
}

function formatCurrency(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatNumber(n: number) {
  return n.toLocaleString("pt-BR");
}

export function TrafficAccountsTable({ rows, isLoading, onViewDetail, onToggleMonitoring, isToggling }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Performance das Contas</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            Nenhuma conta monitorada. Importe contas na aba "Contas".
          </div>
        ) : (
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
                  <TableHead className="text-xs font-medium text-right hidden xl:table-cell">Visitas</TableHead>
                  <TableHead className="text-xs font-medium text-center">Status</TableHead>
                  <TableHead className="text-xs font-medium text-center">Monitor</TableHead>
                  <TableHead className="text-xs font-medium text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow
                    key={row.id}
                    className={`border-border/30 hover:bg-muted/30 cursor-pointer transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                  >
                    <TableCell className="py-3">
                      <div>
                        <p className="font-medium text-sm text-foreground truncate max-w-[180px]">{row.name}</p>
                        <p className="text-xs text-muted-foreground">ID: {row.ad_account_id}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-3">
                      <span className="font-semibold text-primary text-sm">{formatCurrency(row.spend)}</span>
                    </TableCell>
                    <TableCell className="text-right py-3 hidden md:table-cell text-sm text-muted-foreground">
                      {formatNumber(row.impressions)}
                    </TableCell>
                    <TableCell className="text-right py-3 hidden md:table-cell text-sm text-muted-foreground">
                      {formatNumber(row.clicks)}
                    </TableCell>
                    <TableCell className="text-right py-3 hidden lg:table-cell text-sm text-muted-foreground">
                      {row.ctr.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right py-3 hidden lg:table-cell text-sm text-muted-foreground">
                      {formatNumber(row.reach)}
                    </TableCell>
                    <TableCell className="text-right py-3 hidden xl:table-cell text-sm text-muted-foreground">
                      {formatNumber(row.profile_visits)}
                    </TableCell>
                    <TableCell className="text-center py-3">
                      <Badge
                        variant={row.status === "active" ? "default" : "secondary"}
                        className={`text-xs ${row.status === "active" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" : "bg-muted text-muted-foreground"}`}
                      >
                        {row.status === "active" ? "Ativa" : row.status || "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center py-3">
                      <Switch
                        checked={row.is_monitored ?? false}
                        onCheckedChange={(checked) => onToggleMonitoring(row.id, checked)}
                        disabled={isToggling}
                      />
                    </TableCell>
                    <TableCell className="text-center py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:text-primary"
                        onClick={() => onViewDetail(row.ad_account_id)}
                        title="Ver detalhes"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
