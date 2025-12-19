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

  const { data: leads, isLoading, error } = useQuery({
    queryKey: ['pipeline-leads', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];

      let query = supabase
        .from('quiz_submissions_new')
        .select('*')
        .eq('completion_percentage', 100)
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
  const updateStageMutation = useMutation({
    mutationFn: async ({ leadId, newStageId }: { leadId: string; newStageId: string }) => {
      const { error } = await supabase
        .from('quiz_submissions_new')
        .update({ pipeline_stage_id: newStageId })
        .eq('id', leadId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] });
      toast.success('Lead movido com sucesso!');
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

    updateStageMutation.mutate({ leadId, newStageId });
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
        {/* Horizontal scroll container with inline-flex */}
        <div className="inline-flex gap-3 md:gap-4 h-full min-w-max pb-4 pr-8">
          {stages.map((stage) => {
            const stageLeads = getLeadsByStage(stage.id);

            return (
              <div
                key={stage.id}
                className="w-[280px] md:w-[320px] flex-shrink-0 flex flex-col h-full"
              >
                {/* Header da coluna com cor customizada */}
                <div 
                  className="relative text-white p-4 rounded-t-xl shadow-lg overflow-hidden flex-shrink-0"
                  style={{ backgroundColor: stage.color }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                        {getIconComponent(stage.icon)}
                      </div>
                      <div>
                        <h3 className="font-bold text-base">{stage.name}</h3>
                        <p className="text-xs text-white/80">
                          {stageLeads.length} {stageLeads.length === 1 ? 'lead' : 'leads'}
                        </p>
                      </div>
                    </div>
                    <span className="bg-white/30 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-bold shadow-inner">
                      {stageLeads.length}
                    </span>
                  </div>
                </div>

              {/* Droppable area - Usa stage.id que agora é UUID */}
                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`
                        flex-1 p-3 space-y-3 overflow-y-auto 
                        bg-card/50 backdrop-blur-sm border-x border-b border-border rounded-b-xl 
                        transition-all duration-300
                        max-h-[calc(100vh-220px)] md:max-h-[calc(100vh-280px)] min-h-[200px] md:min-h-[300px]
                        ${snapshot.isDraggingOver 
                          ? 'bg-primary/10 border-primary/50 shadow-xl shadow-primary/10' 
                          : ''
                        }
                      `}
                    >
                      {stageLeads.map((lead, index) => (
                        <Draggable key={lead.id} draggableId={lead.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`
                                transition-all duration-200
                                ${snapshot.isDragging
                                  ? 'rotate-2 scale-105 shadow-2xl shadow-primary/30 z-50'
                                  : ''
                                }
                              `}
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

                      {/* Empty state */}
                      {stageLeads.length === 0 && !snapshot.isDraggingOver && (
                        <div className="flex flex-col items-center justify-center h-48 text-center">
                          <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3 opacity-50">
                            {getIconComponent(stage.icon)}
                          </div>
                          <p className="text-muted-foreground text-sm font-medium">
                            Nenhum lead
                          </p>
                          <p className="text-muted-foreground/60 text-xs mt-1">
                            Arraste leads para cá
                          </p>
                        </div>
                      )}

                      {/* Drop indicator */}
                      {snapshot.isDraggingOver && stageLeads.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-48 text-center animate-pulse">
                          <div className="w-14 h-14 bg-primary/20 rounded-full flex items-center justify-center mb-3 border-2 border-dashed border-primary">
                            {getIconComponent(stage.icon)}
                          </div>
                          <p className="text-primary text-sm font-medium">
                            Solte aqui
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>

        <style>{`
          .overflow-x-auto::-webkit-scrollbar {
            height: 8px;
          }
          .overflow-x-auto::-webkit-scrollbar-track {
            background: hsl(var(--muted));
            border-radius: 4px;
          }
          .overflow-x-auto::-webkit-scrollbar-thumb {
            background: hsl(var(--primary));
            border-radius: 4px;
          }
          .overflow-y-auto::-webkit-scrollbar {
            width: 4px;
          }
          .overflow-y-auto::-webkit-scrollbar-track {
            background: transparent;
          }
          .overflow-y-auto::-webkit-scrollbar-thumb {
            background: hsl(var(--muted-foreground) / 0.3);
            border-radius: 2px;
          }
        `}</style>
      </DragDropContext>

      {/* Lead Details Popup */}
      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Detalhes do Lead
            </DialogTitle>
          </DialogHeader>
          
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
                    <span className={selectedLead.has_vehicle && selectedLead.has_vehicle !== 'Não tenho veículo' ? 'text-green-500' : 'text-muted-foreground'}>
                      {selectedLead.has_vehicle && selectedLead.has_vehicle !== 'Não tenho veículo' ? '✓' : '✗'}
                    </span>
                    <span>Possui veículo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={selectedLead.has_driver_license?.toLowerCase().includes('sim') ? 'text-green-500' : 'text-muted-foreground'}>
                      {selectedLead.has_driver_license?.toLowerCase().includes('sim') ? '✓' : '✗'}
                    </span>
                    <span>Possui CNH</span>
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <span className={selectedLead.sales_experience?.toLowerCase().includes('já trabalho') || selectedLead.sales_experience?.toLowerCase().includes('já trabalhei') ? 'text-green-500' : 'text-muted-foreground'}>
                      {selectedLead.sales_experience?.toLowerCase().includes('já trabalho') || selectedLead.sales_experience?.toLowerCase().includes('já trabalhei') ? '✓' : '✗'}
                    </span>
                    <span>Experiência em vendas</span>
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
