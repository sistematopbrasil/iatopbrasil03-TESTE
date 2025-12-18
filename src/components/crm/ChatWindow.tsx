import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, X, User, MessageSquare, MoreVertical, Trash2, CheckCircle, MessageCircle, ArrowLeft, Sparkles } from 'lucide-react';
import { Conversation } from '@/lib/crm-service';
import { useMessages } from '@/hooks/useMessages';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { LeadProfile } from './LeadProfile';
import { TemperatureBadge } from '@/components/ui/temperature-badge';
import { supabase } from '@/integrations/supabase/client';
import { formatPhoneDisplay } from '@/lib/phone-utils';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface ChatWindowProps {
  conversation: Conversation | null;
  onClose: () => void;
}

export function ChatWindow({ conversation, onClose }: ChatWindowProps) {
  const { messages, isLoading, isSending, sendMessage } = useMessages(conversation?.id || null);
  const [showProfile, setShowProfile] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
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

  // Buscar stage atual do lead usando pipeline_stage_id
  const { data: currentLead } = useQuery({
    queryKey: ['lead-stage', conversation?.lead_id],
    queryFn: async () => {
      if (!conversation?.lead_id) return null;
      const { data } = await supabase
        .from('quiz_submissions_new')
        .select('pipeline_stage_id')
        .eq('id', conversation.lead_id)
        .single();
      return data;
    },
    enabled: !!conversation?.lead_id,
  });

  // ✅ Mutation ATUALIZADA - Usa pipeline_stage_id (UUID)
  const updateStageMutation = useMutation({
    mutationFn: async (newStageId: string) => {
      if (!conversation?.lead_id) throw new Error('Lead não vinculado');
      const { error } = await supabase
        .from('quiz_submissions_new')
        .update({ pipeline_stage_id: newStageId })
        .eq('id', conversation.lead_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Quadro atualizado!');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stage', conversation?.lead_id] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] });
    },
    onError: () => toast.error('Erro ao atualizar quadro'),
  });

  useEffect(() => {
    if (isTyping) {
      const timer = setTimeout(() => setIsTyping(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isTyping]);

  useEffect(() => {
    if (conversation?.id && conversation.unread_count > 0) {
      supabase
        .from('crm_conversations')
        .update({ unread_count: 0 })
        .eq('id', conversation.id)
        .then(() => {});
    }
  }, [conversation?.id]);

  const handleChangeStatus = async (status: 'open' | 'closed') => {
    if (!conversation) return;
    
    try {
      await supabase
        .from('crm_conversations')
        .update({ status })
        .eq('id', conversation.id);
      
      const labels = { open: 'aberta', closed: 'fechada' };
      toast.success(`Conversa marcada como ${labels[status]}`);
    } catch (error) {
      toast.error('Erro ao atualizar conversa');
    }
  };

  const handleDeleteConversation = async () => {
    if (!conversation) return;
    
    if (!confirm('Tem certeza que deseja excluir esta conversa?')) return;

    try {
      await supabase.from('crm_messages').delete().eq('conversation_id', conversation.id);
      await supabase.from('crm_conversations').delete().eq('id', conversation.id);
      toast.success('Conversa excluída');
      onClose();
    } catch (error) {
      toast.error('Erro ao excluir conversa');
    }
  };

  if (!conversation) {
    return (
      <Card className="glass-card h-full w-full flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
            <MessageSquare className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Selecione uma conversa</h3>
          <p className="text-muted-foreground max-w-sm">
            Escolha uma conversa na lista ao lado para começar a enviar mensagens
          </p>
        </div>
      </Card>
    );
  }

  // Encontrar o stage atual pelo pipeline_stage_id
  const currentStage = pipelineStages.find(s => s.id === currentLead?.pipeline_stage_id);

  return (
    <div className="h-full w-full flex">
      {/* Chat */}
      <Card className="glass-card flex-1 w-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-3 border-b border-border bg-gradient-to-r from-primary/5 to-transparent flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              {/* Botão voltar (mobile) */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="lg:hidden flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>

              <Avatar className="w-10 h-10 shadow-lg flex-shrink-0">
                {conversation.contact_avatar ? (
                  <AvatarImage src={conversation.contact_avatar} alt={conversation.contact_name || 'Avatar'} />
                ) : null}
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary-light text-primary-foreground font-bold text-sm">
                  {conversation.contact_name?.[0]?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground text-sm truncate">
                    {conversation.contact_name || conversation.contact_phone}
                  </h3>
                  {conversation.lead_id && (
                    <Badge variant="secondary" className="text-xs hidden sm:flex">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Lead
                    </Badge>
                  )}
                  {conversation.lead?.temperature && (
                    <TemperatureBadge temperature={conversation.lead.temperature} size="sm" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {formatPhoneDisplay(conversation.contact_phone)}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Dropdown de Pipeline Stage - USA STAGES DO BANCO */}
              {conversation.lead_id && pipelineStages.length > 0 && (
                <div className="hidden sm:flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Quadro:</span>
                  <Select
                    value={currentLead?.pipeline_stage_id || ''}
                    onValueChange={(stageId) => updateStageMutation.mutate(stageId)}
                  >
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                      <SelectValue placeholder="Selecione" />
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
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowProfile(!showProfile)}
                className={`hover:bg-primary/20 ${showProfile ? 'bg-primary/20 text-primary' : ''}`}
                title="Ver perfil"
              >
                <User className="w-4 h-4" />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="hover:bg-primary/20">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass-card border-border">
                  {/* Mover para quadro (mobile) - USA STAGES DO BANCO */}
                  {conversation.lead_id && pipelineStages.length > 0 && (
                    <>
                      <div className="sm:hidden px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        Mover para:
                      </div>
                      {pipelineStages.map((stage) => (
                        <DropdownMenuItem 
                          key={stage.id} 
                          onClick={() => updateStageMutation.mutate(stage.id)}
                          className="sm:hidden"
                        >
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: stage.color }} 
                            />
                            {stage.name}
                          </div>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator className="sm:hidden" />
                    </>
                  )}
                  <DropdownMenuItem onClick={() => handleChangeStatus('open')}>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Marcar como Aberta
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleChangeStatus('closed')}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Marcar como Fechada
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleDeleteConversation}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir conversa
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-destructive/20 hover:text-destructive hidden lg:flex">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Messages - Takes all remaining space */}
        <div className="flex-1 min-h-0 relative bg-gradient-to-b from-transparent to-muted/20">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Carregando mensagens...</p>
              </div>
            </div>
          ) : (
            <MessageList 
              messages={messages} 
              conversationId={conversation.id}
              isTyping={isTyping}
            />
          )}
        </div>

        {/* Input */}
        <div className="flex-shrink-0">
          <MessageInput 
            conversationId={conversation.id} 
            onSend={sendMessage} 
            isSending={isSending} 
          />
        </div>
      </Card>

      {/* Profile Drawer - Sheet lateral responsivo */}
      <Sheet open={showProfile} onOpenChange={setShowProfile}>
        <SheetContent side="right" className="w-full sm:w-[400px] lg:w-[450px] overflow-y-auto p-0">
          <SheetHeader className="p-4 border-b border-border">
            <SheetTitle>Perfil do Lead</SheetTitle>
          </SheetHeader>
          <LeadProfile conversation={conversation} onClose={() => setShowProfile(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}