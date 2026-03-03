import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Zap } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_PROMPTS: Record<string, string> = {
  'novos leads': 'Lead acabou de chegar, ainda sem interação significativa. Não mova leads para este quadro, é apenas o estado inicial.',
  'contato inicial': 'Lead respondeu mas ainda não demonstrou interesse claro. Mova para cá quando o lead responder pela primeira vez.',
  'qualificados': 'Lead demonstrou interesse real e ativo — pediu detalhes, agendou conversa, mostrou motivação genuína. Apenas responder perguntas NÃO é suficiente.',
  'descartados': 'Lead deixou MUITO claro em MAIS DE UMA mensagem que não quer participar. Uma única objeção ou hesitação NÃO é motivo para mover para cá.',
};

function getDefaultPrompt(stageName: string): string {
  const lower = stageName.toLowerCase();
  for (const [key, value] of Object.entries(DEFAULT_PROMPTS)) {
    if (lower.includes(key) || key.includes(lower)) return value;
  }
  return '';
}

interface Props {
  userId?: string;
  organizationId?: string;
}

export function PipelineStagePromptsEditor({ userId, organizationId }: Props) {
  const queryClient = useQueryClient();
  const [prompts, setPrompts] = useState<Record<string, string>>({});

  const { data: stages } = useQuery({
    queryKey: ['pipeline-stages-prompts', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data } = await supabase
        .from('pipeline_stages')
        .select('id, name, order_index')
        .eq('organization_id', organizationId)
        .order('order_index');
      return data || [];
    },
    enabled: !!organizationId,
  });

  const { data: savedPrompts, isLoading } = useQuery({
    queryKey: ['pipeline-stage-prompts', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from('pipeline_stage_prompts')
        .select('*')
        .eq('user_id', userId);
      return data || [];
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (!stages || !savedPrompts) return;
    const map: Record<string, string> = {};
    stages.forEach((s: any) => {
      const saved = savedPrompts.find((p: any) => p.stage_id === s.id);
      map[s.id] = saved ? saved.description : getDefaultPrompt(s.name);
    });
    setPrompts(map);
  }, [stages, savedPrompts]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !organizationId || !stages) return;
      for (const stage of stages) {
        const desc = prompts[stage.id] || '';
        const existing = savedPrompts?.find((p: any) => p.stage_id === stage.id);
        if (existing) {
          await supabase
            .from('pipeline_stage_prompts')
            .update({ description: desc })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('pipeline_stage_prompts')
            .insert({
              stage_id: stage.id,
              user_id: userId,
              organization_id: organizationId,
              description: desc,
            });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-stage-prompts'] });
      toast.success('Prompts do pipeline salvos!');
    },
    onError: () => toast.error('Erro ao salvar prompts'),
  });

  if (isLoading) return <Loader2 className="w-5 h-5 animate-spin text-primary" />;

  return (
    <div className="space-y-4">
      <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 space-y-2">
        <p className="text-sm font-medium text-foreground flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Configuração dos Quadros do Pipeline
        </p>
        <p className="text-xs text-muted-foreground">
          Explique para a IA o que cada quadro significa e quando deve mover um lead para lá.
        </p>
      </div>

      {stages?.map((stage: any) => (
        <div key={stage.id} className="space-y-1.5">
          <Label className="text-sm font-medium">{stage.name}</Label>
          <Textarea
            value={prompts[stage.id] || ''}
            onChange={e => setPrompts(prev => ({ ...prev, [stage.id]: e.target.value }))}
            placeholder={`Descreva quando um lead deve ser movido para "${stage.name}"...`}
            rows={2}
            className="text-sm"
          />
        </div>
      ))}

      <Button
        size="sm"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
      >
        {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
        Salvar Prompts
      </Button>
    </div>
  );
}
