import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  status: string | null;
  phone_number: string | null;
  last_connected_at: string | null;
  created_at: string;
}

export function WhatsAppConnectionSettings() {
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  useEffect(() => {
    loadInstance();
  }, []);

  const loadInstance = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setInstance(data);
    } catch (error) {
      console.error('Erro ao carregar instância:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!instance) return;
    
    if (!confirm('Tem certeza que deseja desconectar o WhatsApp? Você precisará escanear o QR Code novamente.')) {
      return;
    }

    try {
      setIsDisconnecting(true);

      const { error } = await supabase.functions.invoke('crm-disconnect-instance', {
        body: { instanceId: instance.id }
      });

      if (error) throw error;

      toast.success('WhatsApp desconectado com sucesso!');
      await loadInstance();
    } catch (error) {
      console.error('Erro ao desconectar:', error);
      toast.error('Erro ao desconectar WhatsApp');
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isConnected = instance?.status === 'connected';

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
                    ? 'Sua conexão foi perdida. Reconecte na aba de conversas.'
                    : 'Você precisa conectar seu WhatsApp para usar o CRM.'
                  }
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          {isConnected && instance && (
            <div className="flex gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={loadInstance}
                className="glass h-8 w-8 p-0"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="text-destructive hover:bg-destructive/20 hover:text-destructive h-8 text-xs"
              >
                {isDisconnecting ? (
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
            </div>
          )}
        </div>
      </Card>

      {/* Technical Info */}
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
