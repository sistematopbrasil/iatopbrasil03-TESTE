import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

interface MetaAccount {
  ad_account_id: string;
  name: string;
  account_status: number;
  timezone: string;
  currency: string;
}

export function ImportAccountsDialog({ open, onOpenChange, organizationId }: Props) {
  const { listMetaAccounts, importAccounts } = useAdAccounts(organizationId);
  const [metaAccounts, setMetaAccounts] = useState<MetaAccount[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      listMetaAccounts.mutateAsync().then((accounts) => {
        setMetaAccounts(accounts || []);
        setSelected(new Set());
      }).catch(() => {
        setMetaAccounts([]);
      }).finally(() => setLoading(false));
    }
  }, [open]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handleImport = async () => {
    const accounts = metaAccounts.filter((a) => selected.has(a.ad_account_id));
    await importAccounts.mutateAsync(accounts);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Contas do Meta</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : metaAccounts.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">
            Nenhuma conta encontrada no token Meta configurado.
          </p>
        ) : (
          <div className="space-y-2">
            {metaAccounts.map((acc) => (
              <div
                key={acc.ad_account_id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
                onClick={() => toggle(acc.ad_account_id)}
              >
                <Checkbox checked={selected.has(acc.ad_account_id)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{acc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {acc.ad_account_id} • {acc.currency} • {acc.timezone}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleImport}
            disabled={selected.size === 0 || importAccounts.isPending}
          >
            {importAccounts.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Importar {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
