import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  X, Phone, Mail, Calendar, MapPin, Briefcase, Car, TrendingUp, 
  Star, User, Target, BarChart, AlertCircle, 
  CheckCircle, Tag, Loader2, Send, Plus
} from 'lucide-react';
import { Conversation } from '@/lib/crm-service';
import { TemperatureBadge } from '@/components/ui/temperature-badge';
import { supabase } from '@/integrations/supabase/client';
import { normalizePhone } from '@/lib/phone-utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useTags, CRMTag } from './TagsManager';
import { NotesSection } from './NotesSection';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface LeadProfileProps {
  conversation: Conversation;
  onClose: () => void;
}

interface LeadData {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  age: number | null;
  location: string | null;
  temperature: 'hot' | 'warm' | 'cold' | null;
  lead_score: number | null;
  pipeline_stage_id: string | null;
  employment_status: string | null;
  current_job: string | null;
  has_vehicle: string | null;
  has_driver_license: string | null;
  sales_experience: string | null;
  vehicle_protection_experience: string | null;
  desired_income: string | null;
  motivation: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  device_type: string | null;
  browser: string | null;
  created_at: string;
  notes: string | null;
}

export function LeadProfile({ conversation, onClose }: LeadProfileProps) {
  const [leadData, setLeadData] = useState<LeadData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [leadTags, setLeadTags] = useState<string[]>([]);
  const { tags: allTags, isLoading: tagsLoading } = useTags();
  const queryClient = useQueryClient();

  // ✅ Buscar stages do pipeline do BANCO (sem hardcoded)
  const { data: pipelineStages = [] } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: async () => {
      const { data } = await supabase
        .from('pipeline_stages')
        .select('*')
        .order('order_index', { ascending: true });
      return data || [];
    },
  });

  useEffect(() => {
    loadLeadData();
  }, [conversation.id, conversation.contact_phone]);

  useEffect(() => {
    if (conversation.id) {
      loadConversationTags();
    }
  }, [conversation.id]);

  async function loadLeadData() {
    setIsLoading(true);
    try {
      if (conversation.lead_id) {
        const { data, error } = await supabase
          .from('quiz_submissions_new')
          .select('*')
          .eq('id', conversation.lead_id)
          .single();

        if (!error && data) {
          setLeadData(data as LeadData);
          setIsLoading(false);
          return;
        }
      }

      // ✅ USA normalizePhone para buscar
      const normalizedPhone = normalizePhone(conversation.contact_phone);

      const { data, error } = await supabase
        .from('quiz_submissions_new')
        .select('*')
        .eq('phone', normalizedPhone)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setLeadData(data as LeadData | null);
    } catch (error) {
      console.error('Error loading lead data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadConversationTags() {
    try {
      const { data, error } = await supabase
        .from('crm_conversation_tags')
        .select('tag_id')
        .eq('conversation_id', conversation.id);

      if (error) throw error;
      setLeadTags(data?.map(t => t.tag_id) || []);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  }

  // ✅ ATUALIZADO - Cria lead automaticamente se não existir
  async function handleStageChange(newStageId: string) {
    try {
      // Se não temos lead mas queremos adicionar ao pipeline, criar lead básico
      if (!leadData) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: userData } = await supabase.from('users')
          .select('id, organization_id')
          .eq('auth_user_id', user?.id)
          .single();
        
        if (!userData) throw new Error('Usuário não encontrado');
        
        const normalizedPhone = normalizePhone(conversation.contact_phone);
        
        const { data: newLead, error: createError } = await supabase
          .from('quiz_submissions_new')
          .insert({
            name: conversation.contact_name,
            phone: normalizedPhone,
            organization_id: userData.organization_id,
            consultant_id: userData.id,
            pipeline_stage_id: newStageId,
            temperature: 'warm',
            completion_percentage: 0,
          })
          .select()
          .single();
        
        if (createError) throw createError;
        
        // Vincular lead à conversa
        await supabase
          .from('crm_conversations')
          .update({ lead_id: newLead.id })
          .eq('id', conversation.id);
        
        setLeadData(newLead as LeadData);
        const stageName = pipelineStages.find(s => s.id === newStageId)?.name || 'Novo quadro';
        toast.success(`Lead criado e movido para ${stageName}!`);
        queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        return;
      }
      
      // Se já tem lead, apenas atualizar
      const { error } = await supabase
        .from('quiz_submissions_new')
        .update({ pipeline_stage_id: newStageId })
        .eq('id', leadData.id);

      if (error) throw error;
      
      setLeadData({ ...leadData, pipeline_stage_id: newStageId });
      const stageName = pipelineStages.find(s => s.id === newStageId)?.name || 'Novo quadro';
      toast.success(`Lead movido para ${stageName}`);
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (error) {
      console.error('Erro ao atualizar quadro:', error);
      toast.error('Erro ao atualizar quadro');
    }
  }

  async function handleRemoveFromPipeline() {
    if (!leadData) return;
    
    try {
      const { error } = await supabase
        .from('quiz_submissions_new')
        .update({ pipeline_stage_id: null })
        .eq('id', leadData.id);

      if (error) throw error;
      
      setLeadData({ ...leadData, pipeline_stage_id: null });
      toast.success('Lead removido do pipeline');
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (error) {
      toast.error('Erro ao remover do pipeline');
    }
  }

  async function handleAddTag(tagId: string) {
    try {
      const { error } = await supabase
        .from('crm_conversation_tags')
        .insert({
          conversation_id: conversation.id,
          tag_id: tagId,
        });

      if (error) throw error;
      setLeadTags([...leadTags, tagId]);
      toast.success('Tag adicionada!');
    } catch (error: any) {
      if (error.code === '23505') {
        toast.info('Tag já adicionada');
      } else {
        toast.error('Erro ao adicionar tag');
      }
    }
  }

  async function handleRemoveTag(tagId: string) {
    try {
      const { error } = await supabase
        .from('crm_conversation_tags')
        .delete()
        .eq('conversation_id', conversation.id)
        .eq('tag_id', tagId);

      if (error) throw error;
      setLeadTags(leadTags.filter(t => t !== tagId));
      toast.success('Tag removida!');
    } catch (error) {
      toast.error('Erro ao remover tag');
    }
  }

  const getTagById = (id: string): CRMTag | undefined => allTags.find(t => t.id === id);

  // Encontrar stage atual
  const currentStage = pipelineStages.find(s => s.id === leadData?.pipeline_stage_id);

  if (isLoading) {
    return (
      <Card className="glass-card h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Carregando perfil...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Content - Scrollable (Header removido - já existe no Sheet) */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="w-24 h-24 rounded-full overflow-hidden shadow-glow">
                {conversation.contact_avatar ? (
                  <img 
                    src={conversation.contact_avatar} 
                    alt={leadData?.name || conversation.contact_name || 'Avatar'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-primary-foreground font-bold text-3xl">
                    {(leadData?.name || conversation.contact_name)?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
            </div>
            <h4 className="font-bold text-foreground text-lg">
              {leadData?.name || conversation.contact_name || 'Sem nome'}
            </h4>
            <p className="text-sm text-muted-foreground font-mono">{conversation.contact_phone}</p>
            
            {leadData && (
              <div className="flex flex-col items-center gap-2 mt-3">
                {/* Pipeline Stage Badge - Proeminente */}
                {currentStage ? (
                  <Badge 
                    className="text-white px-3 py-1"
                    style={{ backgroundColor: currentStage.color }}
                  >
                    <Target className="w-3 h-3 mr-1" />
                    {currentStage.name}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Sem quadro definido
                  </Badge>
                )}
                
                <div className="flex items-center gap-2">
                  {leadData.temperature && (
                    <TemperatureBadge temperature={leadData.temperature} />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Tags Section */}
          <div className="space-y-3">
            <h5 className="font-semibold text-foreground text-sm border-b border-border pb-2 flex items-center gap-2">
              <Tag className="w-4 h-4 text-primary" />
              Tags
            </h5>
            <div className="flex flex-wrap gap-2">
              {leadTags.map((tagId) => {
                const tag = getTagById(tagId);
                if (!tag) return null;
                return (
                  <Badge
                    key={tagId}
                    style={{ backgroundColor: tag.color }}
                    className="text-white cursor-pointer hover:opacity-80"
                    onClick={() => handleRemoveTag(tagId)}
                  >
                    {tag.name}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                );
              })}
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-6 text-xs">
                    <Plus className="w-3 h-3 mr-1" />
                    Adicionar
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="glass-card w-48 p-2">
                  <div className="space-y-1">
                    {tagsLoading ? (
                      <div className="text-center py-2">
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      </div>
                    ) : allTags.filter(t => !leadTags.includes(t.id)).length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Nenhuma tag disponível
                      </p>
                    ) : (
                      allTags
                        .filter(t => !leadTags.includes(t.id))
                        .map((tag) => (
                          <button
                            key={tag.id}
                            onClick={() => handleAddTag(tag.id)}
                            className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted/50 transition-colors"
                          >
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: tag.color }}
                            />
                            <span className="text-sm">{tag.name}</span>
                          </button>
                        ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {leadData ? (
            <>
              {/* ✅ Pipeline Stage Selector - USA STAGES DO BANCO */}
              <div className="space-y-3">
                <h5 className="font-semibold text-foreground text-sm border-b border-border pb-2 flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Quadro no Pipeline
                </h5>
                <div className="space-y-2">
                  <Select 
                    value={leadData.pipeline_stage_id || 'none'} 
                    onValueChange={(value) => {
                      if (value === 'none') {
                        handleRemoveFromPipeline();
                      } else {
                        handleStageChange(value);
                      }
                    }}
                  >
                    <SelectTrigger className="glass">
                      <SelectValue placeholder="Selecione um quadro" />
                    </SelectTrigger>
                    <SelectContent className="glass-card">
                      <SelectItem value="none">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <X className="w-3 h-3" />
                          Remover do pipeline
                        </div>
                      </SelectItem>
                      {pipelineStages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: stage.color }} 
                            />
                            {stage.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Atalhos rápidos para mover */}
                  {pipelineStages.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {pipelineStages.slice(0, 4).map((stage) => (
                        <Button
                          key={stage.id}
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          style={{ 
                            borderColor: stage.color,
                            color: leadData.pipeline_stage_id === stage.id ? 'white' : stage.color,
                            backgroundColor: leadData.pipeline_stage_id === stage.id ? stage.color : 'transparent',
                            borderWidth: '1px',
                            borderStyle: 'solid'
                          }}
                          onClick={() => handleStageChange(stage.id)}
                        >
                          {stage.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Notes Section */}
              <NotesSection conversationId={conversation.id} />

              {/* Personal Info */}
              <div className="space-y-3">
                <h5 className="font-semibold text-foreground text-sm border-b border-border pb-2 flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  Informações Pessoais
                </h5>
                <div className="space-y-2">
                  <InfoRow icon={Phone} label="Telefone" value={conversation.contact_phone} />
                  {leadData.email && (
                    <InfoRow icon={Mail} label="Email" value={leadData.email} />
                  )}
                  {leadData.age && (
                    <InfoRow icon={Calendar} label="Idade" value={`${leadData.age} anos`} />
                  )}
                  {leadData.location && (
                    <InfoRow icon={MapPin} label="Localização" value={leadData.location} />
                  )}
                  {leadData.has_vehicle && (
                    <InfoRow icon={Car} label="Veículo" value={leadData.has_vehicle} />
                  )}
                  {leadData.has_driver_license && (
                    <InfoRow icon={Car} label="CNH" value={leadData.has_driver_license} />
                  )}
                </div>
              </div>

              {/* Professional Info */}
              <div className="space-y-3">
                <h5 className="font-semibold text-foreground text-sm border-b border-border pb-2 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary" />
                  Experiência Profissional
                </h5>
                <div className="space-y-2">
                  {leadData.employment_status && (
                    <InfoRow icon={Briefcase} label="Situação" value={leadData.employment_status} />
                  )}
                  {leadData.current_job && (
                    <InfoRow icon={Briefcase} label="Profissão" value={leadData.current_job} />
                  )}
                  {leadData.sales_experience && (
                    <InfoRow icon={TrendingUp} label="Exp. Vendas" value={leadData.sales_experience} />
                  )}
                  {leadData.vehicle_protection_experience && (
                    <InfoRow icon={Car} label="Exp. Proteção" value={leadData.vehicle_protection_experience} />
                  )}
                </div>
              </div>

              {/* Goals */}
              <div className="space-y-3">
                <h5 className="font-semibold text-foreground text-sm border-b border-border pb-2 flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Expectativas
                </h5>
                <div className="space-y-2">
                  {leadData.desired_income && (
                    <InfoRow icon={TrendingUp} label="Renda Desejada" value={leadData.desired_income} />
                  )}
                  {leadData.motivation && (
                    <InfoRow icon={Target} label="Motivação" value={leadData.motivation} />
                  )}
                </div>
              </div>

              {/* Tracking Info */}
              <div className="space-y-3">
                <h5 className="font-semibold text-foreground text-sm border-b border-border pb-2 flex items-center gap-2">
                  <BarChart className="w-4 h-4 text-primary" />
                  Origem do Lead
                </h5>
                <div className="space-y-2 text-xs">
                  <InfoRow icon={BarChart} label="Origem" value={leadData.utm_source || 'Direto'} />
                  {leadData.utm_campaign && (
                    <InfoRow icon={BarChart} label="Campanha" value={leadData.utm_campaign} />
                  )}
                  {leadData.device_type && (
                    <InfoRow icon={BarChart} label="Dispositivo" value={leadData.device_type} />
                  )}
                  {leadData.browser && (
                    <InfoRow icon={BarChart} label="Navegador" value={leadData.browser} />
                  )}
                  <InfoRow 
                    icon={Calendar} 
                    label="Quiz respondido" 
                    value={format(new Date(leadData.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} 
                  />
                </div>
              </div>

              {/* Quick Actions */}
              {currentStage && (
                <div className="space-y-2 pt-2">
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => {
                      const qualificadoStage = pipelineStages.find(s => 
                        s.name.toLowerCase().includes('qualificad')
                      );
                      if (qualificadoStage) {
                        handleStageChange(qualificadoStage.id);
                      }
                    }}
                    disabled={currentStage.name.toLowerCase().includes('qualificad')}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {currentStage.name.toLowerCase().includes('qualificad') 
                      ? 'Já Qualificado' 
                      : 'Marcar como Qualificado'}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Pipeline Stage Selector - Para contatos manuais */}
              <div className="space-y-3">
                <h5 className="font-semibold text-foreground text-sm border-b border-border pb-2 flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Quadro no Pipeline
                </h5>
                <div className="space-y-2">
                  <Select 
                    value="none" 
                    onValueChange={(value) => {
                      if (value !== 'none') {
                        toast.info('Este contato não está no pipeline de leads');
                      }
                    }}
                  >
                    <SelectTrigger className="glass">
                      <SelectValue placeholder="Selecione um quadro" />
                    </SelectTrigger>
                    <SelectContent className="glass-card">
                      <SelectItem value="none">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <AlertCircle className="w-3 h-3" />
                          Contato manual (sem quiz)
                        </div>
                      </SelectItem>
                      {pipelineStages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id} disabled>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: stage.color }} 
                            />
                            {stage.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Pipeline disponível apenas para leads do quiz
                  </p>
                </div>
              </div>

              {/* Notes Section - também para contatos manuais */}
              <NotesSection conversationId={conversation.id} />
              
              <Card className="glass p-6 text-center">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-amber-500" />
                <p className="text-sm text-muted-foreground mb-4">
                  Este contato ainda não respondeu o quiz de qualificação
                </p>
                <Button className="bg-primary hover:bg-primary/90" size="sm">
                  <Send className="w-4 h-4 mr-2" />
                  Enviar link do quiz
                </Button>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground break-words">{value}</p>
      </div>
    </div>
  );
}