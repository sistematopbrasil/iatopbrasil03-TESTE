import { useEffect, useState } from "react";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, RefreshCw, Loader2, Clock, Zap } from "lucide-react";
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
    if (data) setAiEnabled(data.ai_enabled ?? false);
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
      .upsert({ organization_id: organizationId, ai_enabled: enabled }, { onConflict: "organization_id" });
    if (error) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
      setAiEnabled(!enabled);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Token Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Token Meta API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              {tokenStatus === null ? (
                <p className="text-sm text-muted-foreground">Clique para verificar o status do token</p>
              ) : tokenStatus.valid ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                  <div>
                    <span className="text-sm text-foreground font-medium">Token válido</span>
                    {tokenStatus.name && <p className="text-xs text-muted-foreground">{tokenStatus.name}</p>}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-destructive" />
                  <span className="text-sm text-destructive">Token inválido ou expirado</span>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={checkToken} disabled={checking}>
              {checking ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
              Verificar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Automatic Sync Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Sincronização Automática
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
              <Zap className="h-3 w-3 mr-1" />
              Ativa
            </Badge>
            <span className="text-sm text-foreground font-medium">Cron diário configurado</span>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Horário</span>
              <span className="font-medium text-foreground">06:00 BRT (09:00 UTC)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Frequência</span>
              <span className="font-medium text-foreground">Diária</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Primeira sincronização</span>
              <span className="font-medium text-foreground">60 dias de histórico</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Sincronizações seguintes</span>
              <span className="font-medium text-foreground">Últimos 2 dias (incremental)</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Você também pode sincronizar manualmente a qualquer momento usando o botão "Sincronizar" na visão geral.
          </p>
        </CardContent>
      </Card>

      {/* AI Toggle */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Assistente IA</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSettings ? (
            <div className="h-8 bg-muted animate-pulse rounded" />
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm font-medium">Ativar módulo de IA</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Quando ativado, mostra análises e sugestões com IA para suas campanhas
                </p>
              </div>
              <Switch checked={aiEnabled} onCheckedChange={toggleAI} />
            </div>
          )}
          <Badge variant={aiEnabled ? "default" : "secondary"} className="mt-3 text-xs font-medium">
            {aiEnabled ? "IA Ativada" : "IA Desativada"}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
