import { useState } from 'react';
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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Stages padrão (fallback caso não existam no banco)
const DEFAULT_STAGES = [
  { id: 'default-novo', name: 'Novos Leads', color: '#3B82F6', icon: 'trending-up' },
  { id: 'default-contatado', name: 'Contato Inicial', color: '#8B5CF6', icon: 'phone' },
  { id: 'default-qualificado', name: 'Qualificados', color: '#F59E0B', icon: 'sparkles' },
  { id: 'default-convertido', name: 'Convertidos', color: '#10B981', icon: 'check-circle' },
  { id: 'default-descartado', name: 'Descartados', color: '#EF4444', icon: 'x-circle' },
];

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

  // Buscar stages customizados do banco
  const { data: customStages } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  // Usar stages customizados ou padrão - AGORA USA UUID DIRETAMENTE
  const stages = customStages && customStages.length > 0 
    ? customStages.map(s => ({ 
        id: s.id, // ✅ UUID direto
        name: s.name, 
        color: s.color, 
        icon: s.icon 
      }))
    : DEFAULT_STAGES;

  const { data: currentUser } = useQuery({
    queryKey: ['current-user-pipeline'],
    queryFn: getCurrentConsultant,
  });

  // ✅ REMOVIDO filtro completion_percentage=100 para mostrar leads incompletos também
  const { data: leads, isLoading, error } = useQuery({
    queryKey: ['pipeline-leads', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];

      let query = supabase
        .from('quiz_submissions_new')
        .select('*')
        .not('pipeline_stage_id', 'is', null) // Apenas leads com stage definido
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
  });

  // ✅ MUTATION ATUALIZADA - Usa pipeline_stage_id (UUID)
  // Função para adicionar pontos quando lead vai para "Novos Consultores"
  const addConversionPoints = async (consultantId: string | null, stageName: string) => {
    if (!consultantId) return;
    
    // Verificar se é o stage "Novos Consultores"
    if (stageName.toLowerCase().includes('novos consultores')) {
      console.log('🎯 Lead movido para Novos Consultores - Adicionando 100 pontos ao consultor:', consultantId);
      // Por enquanto só logamos, a lógica de ranking pode ser expandida depois
      toast.success('🎯 +100 pontos! Lead convertido em consultor!');
    }
  };

  const updateStageMutation = useMutation({
    mutationFn: async ({ leadId, newStageId, stageName }: { leadId: string; newStageId: string; stageName: string }) => {
      const { error } = await supabase
        .from('quiz_submissions_new')
        .update({ pipeline_stage_id: newStageId })
        .eq('id', leadId);

      if (error) throw error;
      
      // Buscar consultant_id do lead para dar pontos
      const { data: lead } = await supabase
        .from('quiz_submissions_new')
        .select('consultant_id')
        .eq('id', leadId)
        .single();

      return { stageName, consultantId: lead?.consultant_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] });
      
      // Adicionar pontos se for "Novos Consultores"
      if (data?.stageName) {
        addConversionPoints(data.consultantId, data.stageName);
      } else {
        toast.success('Lead movido com sucesso!');
      }
    },
    onError: () => {
      toast.error('Erro ao mover lead');
    },
  });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const leadId = result.draggableId;
    const newStageId = result.destination.droppableId; // ✅ Agora é UUID

    if (result.source.droppableId === newStageId) return;

    // Encontrar o nome do stage para verificar se é "Novos Consultores"
    const targetStage = stages.find(s => s.id === newStageId);
    const stageName = targetStage?.name || '';

    updateStageMutation.mutate({ leadId, newStageId, stageName });
  };

  // ✅ SIMPLIFICADO - Filtra direto por pipeline_stage_id (UUID)
  const getLeadsByStage = (stageId: string) => {
    return leads?.filter((lead) => lead.pipeline_stage_id === stageId) || [];
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Carregando pipeline...</p>
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
          <ScrollArea className="pipeline-board-scrollarea w-full whitespace-nowrap rounded-md">
            <div className="inline-flex gap-3 md:gap-4 h-full min-w-max pb-4 pr-8">
              {stages.map((stage) => {
                const stageLeads = getLeadsByStage(stage.id);

                return (
                  <Droppable key={stage.id} droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          "flex flex-col w-[280px] md:w-[320px] shrink-0 h-full",
                          snapshot.isDraggingOver && "bg-muted/50 rounded-lg",
                        )}
                      >
                        {/* Header do Stage */}
                        <div
                          className="flex items-center justify-between p-3 md:p-4 rounded-t-lg mb-2 md:mb-3"
                          style={{ backgroundColor: `${stage.color}15` }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-lg">{getIconComponent(stage.icon)}</span>
                            <h3 className="font-semibold text-sm md:text-base truncate">{stage.name}</h3>
                            <Badge variant="secondary" className="ml-1 flex-shrink-0">
                              {stageLeads.length}
                            </Badge>
                          </div>
                        </div>

                        {/* Lista de Leads */}
                        <ScrollArea className="flex-1 pr-2">
                          <div className="space-y-2 md:space-y-3">
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
                    )}
                  </Droppable>
                );
              })}
            </div>

            {/* ✅ Scrollbar horizontal visível (Radix) */}
            <ScrollBar orientation="horizontal" className="h-3 bg-muted/20" />
          </ScrollArea>

          {/* Estilos de cor (brand) para scrollbar do Radix */}
          <style>{`
            .pipeline-board-scrollarea [data-orientation="horizontal"][data-state="visible"] {
              border-top: 1px solid hsl(var(--border) / 0.4);
            }
          `}</style>
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
