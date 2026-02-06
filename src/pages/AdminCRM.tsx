import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { WhatsAppConnectionProvider, useWhatsAppConnectionContext } from '@/contexts/WhatsAppConnectionContext';
import { ConnectionPanel } from '@/components/crm/ConnectionPanel';
import { ConversationList } from '@/components/crm/ConversationList';
import { ChatWindow } from '@/components/crm/ChatWindow';
import { DisconnectedOverlay } from '@/components/crm/DisconnectedOverlay';
import { QuizLeadsList } from '@/components/crm/QuizLeadsList';
import { WhatsAppLeadsList } from '@/components/crm/WhatsAppLeadsList';
import { CRMSettings } from '@/components/crm/CRMSettings';
import { Conversation } from '@/lib/crm-service';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MessageSquare, Users, Settings, WifiOff, Wifi, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { normalizePhone, getPhoneVariants } from '@/lib/phone-utils';
import { Skeleton } from '@/components/ui/skeleton';

function AdminCRMContent() {
  const location = useLocation();
  const { isConnected, isLoading, instance, isConnecting, qrCode, connectionVerified } = useWhatsAppConnectionContext();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [activeTab, setActiveTab] = useState<'conversations' | 'leads' | 'settings'>('conversations');
  const [leadsSubTab, setLeadsSubTab] = useState<'quiz' | 'whatsapp'>('quiz');
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
      window.history.replaceState({}, document.title);
    }
  }, [location.state, instance]);

  const handleStartConversationFromLead = async (phone: string, leadData: any) => {
    if (!instance) {
      toast.error('WhatsApp não conectado');
      return;
    }

    try {
      // Gerar todas as variantes do telefone (com e sem 9)
      const phoneVariants = getPhoneVariants(phone);
      const normalizedPhone = normalizePhone(phone);

      // Buscar por QUALQUER variante do telefone
      const { data: existingConv } = await supabase
        .from('crm_conversations')
        .select('*')
        .in('contact_phone', phoneVariants)
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
          contact_phone: normalizedPhone,
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

  // Determinar se deve mostrar overlay de desconectado
  // NÃO mostrar durante a verificação inicial (quando status é 'connected' mas connectionVerified ainda é false)
  const isVerificationPending = instance?.status === 'connected' && !connectionVerified && !isConnecting;
  const showDisconnectedOverlay = !isLoading && instance && !isConnected && !isConnecting && !isVerificationPending && activeTab === 'conversations';
  
  // Mostrar overlay com QR Code quando reconectando
  const showReconnectingOverlay = !isLoading && instance && (isConnecting || qrCode) && activeTab === 'conversations';

  // Indicador de status da conexão
  const ConnectionIndicator = () => {
    if (isLoading) return null;
    
    if (isConnected && connectionVerified) {
      return (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-success/10 rounded-full">
          <Wifi className="w-3 h-3 text-success" />
          <span className="text-xs text-success font-medium hidden sm:inline">Conectado</span>
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
        </div>
      );
    }
    
    // Se está verificando a conexão, mostrar indicador de verificação (não desconectado)
    if (instance && !connectionVerified && instance.status === 'connected' && !isConnecting) {
      return (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 rounded-full">
          <Wifi className="w-3 h-3 text-muted-foreground animate-pulse" />
          <span className="text-xs text-muted-foreground font-medium hidden sm:inline">Verificando...</span>
        </div>
      );
    }
    
    if (instance && !isConnected && !isConnecting) {
      return (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-destructive/10 rounded-full animate-pulse">
          <WifiOff className="w-3 h-3 text-destructive" />
          <span className="text-xs text-destructive font-medium hidden sm:inline">Desconectado</span>
          <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
        </div>
      );
    }
    
    return null;
  };

  // Skeleton para loading inicial - mas não se estiver conectando (para mostrar QR)
  if (isLoading && !isConnecting) {
    return (
      <AdminLayout>
        <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden">
          <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <Skeleton className="h-9 w-full max-w-md" />
          </div>
          <div className="flex-1 p-3">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
              <div className="lg:col-span-4 space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
              <div className="hidden lg:block lg:col-span-8">
                <Skeleton className="h-full w-full rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden overflow-x-hidden overscroll-x-none">
        {/* Header com tabs */}
        <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-lg font-bold text-foreground">CRM WhatsApp</h1>
            <ConnectionIndicator />
          </div>
          
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="glass border-border h-9">
              <TabsTrigger value="conversations" className="gap-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">Conversas</span>
              </TabsTrigger>
              <TabsTrigger value="leads" className="gap-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Leads</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Configurações</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content - All tabs rendered but only active one visible */}
        <div className="flex-1 min-h-0 overflow-hidden overflow-x-hidden p-1.5 relative overscroll-x-none">
          {/* Tab: Conversas */}
          <div className={activeTab === 'conversations' ? 'h-full' : 'hidden'}>
            {!instance ? (
              <div className="h-full overflow-auto">
                <ConnectionPanel />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full relative">
                {/* Overlay de desconexão */}
                {(showDisconnectedOverlay || showReconnectingOverlay) && (
                  <DisconnectedOverlay />
                )}

                {/* Lista de conversas */}
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

                {/* Chat */}
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
          </div>
          
          {/* Tab: Leads - com sub-abas */}
          <div className={activeTab === 'leads' ? 'h-full flex flex-col' : 'hidden'}>
            {/* Sub-tabs */}
            <div className="flex-shrink-0 border-b border-border px-2 pt-2">
              <Tabs value={leadsSubTab} onValueChange={(v) => setLeadsSubTab(v as any)}>
                <TabsList className="h-8">
                  <TabsTrigger value="quiz" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <Users className="w-3.5 h-3.5" />
                    Leads do Quiz
                  </TabsTrigger>
                  <TabsTrigger value="whatsapp" className="text-xs gap-1.5 data-[state=active]:bg-green-600 data-[state=active]:text-white">
                    <MessageCircle className="w-3.5 h-3.5" />
                    Leads do WhatsApp
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            
            {/* Sub-tab content */}
            <div className="flex-1 min-h-0 overflow-hidden overflow-x-hidden w-full max-w-full">
              {leadsSubTab === 'quiz' && (
                <QuizLeadsList onStartConversation={handleStartConversationFromLead} />
              )}
              {leadsSubTab === 'whatsapp' && (
                <WhatsAppLeadsList onStartConversation={handleStartConversationFromLead} />
              )}
            </div>
          </div>
          
          {/* Tab: Settings - sempre renderizado */}
          <div className={activeTab === 'settings' ? 'h-full' : 'hidden'}>
            <CRMSettings 
              onClose={() => setActiveTab('conversations')} 
              onOpenConversations={() => setActiveTab('conversations')} 
            />
          </div>
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