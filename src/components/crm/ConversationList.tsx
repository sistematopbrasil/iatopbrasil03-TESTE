import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useConversations } from '@/hooks/useConversations';
import { useWhatsAppConnectionContext } from '@/contexts/WhatsAppConnectionContext';
import { Conversation } from '@/lib/crm-service';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { 
  Search, 
  Plus, 
  Loader2, 
  MessageCircle,
  MoreVertical,
  Trash2,
  Pin,
  Archive,
  Filter,
  ChevronDown,
  Inbox,
  Bell,
  CheckCircle,
  CheckCheck,
  Kanban,
  Bot
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NewContactDialog } from './NewContactDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TemperatureBadge } from '@/components/ui/temperature-badge';

interface ConversationListProps {
  selectedConversationId: string | null;
  onSelectConversation: (conversation: Conversation) => void;
  instanceId?: string;
  userId?: string;
  organizationId?: string;
}

type FilterType = 'all' | 'open' | 'unread' | 'closed';

const filterLabels: Record<FilterType, string> = {
  all: 'Todas',
  open: 'Abertas',
  unread: 'Não lidas',
  closed: 'Fechadas',
};

export function ConversationList({
  selectedConversationId,
  onSelectConversation,
  instanceId,
  userId,
  organizationId,
}: ConversationListProps) {
  const { isNewConnection } = useWhatsAppConnectionContext();
  const {
    conversations,
    isLoading,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    totalUnread,
    markAsRead,
    updateStatus,
    togglePin,
    refresh,
  } = useConversations({ instanceId, skipSync: isNewConnection });
  
  const [showNewContactDialog, setShowNewContactDialog] = useState(false);
  const [stageFilter, setStageFilter] = useState<string | null>(null);

  // Buscar stages do pipeline
  const { data: pipelineStages } = useQuery({
    queryKey: ['pipeline-stages-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('id, name, color, order_index')
        .order('order_index');
      if (error) throw error;
      return data;
    }
  });

  // Buscar dados dos leads vinculados às conversas
  const { data: leadsData } = useQuery({
    queryKey: ['conversations-leads', conversations.map(c => c.lead_id).filter(Boolean)],
    queryFn: async () => {
      const leadIds = conversations.map(c => c.lead_id).filter(Boolean) as string[];
      if (leadIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('quiz_submissions_new')
        .select('id, pipeline_stage_id, temperature')
        .in('id', leadIds);
      
      if (error) throw error;
      
      // Criar map por id
      const leadsMap: Record<string, { pipeline_stage_id: string | null; temperature: string | null }> = {};
      data?.forEach(lead => {
        leadsMap[lead.id] = { pipeline_stage_id: lead.pipeline_stage_id, temperature: lead.temperature };
      });
      return leadsMap;
    },
    enabled: conversations.length > 0
  });

  // Buscar estados da IA para todas as conversas
  const conversationIds = conversations.map(c => c.id);
  const { data: aiStatesData } = useQuery({
    queryKey: ['ai-states-list', conversationIds],
    queryFn: async () => {
      if (conversationIds.length === 0) return {};
      const { data } = await supabase
        .from('ai_conversation_state')
        .select('conversation_id, is_active, permanently_disabled, paused_until')
        .in('conversation_id', conversationIds);
      const map: Record<string, boolean> = {};
      data?.forEach(s => {
        const isPaused = s.paused_until ? new Date(s.paused_until) > new Date() : false;
        map[s.conversation_id] = s.is_active && !s.permanently_disabled && !isPaused;
      });
      return map;
    },
    enabled: conversationIds.length > 0,
    staleTime: 30_000,
  });

  const openCount = conversations.filter(c => c.status === 'open').length;
  const closedCount = conversations.filter(c => c.status === 'closed').length;

  // Filtrar conversas por stage do pipeline
  const filteredConversations = stageFilter
    ? conversations.filter(c => {
        if (!c.lead_id || !leadsData) return false;
        const leadData = leadsData[c.lead_id];
        return leadData?.pipeline_stage_id === stageFilter;
      })
    : conversations;

  const handleDeleteConversation = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    
    if (!confirm('Tem certeza que deseja excluir esta conversa? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      await supabase
        .from('crm_messages')
        .delete()
        .eq('conversation_id', conversationId);

      const { error } = await supabase
        .from('crm_conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;

      toast.success('Conversa excluída com sucesso!');
      refresh();
    } catch (error) {
      console.error('Erro ao excluir conversa:', error);
      toast.error('Erro ao excluir conversa');
    }
  };

  const handleConversationCreated = async (conversationId: string) => {
    setShowNewContactDialog(false);
    refresh();
    
    const { data } = await supabase
      .from('crm_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();
    
    if (data) {
      onSelectConversation(data as Conversation);
    }
  };

  // Função para obter o stage do lead
  const getLeadStage = (leadId: string | null) => {
    if (!leadId || !leadsData || !pipelineStages) return null;
    const leadData = leadsData[leadId];
    if (!leadData?.pipeline_stage_id) return null;
    return pipelineStages.find(s => s.id === leadData.pipeline_stage_id);
  };

  const selectedStageName = stageFilter 
    ? pipelineStages?.find(s => s.id === stageFilter)?.name 
    : null;

  return (
    <Card className="h-full flex flex-col glass border-border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-gradient-to-r from-primary/10 to-transparent flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Conversas</h2>
            {totalUnread > 0 && (
              <Badge className="bg-primary text-primary-foreground animate-pulse">
                {totalUnread}
              </Badge>
            )}
          </div>
          <Button 
            size="sm" 
            onClick={() => setShowNewContactDialog(true)}
            className="bg-gradient-to-r from-primary to-primary-light"
          >
            <Plus className="w-4 h-4 mr-1" />
            Novo
          </Button>
        </div>

        {/* Search + Filters */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 glass border-border focus:border-primary"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="glass border-border gap-2 min-w-[110px]">
                  <Filter className="w-4 h-4" />
                  {filterLabels[filter as FilterType] || 'Todas'}
                  {filter === 'unread' && totalUnread > 0 && (
                    <Badge className="bg-primary text-primary-foreground ml-1 h-5 min-w-5 px-1">
                      {totalUnread}
                    </Badge>
                  )}
                  <ChevronDown className="w-3 h-3 ml-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass border-border w-48">
                <DropdownMenuItem 
                  onClick={() => setFilter('all')}
                  className={filter === 'all' ? 'bg-primary/20' : ''}
                >
                  <Inbox className="w-4 h-4 mr-2" />
                  Todas ({conversations.length})
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setFilter('open')}
                  className={filter === 'open' ? 'bg-primary/20' : ''}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Abertas ({openCount})
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setFilter('unread')}
                  className={filter === 'unread' ? 'bg-primary/20' : ''}
                >
                  <Bell className="w-4 h-4 mr-2" />
                  Não lidas
                  {totalUnread > 0 && (
                    <Badge className="bg-primary text-primary-foreground ml-auto h-5 min-w-5 px-1">
                      {totalUnread}
                    </Badge>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setFilter('closed')}
                  className={filter === 'closed' ? 'bg-primary/20' : ''}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Fechadas ({closedCount})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Filtro por Pipeline Stage */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className={`w-full glass border-border gap-2 justify-between ${stageFilter ? 'border-primary/50' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <Kanban className="w-4 h-4" />
                  <span>{selectedStageName || 'Todos os quadros'}</span>
                </div>
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="glass border-border w-56">
              <DropdownMenuItem 
                onClick={() => setStageFilter(null)}
                className={!stageFilter ? 'bg-primary/20' : ''}
              >
                <Kanban className="w-4 h-4 mr-2" />
                Todos os quadros
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {pipelineStages?.map((stage) => (
                <DropdownMenuItem
                  key={stage.id}
                  onClick={() => setStageFilter(stage.id)}
                  className={stageFilter === stage.id ? 'bg-primary/20' : ''}
                >
                  <div 
                    className="w-3 h-3 rounded-full mr-2" 
                    style={{ backgroundColor: stage.color }}
                  />
                  {stage.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-12 px-4">
            <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              {searchQuery || filter !== 'all' || stageFilter
                ? 'Nenhuma conversa encontrada' 
                : 'Nenhuma conversa ainda'}
            </p>
            {!searchQuery && filter === 'all' && !stageFilter && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setShowNewContactDialog(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Iniciar nova conversa
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredConversations.map((conversation) => {
              const leadStage = getLeadStage(conversation.lead_id);
              const leadTemp = conversation.lead_id && leadsData ? leadsData[conversation.lead_id]?.temperature : null;
              
              return (
                <div
                  key={conversation.id}
                  onClick={() => onSelectConversation(conversation)}
                  className={`p-4 cursor-pointer transition-all hover:bg-muted/50 group ${
                    selectedConversationId === conversation.id
                      ? 'bg-primary/10 border-l-2 border-l-primary'
                      : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      <Avatar className="w-12 h-12">
                        {conversation.contact_avatar ? (
                          <AvatarImage src={conversation.contact_avatar} alt={conversation.contact_name || 'Avatar'} />
                        ) : null}
                        <AvatarFallback className="bg-gradient-to-br from-primary to-primary-light text-primary-foreground font-semibold">
                          {conversation.contact_name?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {conversation.is_pinned && (
                            <Pin className="w-3 h-3 text-primary fill-primary flex-shrink-0" />
                          )}
                          <h3 className="font-semibold text-foreground truncate">
                            {conversation.contact_name || conversation.contact_phone}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {conversation.last_message_at && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(new Date(conversation.last_message_at), {
                                addSuffix: false,
                                locale: ptBR,
                              })}
                            </span>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="glass border-border">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); markAsRead(conversation.id); }}>
                                <CheckCheck className="w-4 h-4 mr-2" />
                                Marcar como lida
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); togglePin(conversation.id, !conversation.is_pinned); }}>
                                <Pin className="w-4 h-4 mr-2" />
                                {conversation.is_pinned ? 'Desafixar' : 'Fixar'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateStatus(conversation.id, 'archived'); }}>
                                <Archive className="w-4 h-4 mr-2" />
                                Arquivar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => handleDeleteConversation(e, conversation.id)}
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Badges de temperatura, stage e IA */}
                      <div className="flex items-center gap-2 mb-1">
                        {aiStatesData?.[conversation.id] && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 bg-green-600/20 text-green-400 border-0">
                            <Bot className="w-3 h-3 mr-0.5" />
                            IA
                          </Badge>
                        )}
                        {leadTemp && (
                          <TemperatureBadge 
                            temperature={leadTemp as 'hot' | 'warm' | 'cold'} 
                            size="sm"
                            showLabel={false}
                          />
                        )}
                        {leadStage && (
                          <Badge 
                            variant="outline"
                            className="text-xs px-1.5 py-0 h-5 border-0"
                            style={{ 
                              backgroundColor: `${leadStage.color}20`,
                              color: leadStage.color 
                            }}
                          >
                            {leadStage.name}
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground truncate">
                        {conversation.last_message_preview || 'Sem mensagens'}
                      </p>
                    </div>

                    {(conversation.unread_count || 0) > 0 && (
                      <Badge className="bg-primary text-primary-foreground h-5 min-w-5 flex items-center justify-center p-0 px-1.5 text-xs animate-pulse flex-shrink-0">
                        {conversation.unread_count}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* New Contact Dialog */}
      <NewContactDialog
        open={showNewContactDialog}
        onOpenChange={setShowNewContactDialog}
        onConversationCreated={handleConversationCreated}
        instanceId={instanceId}
        userId={userId}
        organizationId={organizationId}
      />
    </Card>
  );
}
