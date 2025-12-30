import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Smartphone, QrCode, CheckCircle2, AlertCircle, MessageSquare, Users, Clock, Wifi, Settings, LogOut } from 'lucide-react';
import { useWhatsAppConnectionContext } from '@/contexts/WhatsAppConnectionContext';
import { useConversations } from '@/hooks/useConversations';
import { StatCard } from '@/components/ui/stat-card';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { QrCodeRenderer } from './QrCodeRenderer';

interface ConnectionPanelProps {
  onOpenConversations?: () => void;
  hideOpenConversationsButton?: boolean;
}

export function ConnectionPanel({ onOpenConversations, hideOpenConversationsButton }: ConnectionPanelProps) {
  const {
    instance,
    qrCode,
    isLoading,
    isConnecting,
    isConnected,
    createInstance,
    connectInstance,
    disconnectInstance,
    refreshQRCode,
  } = useWhatsAppConnectionContext();

  const { conversations, totalUnread } = useConversations();
  const openConversations = conversations.filter(c => c.status === 'open').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando conexão...</p>
        </div>
      </div>
    );
  }

  // Conectado - Mostrar dashboard
  if (isConnected) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="Conversas Abertas"
            value={String(openConversations)}
            subtitle="Aguardando resposta"
            icon={MessageSquare}
            variant="primary"
          />
          <StatCard
            title="Não Lidas"
            value={String(totalUnread)}
            subtitle="Mensagens pendentes"
            icon={Users}
            variant="success"
          />
          <StatCard
            title="Total Conversas"
            value={String(conversations.length)}
            subtitle="No sistema"
            icon={Clock}
            variant="info"
          />
        </div>

        {/* Connection Status Card */}
        <Card className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-success/20 flex items-center justify-center">
                  <Wifi className="w-7 h-7 text-success" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-success rounded-full border-2 border-background flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-success-foreground" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  WhatsApp Conectado
                  <span className="inline-flex h-2 w-2 rounded-full bg-success animate-pulse" />
                </h3>
                <p className="text-sm text-muted-foreground">
                  {instance?.phone_number && (
                    <span className="font-mono text-foreground">{instance.phone_number}</span>
                  )}
                  {instance?.last_connected_at && (
                    <span className="ml-2">
                      • Ativo desde {format(new Date(instance.last_connected_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!hideOpenConversationsButton && onOpenConversations && (
                <Button 
                  onClick={onOpenConversations}
                  className="bg-gradient-to-r from-primary to-primary-light hover:from-primary/90 hover:to-primary-light/90"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Abrir Conversas
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                    <Settings className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={disconnectInstance}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Desconectar WhatsApp
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </Card>

        {/* Empty State for Conversations */}
        {conversations.length === 0 && (
          <Card className="glass-card p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Nenhuma conversa ainda</h3>
              <p className="text-muted-foreground mb-6">
                Suas conversas do WhatsApp aparecerão aqui assim que você começar a receber mensagens.
              </p>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // Sem conexão - tela inicial
  if (!instance) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <Card className="glass-card p-10 text-center max-w-md animate-scale-in">
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center shadow-glow animate-pulse-glow">
                <Smartphone className="w-10 h-10 text-primary-foreground" />
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-foreground mb-2">CRM WhatsApp</h3>
              <p className="text-muted-foreground">
                Conecte seu WhatsApp para gerenciar conversas e leads
              </p>
            </div>
            <Button
              onClick={createInstance}
              disabled={isLoading || isConnecting}
              size="lg"
              className="bg-gradient-to-r from-primary to-primary-light hover:from-primary/90 hover:to-primary-light/90 shadow-glow hover-lift disabled:opacity-70"
            >
              {(isLoading || isConnecting) ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <QrCode className="w-5 h-5 mr-2" />
                  Conectar WhatsApp
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Conectando (QR Code) ou desconectado com instância existente
  if (instance.status === 'connecting' || qrCode) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <Card className="glass-card p-10 text-center max-w-md animate-scale-in">
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <QrCode className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-foreground mb-2">Escaneie o QR Code</h3>
              <p className="text-muted-foreground text-sm">
                Abra o WhatsApp no seu celular → Menu (⋮) → Dispositivos conectados → Conectar dispositivo
              </p>
            </div>

            {qrCode ? (
              <div className="bg-white p-4 rounded-xl shadow-lg">
                <QrCodeRenderer value={qrCode} size={256} />
              </div>
            ) : (
              <div className="w-64 h-64 bg-muted rounded-xl flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
              </div>
            )}

            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Atualizando automaticamente...
              </div>
              <Button size="sm" variant="ghost" onClick={refreshQRCode} className="text-xs">
                <QrCode className="w-3 h-3 mr-1" /> Atualizar QR Code
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Desconectado (instância existe mas não está conectando)
  return (
    <div className="flex items-center justify-center min-h-[500px]">
      <Card className="glass-card p-10 text-center max-w-md animate-scale-in">
        <div className="flex flex-col items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-warning/20 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-warning" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-foreground mb-2">WhatsApp Desconectado</h3>
            <p className="text-muted-foreground">
              Reconecte para continuar recebendo mensagens
            </p>
          </div>
          <Button
            onClick={connectInstance}
            disabled={isConnecting}
            size="lg"
            className="bg-gradient-to-r from-primary to-primary-light hover:from-primary/90 hover:to-primary-light/90 shadow-glow hover-lift"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Reconectando...
              </>
            ) : (
              <>
                <QrCode className="w-5 h-5 mr-2" />
                Reconectar WhatsApp
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
