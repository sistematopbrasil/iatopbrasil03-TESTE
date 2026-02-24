import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { getCurrentConsultant } from '@/lib/consultant-context';
import { useAIConfig, AIConfigFormData } from '@/hooks/useAIConfig';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save, Bot, Brain, Shield, Cog, Clock, Lock, Play, Sparkles, MessageSquare, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function AdminAIConfig() {
  const { data: currentUser, isLoading: loadingUser } = useQuery({
    queryKey: ['current-user-ai'],
    queryFn: getCurrentConsultant,
  });

  const { config, isLoading, defaultConfig, save, isSaving } = useAIConfig();
  const [formData, setFormData] = useState<AIConfigFormData>(defaultConfig);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Fetch AI usage stats (must be before early returns to respect Rules of Hooks)
  const aiEnabled = !!(currentUser as any)?.ai_enabled;
  const { data: aiStats } = useQuery({
    queryKey: ['ai-usage-stats', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return { totalMessages: 0, totalTokens: 0, activeConversations: 0 };
      const { data } = await supabase
        .from('ai_conversation_state')
        .select('messages_sent, total_tokens_used, is_active, permanently_disabled')
        .eq('user_id', currentUser.id);
      if (!data) return { totalMessages: 0, totalTokens: 0, activeConversations: 0 };
      return {
        totalMessages: data.reduce((sum, s) => sum + (s.messages_sent || 0), 0),
        totalTokens: data.reduce((sum, s) => sum + (s.total_tokens_used || 0), 0),
        activeConversations: data.filter(s => s.is_active && !s.permanently_disabled).length,
      };
    },
    enabled: aiEnabled,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (config) {
      setFormData({
        agent_name: config.agent_name || defaultConfig.agent_name,
        description: config.description,
        persona: config.persona,
        skills: config.skills,
        products_info: config.products_info,
        restrictions: config.restrictions,
        objective: config.objective,
        api_provider: config.api_provider,
        api_key_encrypted: config.api_key_encrypted,
        model: config.model,
        temperature: Number(config.temperature),
        max_tokens: config.max_tokens,
        auto_reply: config.auto_reply,
        pause_on_human_minutes: config.pause_on_human_minutes,
        greeting_message: config.greeting_message,
        farewell_message: config.farewell_message,
        working_hours_only: config.working_hours_only,
        working_hours_start: config.working_hours_start || '08:00',
        working_hours_end: config.working_hours_end || '18:00',
        auto_pipeline: config.auto_pipeline,
        transcribe_audio: config.transcribe_audio,
        analyze_images: config.analyze_images,
      });
    }
  }, [config]);

  const update = (field: keyof AIConfigFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loadingUser || isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  // Check if AI is enabled for this consultant
  if (currentUser && !(currentUser as any).ai_enabled) {
    return (
      <AdminLayout>
        <div className="p-4 md:p-6 flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md w-full text-center">
            <CardContent className="pt-8 pb-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                <Lock className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Agente IA não habilitado</h2>
              <p className="text-muted-foreground text-sm">
                O Agente IA ainda não foi ativado para sua conta. 
                Solicite ao administrador para habilitar este recurso.
              </p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }




  const modelOptions: Record<string, { label: string; value: string }[]> = {
    lovable: [
      { label: 'Gemini 3 Flash (Rápido)', value: 'google/gemini-3-flash-preview' },
      { label: 'Gemini 2.5 Flash', value: 'google/gemini-2.5-flash' },
    ],
    openai: [
      { label: 'GPT-4o Mini (Rápido)', value: 'gpt-4o-mini' },
      { label: 'GPT-4o (Avançado)', value: 'gpt-4o' },
      { label: 'GPT-4.1 Mini', value: 'gpt-4.1-mini' },
      { label: 'GPT-4.1', value: 'gpt-4.1' },
    ],
    google: [
      { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
      { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
    ],
    anthropic: [
      { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022' },
      { label: 'Claude 3.5 Haiku', value: 'claude-3-5-haiku-20241022' },
    ],
  };

  const currentModels = modelOptions[formData.api_provider] || modelOptions.lovable;

  const handleTestConfig = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('ai-agent-test', {
        body: {
          agent_name: formData.agent_name,
          persona: formData.persona,
          objective: formData.objective,
          skills: formData.skills,
          products_info: formData.products_info,
          restrictions: formData.restrictions,
          api_provider: formData.api_provider,
          api_key_encrypted: formData.api_provider !== 'lovable' ? formData.api_key_encrypted : undefined,
          model: formData.model,
          temperature: formData.temperature,
          max_tokens: formData.max_tokens,
          test_message: 'Olá, gostaria de saber mais sobre proteção veicular.',
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setTestResult(data.response || 'Sem resposta');
      toast.success('Teste concluído!');
    } catch (e: any) {
      toast.error('Erro no teste: ' + e.message);
      setTestResult(null);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6 overflow-hidden min-w-0 max-w-full">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
            <Bot className="w-8 h-8 text-primary" />
            Agente IA
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure seu assistente de IA para atendimento automatizado
          </p>
        </div>

        {/* Global AI Toggle */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4 px-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Agente IA Ativo</p>
                <p className="text-xs text-muted-foreground">
                  {formData.auto_reply
                    ? 'A IA está respondendo automaticamente'
                    : 'A IA não está respondendo automaticamente'}
                </p>
              </div>
            </div>
            <Switch
              checked={formData.auto_reply}
              onCheckedChange={(v) => {
                update('auto_reply', v);
                save({ ...formData, auto_reply: v });
              }}
            />
          </CardContent>
        </Card>

        {/* Usage Stats */}
        {aiStats && (aiStats.totalMessages > 0 || aiStats.activeConversations > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <MessageSquare className="w-4 h-4" />
                Mensagens IA
              </div>
              <p className="text-2xl font-bold text-foreground">{aiStats.totalMessages}</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Zap className="w-4 h-4" />
                Tokens Usados
              </div>
              <p className="text-2xl font-bold text-foreground">{aiStats.totalTokens.toLocaleString()}</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Bot className="w-4 h-4" />
                Conversas Ativas
              </div>
              <p className="text-2xl font-bold text-foreground">{aiStats.activeConversations}</p>
            </Card>
          </div>
        )}

        <Tabs defaultValue="identity" className="w-full">
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <TabsList className="inline-flex w-auto min-w-full sm:w-full gap-1">
              <TabsTrigger value="identity" className="text-xs sm:text-sm whitespace-nowrap flex-1">
                <Bot className="w-4 h-4 mr-1 sm:mr-1.5" />
                <span className="hidden sm:inline">Identidade</span>
                <span className="sm:hidden">ID</span>
              </TabsTrigger>
              <TabsTrigger value="knowledge" className="text-xs sm:text-sm whitespace-nowrap flex-1">
                <Brain className="w-4 h-4 mr-1 sm:mr-1.5" />
                <span className="hidden sm:inline">Conhecimento</span>
                <span className="sm:hidden">Dados</span>
              </TabsTrigger>
              <TabsTrigger value="engine" className="text-xs sm:text-sm whitespace-nowrap flex-1">
                <Cog className="w-4 h-4 mr-1 sm:mr-1.5" />
                <span className="hidden sm:inline">Motor IA</span>
                <span className="sm:hidden">Motor</span>
              </TabsTrigger>
              <TabsTrigger value="behavior" className="text-xs sm:text-sm whitespace-nowrap flex-1">
                <Clock className="w-4 h-4 mr-1 sm:mr-1.5" />
                <span className="hidden sm:inline">Comportamento</span>
                <span className="sm:hidden">Config</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Identity Tab */}
          <TabsContent value="identity" className="space-y-6 min-w-0">
            <Card>
              <CardHeader>
                <CardTitle>Identidade do Agente</CardTitle>
                <CardDescription>Defina quem é o seu assistente e como ele deve se comportar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Agente</Label>
                    <Input 
                      value={formData.agent_name} 
                      onChange={e => update('agent_name', e.target.value)}
                      placeholder="Ex: Ana, Assistente TOP"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Objetivo Principal</Label>
                    <Input 
                      value={formData.objective || ''} 
                      onChange={e => update('objective', e.target.value)}
                      placeholder="Ex: Qualificar leads para proteção veicular"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descrição Curta</Label>
                  <Input 
                    value={formData.description || ''} 
                    onChange={e => update('description', e.target.value)}
                    placeholder="Ex: Assistente virtual da TOP Brasil"
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    Persona e Tom de Voz
                    <span className="text-xs text-muted-foreground ml-2">
                      ({(formData.persona || '').length}/2000)
                    </span>
                  </Label>
                  <Textarea 
                    value={formData.persona || ''} 
                    onChange={e => update('persona', e.target.value.slice(0, 2000))}
                    placeholder="Descreva a personalidade do agente. Ex: Você é a Ana, uma consultora simpática e profissional da TOP Brasil. Fale de forma informal mas respeitosa, use emojis moderadamente..."
                    rows={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    Restrições
                    <span className="text-xs text-muted-foreground ml-2">
                      ({(formData.restrictions || '').length}/2000)
                    </span>
                  </Label>
                  <Textarea 
                    value={formData.restrictions || ''} 
                    onChange={e => update('restrictions', e.target.value.slice(0, 2000))}
                    placeholder="O que a IA NÃO deve fazer. Ex: Nunca fale mal de concorrentes, não invente preços, não prometa prazos..."
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Knowledge Tab */}
          <TabsContent value="knowledge" className="space-y-6 min-w-0">
            <Card>
              <CardHeader>
                <CardTitle>Base de Conhecimento</CardTitle>
                <CardDescription>Informe o que a IA precisa saber para atender bem</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 overflow-hidden">
                <div className="space-y-2">
                  <Label>
                    Habilidades e Roteiro
                    <span className="text-xs text-muted-foreground ml-2">
                      ({(formData.skills || '').length}/20000)
                    </span>
                  </Label>
                  <Textarea 
                    value={formData.skills || ''} 
                    onChange={e => update('skills', e.target.value.slice(0, 20000))}
                    placeholder="Descreva o roteiro de atendimento e as habilidades da IA. Ex: 1) Cumprimentar o lead pelo nome. 2) Perguntar se tem interesse em proteção veicular. 3) Explicar os benefícios..."
                    rows={8}
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    Informações sobre Produtos e Serviços
                    <span className="text-xs text-muted-foreground ml-2">
                      ({(formData.products_info || '').length}/20000)
                    </span>
                  </Label>
                  <Textarea 
                    value={formData.products_info || ''} 
                    onChange={e => update('products_info', e.target.value.slice(0, 20000))}
                    placeholder="Detalhe os produtos/serviços que a IA deve conhecer. Ex: TOP Brasil oferece proteção veicular com cobertura contra roubo, furto, colisão..."
                    rows={8}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Engine Tab */}
          <TabsContent value="engine" className="space-y-6 min-w-0">
            <Card>
              <CardHeader>
                <CardTitle>Motor de IA</CardTitle>
                <CardDescription>Configure o provedor e modelo de inteligência artificial</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Provedor</Label>
                    <Select value={formData.api_provider} onValueChange={v => {
                      update('api_provider', v);
                      update('model', modelOptions[v]?.[0]?.value || 'google/gemini-3-flash-preview');
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lovable">
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-primary" />
                            Lovable AI (Incluso)
                          </span>
                        </SelectItem>
                        <SelectItem value="openai">OpenAI (API Key própria)</SelectItem>
                        <SelectItem value="google">Google Gemini (API Key própria)</SelectItem>
                        <SelectItem value="anthropic">Anthropic Claude (API Key própria)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Modelo</Label>
                    <Select value={formData.model} onValueChange={v => update('model', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {currentModels.map(m => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formData.api_provider === 'lovable' && (
                  <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <p className="text-sm text-foreground flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
                      <span>Lovable AI está incluso no seu plano. Nenhuma API Key é necessária!</span>
                    </p>
                  </div>
                )}

                {formData.api_provider !== 'lovable' && (
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <Input 
                      type="password"
                      value={formData.api_key_encrypted || ''} 
                      onChange={e => update('api_key_encrypted', e.target.value)}
                      placeholder="sk-..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Sua chave será armazenada de forma segura
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Temperatura: {formData.temperature}</Label>
                  <Slider 
                    value={[formData.temperature]} 
                    onValueChange={([v]) => update('temperature', v)}
                    min={0} max={1} step={0.1}
                  />
                  <p className="text-xs text-muted-foreground">
                    Menor = mais preciso e consistente. Maior = mais criativo e variado.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Máximo de Tokens por Resposta</Label>
                  <Input 
                    type="number"
                    value={formData.max_tokens} 
                    onChange={e => update('max_tokens', parseInt(e.target.value) || 500)}
                    min={100} max={4000}
                  />
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-medium text-sm">Multimodalidade</h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Transcrever Áudios</Label>
                      <p className="text-xs text-muted-foreground">Usa Whisper API para entender áudios recebidos</p>
                    </div>
                    <Switch checked={formData.transcribe_audio} onCheckedChange={v => update('transcribe_audio', v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Analisar Imagens</Label>
                      <p className="text-xs text-muted-foreground">Usa visão computacional para entender imagens</p>
                    </div>
                    <Switch checked={formData.analyze_images} onCheckedChange={v => update('analyze_images', v)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Behavior Tab */}
          <TabsContent value="behavior" className="space-y-6 min-w-0">
            <Card>
              <CardHeader>
                <CardTitle>Comportamento</CardTitle>
                <CardDescription>Configure como e quando a IA deve agir</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Resposta Automática</Label>
                    <p className="text-xs text-muted-foreground">IA responde automaticamente novas mensagens</p>
                  </div>
                  <Switch checked={formData.auto_reply} onCheckedChange={v => update('auto_reply', v)} />
                </div>

                <div className="space-y-2">
                  <Label>Tempo de Pausa ao Intervir (minutos)</Label>
                  <Input 
                    type="number"
                    value={formData.pause_on_human_minutes} 
                    onChange={e => update('pause_on_human_minutes', parseInt(e.target.value) || 120)}
                    min={5} max={1440}
                  />
                  <p className="text-xs text-muted-foreground">
                    Quando você enviar uma mensagem manualmente, a IA pausará por este período
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Mensagem de Saudação</Label>
                  <Textarea 
                    value={formData.greeting_message || ''} 
                    onChange={e => update('greeting_message', e.target.value)}
                    placeholder="Ex: Olá! 👋 Sou a Ana da TOP Brasil. Como posso te ajudar?"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Mensagem de Encerramento</Label>
                  <Textarea 
                    value={formData.farewell_message || ''} 
                    onChange={e => update('farewell_message', e.target.value)}
                    placeholder="Ex: Foi ótimo conversar com você! Qualquer dúvida, estou aqui. 😊"
                    rows={3}
                  />
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Horário Comercial</Label>
                      <p className="text-xs text-muted-foreground">IA só responde em horário comercial</p>
                    </div>
                    <Switch checked={formData.working_hours_only} onCheckedChange={v => update('working_hours_only', v)} />
                  </div>

                  {formData.working_hours_only && (
                    <div className="grid grid-cols-2 gap-4 pl-4">
                      <div className="space-y-2">
                        <Label>Início</Label>
                        <Input 
                          type="time" 
                          value={formData.working_hours_start} 
                          onChange={e => update('working_hours_start', e.target.value)} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Fim</Label>
                        <Input 
                          type="time" 
                          value={formData.working_hours_end} 
                          onChange={e => update('working_hours_end', e.target.value)} 
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Pipeline Automático</Label>
                      <p className="text-xs text-muted-foreground">IA move leads entre quadros automaticamente baseado na conversa</p>
                    </div>
                    <Switch checked={formData.auto_pipeline} onCheckedChange={v => update('auto_pipeline', v)} />
                  </div>
                  {formData.auto_pipeline && (
                    <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 space-y-2">
                      <p className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Zap className="w-4 h-4 text-primary" />
                        Como funciona o Pipeline Automático
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
                        <li>A cada mensagem respondida, a IA analisa o contexto da conversa</li>
                        <li>Com base no interesse e qualificação do lead, sugere o quadro mais adequado</li>
                        <li>Se detectar alta intenção de compra, move para quadros avançados</li>
                        <li>Se o lead perder interesse, pode mover para quadros iniciais</li>
                        <li>As mudanças aparecem em tempo real no Pipeline de Vendas</li>
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Test Result */}
        {testResult && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" />
                Resposta do Teste
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{testResult}</p>
            </CardContent>
          </Card>
        )}

        {/* Save & Test Buttons - Always visible */}
        <div className="sticky bottom-4 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={handleTestConfig}
            disabled={isTesting}
            size="lg"
            className="shadow-lg bg-background"
            title="Envia uma mensagem de teste para verificar se a IA responde corretamente com as configurações atuais"
          >
            {isTesting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Testar Configuração
          </Button>
          <Button onClick={() => save(formData)} disabled={isSaving} size="lg" className="shadow-lg">
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar Configurações
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
