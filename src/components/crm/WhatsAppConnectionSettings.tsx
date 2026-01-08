import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Phone, 
  Calendar,
  AlertCircle,
  LogOut,
  RefreshCw,
  MessageSquare,
  QrCode,
  Activity,
  Clock
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useWhatsAppConnectionContext } from '@/contexts/WhatsAppConnectionContext';
import { QrCodeRenderer } from './QrCodeRenderer';

interface WhatsAppConnectionSettingsProps {
  onOpenConversations?: () => void;
}

export function WhatsAppConnectionSettings({ onOpenConversations }: WhatsAppConnectionSettingsProps) {
  const {
    instance,
    qrCode,
    isLoading,
    isConnecting,
    isConnected,
    connectInstance,
    disconnectInstance,
    refreshInstance,
    refreshQRCode,
  } = useWhatsAppConnectionContext();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Mostrar QR Code se estiver conectando
  if ((isConnecting || instance?.status === 'connecting') && qrCode) {
    return (
      <div className="space-y-6 overflow-x-hidden max-w-full">
        <Card className="p-4 sm:p-6 border-2 border-primary/20 bg-primary/5">
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <QrCode className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-foreground mb-2">Escaneie o QR Code</h3>
              <p className="text-muted-foreground text-sm">
                Abra o WhatsApp no seu celular → Menu (⋮) → Dispositivos conectados
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-lg">
              <QrCodeRenderer value={qrCode} size={256} />
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Atualizando automaticamente...
              </div>
              <Button size="sm" variant="ghost" onClick={refreshQRCode} className="text-xs">
                <RefreshCw className="w-3 h-3 mr-1" /> Atualizar QR Code
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-x-hidden max-w-full">
      {/* Status Card */}
      <Card className={`p-4 sm:p-6 border-2 overflow-hidden ${
        isConnected 
          ? 'border-green-500/20 bg-green-500/5' 
          : 'border-destructive/20 bg-destructive/5'
      }`}>
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
            <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center flex-shrink-0 ${
              isConnected ? 'bg-green-500/20' : 'bg-destructive/20'
            }`}>
              {isConnected ? (
                <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
              ) : (
                <XCircle className="w-6 h-6 sm:w-8 sm:h-8 text-destructive" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-xl font-bold text-foreground mb-2">
                {isConnected ? 'WhatsApp Conectado' : 'WhatsApp Desconectado'}
              </h3>
              
              {isConnected && instance ? (
                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-muted-foreground">
                    <Phone className="w-3 h-3 sm:w-4 sm:h-4 text-primary flex-shrink-0" />
                    <span className="font-semibold">Número:</span>
                    <span className="truncate">{instance.phone_number || 'Não identificado'}</span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-muted-foreground">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-primary flex-shrink-0" />
                    <span className="font-semibold">Desde:</span>
                    <span className="truncate">
                      {instance.last_connected_at 
                        ? format(new Date(instance.last_connected_at), "dd/MM/yy HH:mm", { locale: ptBR })
                        : 'Data desconhecida'
                      }
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-green-600 text-white text-[10px] sm:text-xs">Ativo</Badge>
                    <span className="text-[10px] sm:text-xs text-muted-foreground">
                      Recebendo em tempo real
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  {instance 
                    ? 'Sua conexão foi perdida. Reconecte escaneando o QR Code.'
                    : 'Você precisa conectar seu WhatsApp para usar o CRM.'
                  }
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            {isConnected && instance && (
              <>
                {onOpenConversations && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={onOpenConversations}
                    className="h-8 text-xs"
                  >
                    <MessageSquare className="w-3 h-3 sm:mr-1" />
                    <span className="hidden sm:inline">Abrir Conversas</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshInstance}
                  className="glass h-8 w-8 p-0"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={disconnectInstance}
                  disabled={isLoading}
                  className="text-destructive hover:bg-destructive/20 hover:text-destructive h-8 text-xs"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      <span className="hidden sm:inline">Desconectando...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="w-3 h-3 sm:mr-1" />
                      <span className="hidden sm:inline">Desconectar</span>
                    </>
                  )}
                </Button>
              </>
            )}

            {/* Botão de reconectar quando desconectado */}
            {!isConnected && instance && (
              <Button
                variant="default"
                size="sm"
                onClick={connectInstance}
                disabled={isConnecting}
                className="h-8 text-xs"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    <span>Conectando...</span>
                  </>
                ) : (
                  <>
                    <QrCode className="w-3 h-3 sm:mr-1" />
                    <span>Reconectar WhatsApp</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Technical Info + Webhook Telemetry */}
      {instance && (
        <Card className="glass p-4 sm:p-6 overflow-hidden">
          <h4 className="text-xs sm:text-sm font-semibold text-muted-foreground mb-3 sm:mb-4">
            Informações Técnicas
          </h4>
          <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground flex-shrink-0">Instância:</span>
              <span className="text-foreground font-mono truncate max-w-[150px] sm:max-w-none">{instance.instance_name}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground flex-shrink-0">Status:</span>
              <Badge variant={isConnected ? 'default' : 'outline'} className="text-[10px] sm:text-xs">
                {instance.status || 'desconectado'}
              </Badge>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground flex-shrink-0">Criado:</span>
              <span className="text-foreground truncate">
                {format(new Date(instance.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
              </span>
            </div>
          </div>

          {/* Webhook Telemetry */}
          <div className="mt-4 pt-4 border-t border-border">
            <h5 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
              <Activity className="w-3 h-3" />
              Saúde do Webhook
            </h5>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Último evento:
                </span>
                <span className={`font-medium ${
                  (instance as any).last_webhook_at 
                    ? (Date.now() - new Date((instance as any).last_webhook_at).getTime() < 120000 
                        ? 'text-green-500' 
                        : 'text-amber-500')
                    : 'text-muted-foreground'
                }`}>
                  {(instance as any).last_webhook_at 
                    ? formatDistanceToNow(new Date((instance as any).last_webhook_at), { addSuffix: true, locale: ptBR })
                    : 'Nenhum evento recebido'
                  }
                </span>
              </div>
              {(instance as any).last_webhook_event && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Tipo:</span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {(instance as any).last_webhook_event}
                  </Badge>
                </div>
              )}
              {/* Warning if webhook is stale */}
              {isConnected && (instance as any).last_webhook_at && 
                (Date.now() - new Date((instance as any).last_webhook_at).getTime() > 300000) && (
                <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-amber-200 text-[10px]">
                  ⚠️ Nenhum evento recebido há mais de 5 minutos. O webhook pode estar com problemas.
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Warning */}
      <Card className="p-4 border-amber-500/20 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200">
            <p className="font-semibold mb-1">Importante:</p>
            <p>
              Ao desconectar, você perderá o acesso às conversas até reconectar. 
              Todas as mensagens e histórico serão mantidos no banco de dados.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
