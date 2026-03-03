import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentConsultant, isSuperAdmin } from '@/lib/consultant-context';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { LeadCard } from './LeadCard';
import { toast } from 'sonner';
import { Loader2, TrendingUp, Phone, Sparkles, CheckCircle, XCircle, X, MessageCircle, User, MapPin, Briefcase, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Sem fallback com IDs falsos - stages DEVEM existir no banco

const getIconComponent = (iconName: string | null) => {
  switch (iconName) {
    case 'trending-up': return <TrendingUp className="w-5 h-5" />;
    case 'phone': return <Phone className="w-5 h-5" />;
    case 'sparkles': return <Sparkles className="w-5 h-5" />;
    case 'check-circle': return <CheckCircle className="w-5 h-5" />;
    case 'x-circle': return <XCircle className="w-5 h-5" />;
    case 'bell': return <Phone className="w-5 h-5" />; // Using Phone as bell alternative
    case 'calendar-check': return <CheckCircle className="w-5 h-5" />; // Using CheckCircle as calendar alternative
    case 'users': return <User className="w-5 h-5" />; // Using User for users
    default: return <TrendingUp className="w-5 h-5" />;
  }
};

export function PipelineBoard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedLead, setSelectedLead] = useState<any>(null);

  // ✅ Realtime subscription para atualizações automáticas
  useEffect(() => {
    const channel = supabase
      .channel('pipeline-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'quiz_submissions_new',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ['current-user-pipeline'],
    queryFn: getCurrentConsultant,
  });

  // Buscar stages customizados do banco - SOMENTE após ter usuário e organização
  const { data: customStages, isLoading: stagesLoading } = useQuery({
    queryKey: ['pipeline-stages', currentUser?.organization_id],
    queryFn: async () => {
      if (!currentUser?.organization_id) return null;
      
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('organization_id', currentUser.organization_id)
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentUser?.organization_id,
  });

  // Usar stages do banco - sem fallback com IDs falsos
  const stages = (customStages || []).map(s => ({ 
    id: s.id,
    name: s.name, 
    color: s.color, 
    icon: s.icon 
  }));

  // ✅ Busca TODOS os leads - incluindo os sem pipeline_stage_id
  const { data: leads, isLoading, error } = useQuery({
    queryKey: ['pipeline-leads', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];

      let query = supabase
        .from('quiz_submissions_new')
        .select('*')
        // ✅ REMOVIDO .not('pipeline_stage_id', 'is', null) - agora mostra TODOS
        .order('created_at', { ascending: false });

      if (!isSuperAdmin(currentUser.role)) {
        query = query.eq('consultant_id', currentUser.id);
      } else {
        query = query.eq('organization_id', currentUser.organization_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!currentUser,
    staleTime: 30 * 1000, // 30 segundos - dados mais frescos
  });

  // Helper para verificar se é stage "Novos Consultores"
  const isConsultorStage = (stageName: string | null | undefined) => {
    if (!stageName) return false;
    return stageName.toLowerCase().includes('consultor');
  };

  // ⚠️ Pontuação agora é gerenciada pelo trigger no banco (sync_ranking_consultants_recruited)
  // Este helper apenas exibe feedback visual, mas a lógica real está no backend
  const showPointsFeedback = (previousStageName: string | null, newStageName: string | null) => {
    const wasConsultor = isConsultorStage(previousStageName);
    const isNowConsultor = isConsultorStage(newStageName);

    if (!wasConsultor && isNowConsultor) {
      toast.success('🎯 +100 pontos! Lead se tornou consultor!');
    } else if (wasConsultor && !isNowConsultor) {
      toast.info('📉 -100 pontos - Lead removido de Consultor');
    }
    // Atualizar ranking na UI
    queryClient.invalidateQueries({ queryKey: ['ranking'] });
    queryClient.invalidateQueries({ queryKey: ['consultant-ranking'] });
  };

  const updateStageMutation = useMutation({
    mutationFn: async ({ leadId, newStageId, newStageName }: { leadId: string; newStageId: string; newStageName: string }) => {
      // Primeiro, buscar dados atuais do lead incluindo stage anterior
      const { data: lead, error: leadError } = await supabase
        .from('quiz_submissions_new')
        .select('consultant_id, organization_id, pipeline_stage_id')
        .eq('id', leadId)
        .single();
      
      if (leadError) throw leadError;
      
      const previousStageId = lead?.pipeline_stage_id;
      
      // Buscar nome do stage anterior
      let previousStageName: string | null = null;
      if (previousStageId) {
        const previousStage = stages.find(s => s.id === previousStageId);
        previousStageName = previousStage?.name || null;
      }
      
      // Atualizar para novo stage
      const { error: updateError } = await supabase
        .from('quiz_submissions_new')
        .update({ pipeline_stage_id: newStageId })
        .eq('id', leadId);

      if (updateError) throw updateError;
      
      return { 
        newStageName, 
        previousStageName,
        consultantId: lead?.consultant_id, 
        organizationId: lead?.organization_id 
      };
    },
    onSuccess: (data) => {
      // ⚠️ Pontuação agora é gerenciada pelo trigger no banco
      // Exibir feedback visual e invalidar ranking
      showPointsFeedback(data?.previousStageName, data?.newStageName);
      
      const wasConsultor = isConsultorStage(data?.previousStageName);
      const isNowConsultor = isConsultorStage(data?.newStageName);
      
      if (wasConsultor === isNowConsultor) {
        toast.success('Lead movido com sucesso!');
      }
      
      // Invalidar também leads gerais para refletir mudanças de temperatura
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      
      // Invalidar após sucesso para sincronizar com o servidor
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] });
    },
    onError: (error, variables) => {
      console.error('❌ Erro na mutation:', error);
      toast.error('Erro ao mover lead');
      // Reverter otimistic update ao invalidar query
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] });
    },
  });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const leadId = result.draggableId;
    const newStageId = result.destination.droppableId;
    const oldStageId = result.source.droppableId;

    if (oldStageId === newStageId) return;

    // ✅ Optimistic update - atualizar imediatamente na UI
    queryClient.setQueryData(['pipeline-leads', currentUser?.id], (oldData: any[] | undefined) => {
      if (!oldData) return oldData;
      return oldData.map(lead => 
        lead.id === leadId 
          ? { ...lead, pipeline_stage_id: newStageId }
          : lead
      );
    });

    // Encontrar o nome do novo stage
    const targetStage = stages.find(s => s.id === newStageId);
    const newStageName = targetStage?.name || '';

    updateStageMutation.mutate({ leadId, newStageId, newStageName });
  };

  // ✅ Leads sem stage aparecem na primeira coluna
  const getLeadsByStage = (stageId: string, isFirstStage: boolean = false) => {
    return leads?.filter((lead) => {
      if (isFirstStage) {
        // Primeira coluna: leads desta stage OU leads sem stage definido
        return lead.pipeline_stage_id === stageId || !lead.pipeline_stage_id;
      }
      return lead.pipeline_stage_id === stageId;
    }) || [];
  };

  // Navegar para CRM com os dados do lead
  const handleOpenConversation = (lead: any) => {
    navigate('/admin/crm', { 
      state: { 
        openConversation: true, 
        phone: lead.phone, 
        leadData: lead 
      } 
    });
  };

  if (userLoading || isLoading || stagesLoading) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <div className="flex gap-4 overflow-hidden px-4 w-full max-w-full">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[260px] md:w-[300px] space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-8 ml-auto rounded-full" />
              </div>
              {Array.from({ length: 3 - Math.floor(i / 2) }).map((_, j) => (
                <div key={j} className="rounded-lg border bg-card p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <div className="flex gap-2 pt-1">
                    <Skeleton className="h-5 w-12 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        Erro ao carregar leads. Tente novamente.
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center space-y-3 max-w-sm">
          <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-semibold text-foreground">Nenhum quadro configurado</h3>
          <p className="text-sm text-muted-foreground">
            Clique em "Gerenciar Quadros" para criar as colunas do seu pipeline.
          </p>
        </div>
      </div>
    );
  }

  const getTemperatureColor = (temp: string | null) => {
    if (temp === 'hot') return 'bg-orange-500';
    if (temp === 'warm') return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const getTemperatureLabel = (temp: string | null) => {
    if (temp === 'hot') return '🔥 Quente';
    if (temp === 'warm') return '🌡️ Morno';
    return '❄️ Frio';
  };

    return (
      <>
        <DragDropContext onDragEnd={handleDragEnd}>
          {stages.map((stage, index) => {
            const isFirstStage = index === 0;
            const stageLeads = getLeadsByStage(stage.id, isFirstStage);

            return (
              <Droppable key={stage.id} droppableId={stage.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "flex flex-col w-[260px] md:w-[300px] shrink-0 h-[calc(100dvh-180px)] md:h-[calc(100%-8px)] rounded-xl",
                      "bg-card/80 border border-border/60",
                      "shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)]",
                      snapshot.isDraggingOver && "bg-primary/10 border-primary/40 shadow-[inset_0_0_20px_rgba(235,102,8,0.1)]",
                    )}
                  >
                    {/* Header do Stage */}
                    <div
                      className="flex items-center justify-between p-3 rounded-t-xl border-b"
                      style={{ 
                        backgroundColor: `${stage.color}20`,
                        borderColor: `${stage.color}40`
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span 
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${stage.color}30` }}
                        >
                          {getIconComponent(stage.icon)}
                        </span>
                        <h3 className="font-semibold text-sm truncate">{stage.name}</h3>
                        <Badge 
                          variant="secondary" 
                          className="ml-1 flex-shrink-0 text-xs"
                          style={{ backgroundColor: `${stage.color}25`, color: stage.color }}
                        >
                          {stageLeads.length}
                        </Badge>
                      </div>
                    </div>

                    {/* Lista de Leads com scroll vertical - mouse wheel habilitado */}
                    <div 
                      data-pipeline-vertical-scroll="true"
                      className="flex-1 overflow-hidden"
                    >
                      <ScrollArea className="h-full p-2">
                        <div className="space-y-2">
                        {stageLeads.map((lead, index) => (
                          <Draggable key={lead.id} draggableId={lead.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={cn(
                                  "transition-all duration-200",
                                  snapshot.isDragging && "rotate-1 scale-[1.02] shadow-lg shadow-primary/20",
                                )}
                                style={{
                                  ...provided.draggableProps.style,
                                  touchAction: 'none',
                                }}
                              >
                                <LeadCard
                                  lead={lead}
                                  onOpenConversation={handleOpenConversation}
                                  onClick={() => setSelectedLead(lead)}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                          {provided.placeholder}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </DragDropContext>

        {/* Lead Details Popup */}
        <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
          <DialogContent className="max-w-md" aria-describedby="lead-details-description">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Detalhes do Lead
              </DialogTitle>
            </DialogHeader>
            <p id="lead-details-description" className="sr-only">Informações detalhadas do lead selecionado</p>
            
            {selectedLead && (
              <div className="space-y-4">
              {/* Nome e temperatura */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{selectedLead.name || 'Sem nome'}</h3>
                <Badge className={`${getTemperatureColor(selectedLead.temperature)} text-white`}>
                  {getTemperatureLabel(selectedLead.temperature)}
                </Badge>
              </div>


              {/* Informações */}
              <div className="space-y-2 text-sm">
                {selectedLead.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedLead.phone}</span>
                  </div>
                )}
                {selectedLead.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedLead.location}</span>
                  </div>
                )}
                {selectedLead.employment_status && (
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedLead.employment_status}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{format(new Date(selectedLead.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}</span>
                </div>
              </div>

              {/* Critérios de qualificação */}
              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Qualificação</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={selectedLead.relationship_status?.toLowerCase().includes('casado') ? 'text-green-500' : 'text-muted-foreground'}>
                      {selectedLead.relationship_status?.toLowerCase().includes('casado') ? '✓' : '✗'}
                    </span>
                    <span>Casado(a)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={selectedLead.has_vehicle && selectedLead.has_vehicle !== 'Não tenho veículo.' ? 'text-green-500' : 'text-muted-foreground'}>
                      {selectedLead.has_vehicle && selectedLead.has_vehicle !== 'Não tenho veículo.' ? '✓' : '✗'}
                    </span>
                    <span>Possui veículo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={selectedLead.has_driver_license?.toLowerCase().includes('sim') ? 'text-green-500' : 'text-muted-foreground'}>
                      {selectedLead.has_driver_license?.toLowerCase().includes('sim') ? '✓' : '✗'}
                    </span>
                    <span>Possui CNH</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={selectedLead.sales_experience?.toLowerCase().includes('já trabalho') || selectedLead.sales_experience?.toLowerCase().includes('já trabalhei') ? 'text-green-500' : 'text-muted-foreground'}>
                      {selectedLead.sales_experience?.toLowerCase().includes('já trabalho') || selectedLead.sales_experience?.toLowerCase().includes('já trabalhei') ? '✓' : '✗'}
                    </span>
                    <span>Exp. vendas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={selectedLead.vehicle_protection_experience?.toLowerCase() === 'sim' ? 'text-green-500' : 'text-muted-foreground'}>
                      {selectedLead.vehicle_protection_experience?.toLowerCase() === 'sim' ? '✓' : '✗'}
                    </span>
                    <span>Proteção veicular</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">💰</span>
                    <span className="truncate">{selectedLead.current_income || 'Não informado'}</span>
                  </div>
                </div>
              </div>

              {/* Respostas Adicionais (perguntas dinâmicas) */}
              {selectedLead.extra_answers && Object.keys(selectedLead.extra_answers).length > 0 && (
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Respostas Adicionais</p>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    {Object.entries(selectedLead.extra_answers as Record<string, { question: string; answer: string; order_index?: number }>)
                      .sort((a, b) => (a[1].order_index || 0) - (b[1].order_index || 0))
                      .map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center">
                          <span className="text-muted-foreground truncate">{value.question}:</span>
                          <span className="text-foreground font-medium truncate ml-2">{value.answer || '-'}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Botão de ação */}
              {selectedLead.phone && (
                <Button 
                  className="w-full" 
                  onClick={() => {
                    handleOpenConversation(selectedLead);
                    setSelectedLead(null);
                  }}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Abrir conversa no CRM
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
