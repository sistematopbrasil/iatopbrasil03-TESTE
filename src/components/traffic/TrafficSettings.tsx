import { useEffect, useState } from "react";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  organizationId: string;
}

export function TrafficSettings({ organizationId }: Props) {
  const { toast } = useToast();
  const { validateToken } = useAdAccounts(organizationId);
  const [tokenStatus, setTokenStatus] = useState<{ valid: boolean; name?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    loadSettings();
  }, [organizationId]);

  const loadSettings = async () => {
    setLoadingSettings(true);
    const { data } = await supabase
      .from("traffic_settings")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (data) {
      setAiEnabled(data.ai_enabled ?? false);
    }
    setLoadingSettings(false);
  };

  const checkToken = async () => {
    setChecking(true);
    try {
      const result = await validateToken.mutateAsync();
      setTokenStatus(result);
    } catch {
      setTokenStatus({ valid: false });
    }
    setChecking(false);
  };

  const toggleAI = async (enabled: boolean) => {
    setAiEnabled(enabled);
    const { error } = await supabase
      .from("traffic_settings")
      .upsert({
        organization_id: organizationId,
        ai_enabled: enabled,
      }, { onConflict: "organization_id" });

    if (error) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
      setAiEnabled(!enabled);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Token Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Token Meta API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              {tokenStatus === null ? (
                <p className="text-sm text-muted-foreground">Clique para verificar o status do token</p>
              ) : tokenStatus.valid ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                  <span className="text-sm text-foreground">Token válido — {tokenStatus.name}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-destructive" />
                  <span className="text-sm text-destructive">Token inválido ou expirado</span>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={checkToken} disabled={checking}>
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-1.5">Verificar</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assistente IA</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSettings ? (
            <div className="h-8 bg-muted animate-pulse rounded" />
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Ativar módulo de IA</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Quando ativado, mostra o assistente IA para análises e criação de campanhas
                </p>
              </div>
              <Switch checked={aiEnabled} onCheckedChange={toggleAI} />
            </div>
          )}
          <Badge variant="secondary" className="mt-3 text-xs">
            {aiEnabled ? "IA Ativada" : "IA Desativada"}
          </Badge>
        </CardContent>
      </Card>

      {/* Sync Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sincronização</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            As métricas são sincronizadas manualmente via botão "Sincronizar" na aba Visão Geral.
            Na Fase 2, será possível configurar sincronização automática por cron.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
