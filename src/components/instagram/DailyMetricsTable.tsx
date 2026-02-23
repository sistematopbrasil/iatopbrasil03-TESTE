import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { InstaMetric } from "@/lib/instagram-utils";

interface Props {
  metrics: InstaMetric[];
}

const PAGE_SIZE = 10;

export function DailyMetricsTable({ metrics }: Props) {
  const [page, setPage] = useState(0);

  const sorted = [...metrics].sort((a, b) => b.recorded_date.localeCompare(a.recorded_date));
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (sorted.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Sem dados para o período selecionado.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Seguidores</TableHead>
              <TableHead className="text-right">Mudança</TableHead>
              <TableHead className="text-right">Taxa</TableHead>
              <TableHead className="text-right">Seguindo</TableHead>
              <TableHead className="text-right">Posts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="text-sm">
                  {format(parseISO(m.recorded_date), "dd/MM/yyyy", { locale: ptBR })}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {m.follower_count.toLocaleString("pt-BR")}
                </TableCell>
                <TableCell className={`text-right tabular-nums font-medium ${
                  (m.daily_change || 0) > 0 ? "text-green-500" : (m.daily_change || 0) < 0 ? "text-red-500" : "text-muted-foreground"
                }`}>
                  {(m.daily_change || 0) > 0 ? "+" : ""}{m.daily_change || 0}
                </TableCell>
                <TableCell className={`text-right tabular-nums text-sm ${
                  (m.growth_rate || 0) > 0 ? "text-green-500" : (m.growth_rate || 0) < 0 ? "text-red-500" : "text-muted-foreground"
                }`}>
                  {(m.growth_rate || 0) > 0 ? "+" : ""}{(m.growth_rate || 0).toFixed(2)}%
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {m.following_count.toLocaleString("pt-BR")}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {m.posts_count.toLocaleString("pt-BR")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Página {page + 1} de {totalPages} ({sorted.length} registros)
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
