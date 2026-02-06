import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, X, User, MessageSquare, MoreVertical, Trash2, CheckCircle, MessageCircle, ArrowLeft, Sparkles, WifiOff } from 'lucide-react';
import { Conversation } from '@/lib/crm-service';
import { useMessages } from '@/hooks/useMessages';
import { useWhatsAppConnectionContext } from '@/contexts/WhatsAppConnectionContext';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { LeadProfile } from './LeadProfile';
import { CreateLeadFromConversation } from './CreateLeadFromConversation';
import { TemperatureBadge } from '@/components/ui/temperature-badge';
import { AIStatusBadge } from './AIStatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { formatPhoneDisplay, normalizePhone } from '@/lib/phone-utils';
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
  const { isConnected, connectInstance } = useWhatsAppConnectionContext();
  const [showProfile, setShowProfile] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const queryClient = useQueryClient();

  // Check if current consultant has AI enabled
  const { data: currentUserAI } = useQuery({
    queryKey: ['current-user-ai-enabled'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { ai_enabled: false };
      const { data } = await supabase
        .from('users')
        .select('ai_enabled')
        .eq('auth_user_id', user.id)
        .single();
      return data || { ai_enabled: false };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Buscar stages do pipeline FILTRADO POR ORGANIZAÇÃO
  const { data: pipelineStages = [] } = useQuery({
    queryKey: ['pipeline-stages', conversation?.organization_id],
    queryFn: async () => {
      if (!conversation?.organization_id) return [];
      const { data } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('organization_id', conversation.organization_id)
        .order('order_index', { ascending: true });
      return data || [];
    },
    enabled: !!conversation?.organization_id,
  });

  // Buscar conversa atualizada para ter o lead_id mais recente (evita stale state)
  const { data: freshConversation } = useQuery({
    queryKey: ['conversation-fresh', conversation?.id],
    queryFn: async () => {
      if (!conversation?.id) return null;
      const { data } = await supabase
        .from('crm_conversations')
        .select('lead_id')
        .eq('id', conversation.id)
        .single();
      return data;
    },
    enabled: !!conversation?.id,
    refetchInterval: 3000, // Atualiza a cada 3 segundos para pegar lead_id vinculado pelo webhook
  });

  // Usar lead_id mais recente (do freshConversation ou do conversation original)
  const effectiveLeadId = freshConversation?.lead_id || conversation?.lead_id;

  // Buscar stage atual do lead
  const { data: currentLead } = useQuery({
    queryKey: ['lead-stage', effectiveLeadId],
    queryFn: async () => {
      if (!effectiveLeadId) return null;
      const { data } = await supabase
        .from('quiz_submissions_new')
        .select('pipeline_stage_id')
        .eq('id', effectiveLeadId)
        .single();
      return data;
    },
    enabled: !!effectiveLeadId,
  });

  // Mutation para atualizar stage - cria lead automaticamente se não existir
  const updateStageMutation = useMutation({
    mutationFn: async (newStageId: string) => {
      let leadId = effectiveLeadId;
      
      // Se não tem lead, criar um novo automaticamente
      if (!leadId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');
        
        const { data: userData } = await supabase
          .from('users')
          .select('id, organization_id')
          .eq('auth_user_id', user.id)
          .single();
        
        if (!userData) throw new Error('Usuário não encontrado');
        
        // Normalizar telefone antes de criar lead
        const normalizedPhone = normalizePhone(conversation?.contact_phone || '');
        
        // Criar lead com dados da conversa
        const { data: newLead, error: createError } = await supabase
          .from('quiz_submissions_new')
          .insert({
            name: conversation?.contact_name || normalizedPhone || 'Sem nome',
            phone: normalizedPhone, // Telefone normalizado
            organization_id: userData.organization_id,
            consultant_id: userData.id,
            pipeline_stage_id: newStageId,
            temperature: 'cold', // ✅ Lead manual = Frio
            completion_percentage: 0,
          })
          .select()
          .single();
        
        if (createError) throw createError;
        
        // Vincular lead à conversa
        if (conversation?.id) {
          await supabase
            .from('crm_conversations')
            .update({ lead_id: newLead.id })
            .eq('id', conversation.id);
        }
        
        leadId = newLead.id;
      } else {
        // Apenas atualizar o stage do lead existente
        const { error } = await supabase
          .from('quiz_submissions_new')
          .update({ pipeline_stage_id: newStageId })
          .eq('id', leadId);
        if (error) throw error;
      }
      
      return leadId;
    },
    onSuccess: () => {
      toast.success('Quadro atualizado!');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stage'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-fresh', conversation?.id] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-leads'] });
    },
    onError: (e: Error) => toast.error('Erro ao atualizar quadro: ' + e.message),
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
        .then(({ error }) => {
          if (!error) {
            // Invalidar cache para atualizar a lista de conversas
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
          }
        });
    }
  }, [conversation?.id, conversation?.unread_count, queryClient]);

  // Handler para envio que verifica reconexão
  const handleSendMessage = async (type: string, content: string, mediaUrl?: string, fileName?: string) => {
    const result = await sendMessage(type as any, content, mediaUrl, fileName);
    
    if (result?.needsReconnect) {
      toast.error('WhatsApp desconectado! Clique em Reconectar.', {
        action: {
          label: 'Reconectar',
          onClick: () => connectInstance(),
        },
      });
    }
    
    return result;
  };

  const handleChangeStatus = async (newStatus: 'open' | 'closed') => {
    if (!conversation) return;
    
    try {
      await supabase
        .from('crm_conversations')
        .update({ status: newStatus })
        .eq('id', conversation.id);
      
      // Se fechando conversa, enviar farewell message se configurado
      if (newStatus === 'closed' && currentUserAI?.ai_enabled) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: userData } = await supabase
              .from('users')
              .select('id')
              .eq('auth_user_id', user.id)
              .single();
            
            if (userData) {
              const { data: aiConfig } = await supabase
                .from('ai_agent_configs')
                .select('farewell_message, agent_name')
                .eq('user_id', userData.id)
                .maybeSingle();
              
              if (aiConfig?.farewell_message?.trim()) {
                // Enviar farewell via sendMessage
                await sendMessage('text', aiConfig.farewell_message);
                console.log('👋 Farewell message enviada');
              }
            }
          }
        } catch (e) {
          console.error('Erro ao enviar farewell:', e);
        }
      }
      
      const labels = { open: 'aberta', closed: 'fechada' };
      toast.success(`Conversa marcada como ${labels[newStatus]}`);
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

  const currentStage = pipelineStages.find(s => s.id === currentLead?.pipeline_stage_id);

  return (
    <div className="h-full w-full flex">
      <Card className="glass-card flex-1 w-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-3 border-b border-border bg-gradient-to-r from-primary/5 to-transparent flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
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
                  <AIStatusBadge conversationId={conversation.id} aiEnabled={currentUserAI?.ai_enabled || false} />
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {formatPhoneDisplay(conversation.contact_phone)}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Botão Criar Lead - só aparece se não tiver lead vinculado (nem no estado local nem no banco) */}
              {!effectiveLeadId && (
                <CreateLeadFromConversation 
                  conversation={conversation} 
                  onLeadCreated={() => {
                    queryClient.invalidateQueries({ queryKey: ['conversations'] });
                    queryClient.invalidateQueries({ queryKey: ['conversation-fresh', conversation?.id] });
                    queryClient.invalidateQueries({ queryKey: ['lead-stage'] });
                  }}
                />
              )}

              {pipelineStages.length > 0 && (
                <div className="hidden sm:flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Quadro:</span>
                  <Select
                    value={currentLead?.pipeline_stage_id || ''}
                    onValueChange={(stageId) => updateStageMutation.mutate(stageId)}
                  >
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                      <SelectValue placeholder={effectiveLeadId ? "Selecione" : "Adicionar ao quadro"} />
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
                  {pipelineStages.length > 0 && (
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

        {/* Banner de desconexão */}
        {!isConnected && (
          <div className="flex-shrink-0 px-4 py-2 bg-destructive/10 border-b border-destructive/20 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <WifiOff className="w-4 h-4" />
              <span>WhatsApp desconectado</span>
            </div>
            <Button size="sm" variant="destructive" onClick={connectInstance}>
              Reconectar
            </Button>
          </div>
        )}

        {/* Messages */}
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
            onSend={handleSendMessage} 
            isSending={isSending || !isConnected}
          />
        </div>
      </Card>

      {/* Profile Drawer */}
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
