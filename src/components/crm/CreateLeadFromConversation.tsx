import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserPlus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Conversation } from '@/lib/crm-service';
import { normalizePhone } from '@/lib/phone-utils';
import { useFunnel } from '@/contexts/FunnelContext';

interface CreateLeadFromConversationProps {
  conversation: Conversation;
  onLeadCreated?: () => void;
}

export function CreateLeadFromConversation({ conversation, onLeadCreated }: CreateLeadFromConversationProps) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState(conversation.contact_name || '');
  const [selectedStage, setSelectedStage] = useState<string>('');
  const queryClient = useQueryClient();
  const { resolvedFunnel } = useFunnel();
  const stagesFunnel = resolvedFunnel as 'consultor' | 'associado';

  // Buscar stages do pipeline FILTRADO POR ORGANIZAÇÃO + FUNIL
  const { data: pipelineStages = [] } = useQuery({
    queryKey: ['pipeline-stages', conversation.organization_id, stagesFunnel],
    queryFn: async () => {
      const { data } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('organization_id', conversation.organization_id)
        .eq('funnel_type', stagesFunnel)
        .order('order_index', { ascending: true });
      return data || [];
    },
    enabled: !!conversation.organization_id,
  });

  // Definir stage padrão quando carregar
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && pipelineStages.length > 0 && !selectedStage) {
      setSelectedStage(pipelineStages[0].id);
    }
    if (isOpen) {
      setName(conversation.contact_name || '');
    }
  };

  const handleCreateLead = async () => {
    if (!name.trim()) {
      toast.error('Por favor, informe o nome do lead');
      return;
    }

    setIsCreating(true);

    try {
      // Normalizar telefone antes de salvar
      const normalizedPhone = normalizePhone(conversation.contact_phone);
      
      // Criar lead na tabela quiz_submissions_new — herda funil ativo
      const { data: lead, error: leadError } = await supabase
        .from('quiz_submissions_new')
        .insert({
          name: name.trim(),
          phone: normalizedPhone,
          organization_id: conversation.organization_id,
          consultant_id: conversation.user_id,
          pipeline_stage_id: selectedStage || pipelineStages[0]?.id,
          stage: 'novo',
          funnel_type: stagesFunnel,
          temperature: stagesFunnel === 'associado' ? 'warm' : 'cold',
          completion_percentage: 0,
          lead_score: 0,
          lead_source: 'whatsapp',
        })
        .select()
        .single();

      if (leadError) throw leadError;

      // Vincular lead à conversa
      const { error: updateError } = await supabase
        .from('crm_conversations')
        .update({ 
          lead_id: lead.id,
          contact_name: name.trim() // Atualizar nome na conversa também
        })
        .eq('id', conversation.id);

      if (updateError) throw updateError;

      toast.success('Lead criado e vinculado com sucesso!');
      
      // Invalidar queries para atualizar a UI
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] });
      
      setOpen(false);
      onLeadCreated?.();
    } catch (error: any) {
      console.error('Erro ao criar lead:', error);
      toast.error(error.message || 'Erro ao criar lead');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <UserPlus className="w-4 h-4" />
          <span className="hidden sm:inline">Criar Lead</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Lead</DialogTitle>
          <DialogDescription>
            Transforme este contato em um lead para acompanhar no pipeline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="lead-name">Nome do Lead</Label>
            <Input
              id="lead-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lead-phone">Telefone</Label>
            <Input
              id="lead-phone"
              value={conversation.contact_phone}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lead-stage">Quadro do Pipeline</Label>
            <Select value={selectedStage} onValueChange={setSelectedStage}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um quadro" />
              </SelectTrigger>
              <SelectContent>
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
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreateLead} disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Criar Lead
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
