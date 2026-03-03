import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Clock, MessageSquare, Bot } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  userId?: string;
  organizationId?: string;
}

interface FollowUpRule {
  id: string;
  name: string;
  is_active: boolean;
  delay_minutes: number;
  max_followups: number;
  message_type: string;
  fixed_message: string | null;
  ai_prompt: string | null;
  exclude_stages: string[];
  only_open_conversations: boolean;
  respect_working_hours: boolean;
}

const DELAY_OPTIONS = [
  { label: '30 minutos', value: 30 },
  { label: '1 hora', value: 60 },
  { label: '2 horas', value: 120 },
  { label: '4 horas', value: 240 },
  { label: '8 horas', value: 480 },
  { label: '24 horas', value: 1440 },
  { label: '48 horas', value: 2880 },
];

export function FollowUpRulesEditor({ userId, organizationId }: Props) {
  const queryClient = useQueryClient();
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  const { data: rules, isLoading } = useQuery({
    queryKey: ['followup-rules', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from('followup_rules')
        .select('*')
        .eq('user_id', userId)
        .order('created_at');
      return (data || []) as FollowUpRule[];
    },
    enabled: !!userId,
  });

  const { data: stages } = useQuery({
    queryKey: ['pipeline-stages-followup', organizationId],
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

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !organizationId) throw new Error('Not authenticated');
      // Default exclude stages: any with "descartado" or "consultor"
      const excludeIds = (stages || [])
        .filter((s: any) => {
          const lower = s.name.toLowerCase();
          return lower.includes('descartado') || lower.includes('consultor');
        })
        .map((s: any) => s.id);

      const { error } = await supabase.from('followup_rules').insert({
        user_id: userId,
        organization_id: organizationId,
        name: `Follow-up ${(rules?.length || 0) + 1}`,
        delay_minutes: 60,
        exclude_stages: excludeIds,
        ai_prompt: 'Envie uma mensagem de acompanhamento amigável perguntando se o lead ainda tem interesse.',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followup-rules'] });
      toast.success('Regra de follow-up criada!');
    },
    onError: () => toast.error('Erro ao criar regra'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FollowUpRule> }) => {
      const { error } = await supabase.from('followup_rules').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['followup-rules'] }),
    onError: () => toast.error('Erro ao atualizar'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('followup_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followup-rules'] });
      toast.success('Regra removida');
    },
    onError: () => toast.error('Erro ao remover'),
  });

  const toggleExcludeStage = (rule: FollowUpRule, stageId: string) => {
    const current = rule.exclude_stages || [];
    const newExclude = current.includes(stageId)
      ? current.filter(id => id !== stageId)
      : [...current, stageId];
    updateMutation.mutate({ id: rule.id, updates: { exclude_stages: newExclude } });
  };

  if (isLoading) return <Loader2 className="w-5 h-5 animate-spin text-primary" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Follow-up Automático
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Envie mensagens automáticas quando o lead não responder
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
          <Plus className="w-4 h-4 mr-1" />
          Nova Regra
        </Button>
      </div>

      {(!rules || rules.length === 0) && (
        <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg border-dashed">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Nenhuma regra de follow-up configurada.
          <br />
          Clique em "Nova Regra" para começar.
        </div>
      )}

      {rules?.map((rule) => (
        <Card key={rule.id} className="border">
          <CardContent className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Switch
                  checked={rule.is_active}
                  onCheckedChange={v => updateMutation.mutate({ id: rule.id, updates: { is_active: v } })}
                />
                <Input
                  value={rule.name}
                  onChange={e => updateMutation.mutate({ id: rule.id, updates: { name: e.target.value } })}
                  className="h-8 text-sm font-medium border-0 bg-transparent p-0 focus-visible:ring-0"
                />
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
                className="text-xs text-muted-foreground"
              >
                {expandedRule === rule.id ? 'Fechar' : 'Editar'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(rule.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>

            {/* Summary when collapsed */}
            {expandedRule !== rule.id && (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">
                  ⏱ {DELAY_OPTIONS.find(o => o.value === rule.delay_minutes)?.label || `${rule.delay_minutes}min`}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {rule.message_type === 'fixed' ? '📝 Fixa' : '🤖 IA'}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  Max: {rule.max_followups}x
                </Badge>
              </div>
            )}

            {/* Expanded editor */}
            {expandedRule === rule.id && (
              <div className="space-y-4 pt-2 border-t">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tempo sem resposta</Label>
                    <Select
                      value={String(rule.delay_minutes)}
                      onValueChange={v => updateMutation.mutate({ id: rule.id, updates: { delay_minutes: Number(v) } })}
                    >
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DELAY_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo de mensagem</Label>
                    <Select
                      value={rule.message_type}
                      onValueChange={v => updateMutation.mutate({ id: rule.id, updates: { message_type: v } })}
                    >
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ai_generated">
                          <span className="flex items-center gap-1"><Bot className="w-3 h-3" /> IA gera mensagem</span>
                        </SelectItem>
                        <SelectItem value="fixed">
                          <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Mensagem fixa</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Max follow-ups por conversa</Label>
                    <Input
                      type="number"
                      value={rule.max_followups}
                      onChange={e => updateMutation.mutate({ id: rule.id, updates: { max_followups: Number(e.target.value) || 1 } })}
                      min={1}
                      max={10}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                {rule.message_type === 'fixed' ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Mensagem fixa</Label>
                    <Textarea
                      value={rule.fixed_message || ''}
                      onChange={e => updateMutation.mutate({ id: rule.id, updates: { fixed_message: e.target.value } })}
                      placeholder="Ex: Olá! Vi que não conseguimos conversar. Ainda tem interesse?"
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Prompt para a IA</Label>
                    <Textarea
                      value={rule.ai_prompt || ''}
                      onChange={e => updateMutation.mutate({ id: rule.id, updates: { ai_prompt: e.target.value } })}
                      placeholder="Ex: Envie uma mensagem amigável de acompanhamento baseada no contexto da conversa."
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                )}

                {/* Exclude stages */}
                <div className="space-y-2">
                  <Label className="text-xs">NÃO enviar quando o lead estiver em:</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {stages?.map((stage: any) => {
                      const excluded = (rule.exclude_stages || []).includes(stage.id);
                      return (
                        <Badge
                          key={stage.id}
                          variant={excluded ? 'default' : 'outline'}
                          className={`cursor-pointer text-[10px] ${excluded ? 'bg-destructive/80 hover:bg-destructive' : 'hover:bg-muted'}`}
                          onClick={() => toggleExcludeStage(rule, stage.id)}
                        >
                          {stage.name}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.only_open_conversations}
                      onCheckedChange={v => updateMutation.mutate({ id: rule.id, updates: { only_open_conversations: v } })}
                    />
                    <Label className="text-xs">Só conversas abertas</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.respect_working_hours}
                      onCheckedChange={v => updateMutation.mutate({ id: rule.id, updates: { respect_working_hours: v } })}
                    />
                    <Label className="text-xs">Respeitar horário comercial</Label>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
