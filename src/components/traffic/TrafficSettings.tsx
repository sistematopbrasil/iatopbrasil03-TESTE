import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentConsultant, isSuperAdmin } from "@/lib/consultant-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, RefreshCw, Loader2, Clock, Zap, Bot, Save, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  organizationId: string;
}

const AI_MODELS = [
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (Rápido)" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (Balanceado)" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (Avançado)" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini (Rápido)" },
  { value: "openai/gpt-5", label: "GPT-5 (Avançado)" },
];

const RESPONSE_MODES = [
  { value: "detailed", label: "Detalhado" },
  { value: "summary", label: "Resumido" },
  { value: "technical", label: "Técnico" },
];

const DEFAULT_PROMPT = `Você é um especialista sênior em Meta Ads (Facebook e Instagram Ads), com profundo conhecimento em estratégias de performance, otimização de campanhas e análise de métricas.

INSTRUÇÕES:
- Responda SEMPRE em português brasileiro
- Seja preciso e use os dados reais fornecidos
- Ao analisar campanhas, cite nomes e métricas específicas
- Identifique anomalias: CTR abaixo de 1%, CPC acima da média do setor, frequência alta (>3)
- Ao sugerir otimizações, explique o raciocínio com base nos dados
- Sugira públicos baseados no targeting existente
- Quando criar briefings de novas campanhas, seja detalhado: objetivo, público-alvo, orçamento sugerido, posicionamentos recomendados, tipos de criativo
- Compare performance entre campanhas quando relevante
- Use formatação markdown para listas e destaques
- Se algum dado estiver ausente, informe e sugira como obtê-lo`;

export function TrafficSettings({ organizationId }: Props) {
  const { toast } = useToast();
  const { validateToken } = useAdAccounts(organizationId);
  const [tokenStatus, setTokenStatus] = useState<{ valid: boolean; name?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingAI, setSavingAI] = useState(false);
  const [repairing, setRepairing] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ['current-user-traffic-settings'],
    queryFn: getCurrentConsultant,
  });
  const isSuper = currentUser ? isSuperAdmin(currentUser.role) : false;

  // AI config state
  const [aiModel, setAiModel] = useState("google/gemini-3-flash-preview");
  const [aiPrompt, setAiPrompt] = useState(DEFAULT_PROMPT);
  const [aiTemperature, setAiTemperature] = useState(0.5);
  const [aiResponseMode, setAiResponseMode] = useState("detailed");

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
      setAiModel((data as any).ai_model || "google/gemini-3-flash-preview");
      setAiPrompt((data as any).ai_system_prompt || DEFAULT_PROMPT);
      setAiTemperature(Number((data as any).ai_temperature) || 0.5);
      setAiResponseMode((data as any).ai_response_mode || "detailed");
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
      .upsert({ organization_id: organizationId, ai_enabled: enabled } as any, { onConflict: "organization_id" });
    if (error) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
      setAiEnabled(!enabled);
    }
  };

  const saveAIConfig = async () => {
    setSavingAI(true);
    const { error } = await supabase
      .from("traffic_settings")
      .upsert({
        organization_id: organizationId,
        ai_enabled: aiEnabled,
        ai_model: aiModel,
        ai_system_prompt: aiPrompt === DEFAULT_PROMPT ? null : aiPrompt,
        ai_temperature: aiTemperature,
        ai_response_mode: aiResponseMode,
      } as any, { onConflict: "organization_id" });
    
    if (error) {
      toast({ title: "Erro ao salvar configurações da IA", variant: "destructive" });
    } else {
      toast({ title: "Configurações da IA salvas!" });
    }
    setSavingAI(false);
  };

  const repairHistory = async () => {
    if (!isSuper) return;
    setRepairing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-fill-gap", {
        body: { organization_id: organizationId, days_back: 90 },
      });
      if (error) throw error;
      const filled = (data as any)?.filled || [];
      const totalDays = filled.reduce((acc: number, r: any) => acc + (r.days_filled || 0), 0);
      const accountsWithGaps = filled.filter((r: any) => (r.gaps || 0) > 0).length;
      toast({
        title: "Histórico reparado",
        description: `${totalDays} dia(s) preenchido(s) em ${accountsWithGaps} conta(s).`,
      });
    } catch (e: any) {
      toast({ title: "Erro ao reparar histórico", description: e.message, variant: "destructive" });
    } finally {
      setRepairing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
              <span className="font-medium text-foreground">Diária + ao abrir o painel</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Primeira sincronização</span>
              <span className="font-medium text-foreground">90 dias de histórico</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Sincronizações seguintes</span>
              <span className="font-medium text-foreground">Últimos 3 dias + hoje (incremental)</span>
            </div>
          </div>
          {isSuper && (
            <div className="pt-2">
              <Button
                onClick={repairHistory}
                disabled={repairing}
                variant="outline"
                size="sm"
                className="w-full"
              >
                {repairing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Wrench className="h-4 w-4 mr-1.5" />}
                Reparar histórico (preencher dias faltantes)
              </Button>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Detecta lacunas nos últimos 90 dias e busca os dias faltantes da Meta API.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Toggle - starts column 2 on desktop */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Assistente IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingSettings ? (
            <div className="h-8 bg-muted animate-pulse rounded" />
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-sm font-medium">Ativar módulo de IA</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Quando ativado, mostra análises e sugestões com IA para suas campanhas
                  </p>
                </div>
                <Switch checked={aiEnabled} onCheckedChange={toggleAI} />
              </div>
              <Badge variant={aiEnabled ? "default" : "secondary"} className="text-xs font-medium">
                {aiEnabled ? "IA Ativada" : "IA Desativada"}
              </Badge>
            </>
          )}
        </CardContent>
      </Card>

      {/* AI Configuration - spans full width */}
      {aiEnabled && !loadingSettings && (
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Configurações da IA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Model */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Modelo de IA</Label>
              <Select value={aiModel} onValueChange={setAiModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_MODELS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Modelos mais avançados são mais precisos mas podem ser mais lentos</p>
            </div>

            {/* Temperature */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Temperatura</Label>
                <span className="text-xs font-mono text-muted-foreground">{aiTemperature.toFixed(1)}</span>
              </div>
              <Slider
                value={[aiTemperature]}
                onValueChange={([v]) => setAiTemperature(v)}
                min={0}
                max={1}
                step={0.1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Valores baixos = respostas mais precisas. Valores altos = respostas mais criativas.
              </p>
            </div>

            {/* Response Mode */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Modo de resposta</Label>
              <Select value={aiResponseMode} onValueChange={setAiResponseMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESPONSE_MODES.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* System Prompt */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Prompt do sistema</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setAiPrompt(DEFAULT_PROMPT)}
                >
                  Restaurar padrão
                </Button>
              </div>
              <Textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                className="min-h-[200px] text-xs font-mono"
                placeholder="Instruções para o assistente de IA..."
              />
              <p className="text-xs text-muted-foreground">
                Personalize como a IA analisa e responde sobre suas campanhas
              </p>
            </div>

            <Button onClick={saveAIConfig} disabled={savingAI} className="w-full">
              {savingAI ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
              Salvar Configurações
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
