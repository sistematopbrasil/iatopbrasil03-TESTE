import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { WhatsAppConnectionProvider, useWhatsAppConnectionContext } from '@/contexts/WhatsAppConnectionContext';
import { ConnectionPanel } from '@/components/crm/ConnectionPanel';
import { ConversationList } from '@/components/crm/ConversationList';
import { ChatWindow } from '@/components/crm/ChatWindow';
import { QuizLeadsList } from '@/components/crm/QuizLeadsList';
import { CRMSettings } from '@/components/crm/CRMSettings';
import { Conversation } from '@/lib/crm-service';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Users, Settings, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { normalizePhone } from '@/lib/phone-utils';

function AdminCRMContent() {
  const location = useLocation();
  const { isConnected, isLoading, instance } = useWhatsAppConnectionContext();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [activeTab, setActiveTab] = useState<'conversations' | 'quiz-leads' | 'settings'>('conversations');
  const [wasConnected, setWasConnected] = useState(false);

  // Quando conectar com sucesso, ir automaticamente para aba de conversas
  useEffect(() => {
    if (isConnected && !wasConnected) {
      setActiveTab('conversations');
      setWasConnected(true);
    } else if (!isConnected) {
      setWasConnected(false);
    }
  }, [isConnected, wasConnected]);

  // Processar state vindo de outras páginas (Pipeline, Leads)
  useEffect(() => {
    const state = location.state as { openConversation?: boolean; phone?: string; leadData?: any } | null;
    
    if (state?.openConversation && state?.phone && instance) {
      handleStartConversationFromLead(state.phone, state.leadData || {});
      // Limpar o state para evitar reprocessamento
      window.history.replaceState({}, document.title);
    }
  }, [location.state, instance]);

  const handleStartConversationFromLead = async (phone: string, leadData: any) => {
    if (!instance) {
      toast.error('WhatsApp não conectado');
      return;
    }

    try {
      // ✅ USA normalizePhone para consistência
      const normalizedPhone = normalizePhone(phone);

      const { data: existingConv } = await supabase
        .from('crm_conversations')
        .select('*')
        .eq('contact_phone', normalizedPhone)
        .eq('instance_id', instance.id)
        .maybeSingle();

      if (existingConv) {
        setSelectedConversation(existingConv as Conversation);
        setActiveTab('conversations');
        return;
      }

      const { data: newConv, error } = await supabase
        .from('crm_conversations')
        .insert({
          contact_phone: normalizedPhone, // ✅ Telefone normalizado
          contact_name: leadData.name || null,
          instance_id: instance.id,
          user_id: instance.user_id,
          organization_id: instance.organization_id,
          lead_id: leadData.id || null,
          status: 'open',
        })
        .select()
        .single();

      if (error) throw error;

      setSelectedConversation(newConv as Conversation);
      setActiveTab('conversations');
      toast.success('Conversa iniciada!');
    } catch (error) {
      console.error('Erro ao iniciar conversa:', error);
      toast.error('Erro ao iniciar conversa');
    }
  };

  // Show loading state to avoid flash
  if (isLoading) {
    return (
      <AdminLayout>
        <div className="h-[calc(100vh-64px)] flex items-center justify-center">
          <div className="text-center space-y-2">
            <Loader2 className="h-8 w-8 border-2 border-primary animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Verificando conexão...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden">
        {/* Header com tabs - sempre visível */}
        <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-border">
          <h1 className="text-lg font-bold text-foreground mb-2">CRM WhatsApp</h1>
          
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="glass border-border h-9">
              <TabsTrigger value="conversations" className="gap-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">Conversas</span>
              </TabsTrigger>
              <TabsTrigger value="quiz-leads" className="gap-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Leads do Quiz</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Configurações</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content - ocupa todo o espaço restante */}
        <div className="flex-1 min-h-0 overflow-hidden p-3">
          {activeTab === 'conversations' && (
            <>
              {!isConnected ? (
                /* Mostrar ConnectionPanel dentro da aba Conversas quando não conectado */
                <div className="h-full overflow-auto">
                  <ConnectionPanel onOpenConversations={() => setActiveTab('conversations')} />
                </div>
              ) : (
                /* Mostrar lista de conversas e chat quando conectado */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
                  {/* Lista de conversas - 4 colunas (33%) */}
                  <div className={`
                    ${selectedConversation ? 'hidden lg:block' : 'block'}
                    lg:col-span-4 h-full overflow-hidden
                  `}>
                    <ConversationList
                      selectedConversationId={selectedConversation?.id || null}
                      onSelectConversation={setSelectedConversation}
                      instanceId={instance?.id}
                      userId={instance?.user_id}
                      organizationId={instance?.organization_id}
                    />
                  </div>

                  {/* Chat - 8 colunas (67%) */}
                  <div className={`
                    ${!selectedConversation ? 'hidden lg:flex' : 'flex'}
                    lg:col-span-8 h-full overflow-hidden
                  `}>
                    <ChatWindow
                      conversation={selectedConversation}
                      onClose={() => setSelectedConversation(null)}
                    />
                  </div>
                </div>
              )}
            </>
          )}
          
          {activeTab === 'quiz-leads' && (
            <QuizLeadsList onStartConversation={handleStartConversationFromLead} />
          )}
          
          {activeTab === 'settings' && (
            <CRMSettings 
              onClose={() => setActiveTab('conversations')} 
              onOpenConversations={() => setActiveTab('conversations')} 
            />
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

export default function AdminCRM() {
  return (
    <WhatsAppConnectionProvider>
      <AdminCRMContent />
    </WhatsAppConnectionProvider>
  );
}
