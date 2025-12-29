import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle, QrCode, Loader2, WifiOff } from 'lucide-react';
import { useWhatsAppConnectionContext } from '@/contexts/WhatsAppConnectionContext';

export function DisconnectedOverlay() {
  const { connectInstance, isConnecting, qrCode, refreshQRCode } = useWhatsAppConnectionContext();

  // Se está mostrando QR Code, mostrar tela de escaneamento
  if (isConnecting && qrCode) {
    return (
      <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <Card className="glass-card p-8 text-center max-w-md animate-scale-in">
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <QrCode className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground mb-2">Escaneie o QR Code</h3>
              <p className="text-muted-foreground text-sm">
                Abra o WhatsApp → Menu (⋮) → Dispositivos conectados
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-lg">
              <img src={qrCode} alt="QR Code" className="w-56 h-56" />
            </div>

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

  // Se está conectando mas sem QR ainda
  if (isConnecting) {
    return (
      <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <Card className="glass-card p-8 text-center max-w-md animate-scale-in">
          <div className="flex flex-col items-center gap-6">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <div>
              <h3 className="text-xl font-bold text-foreground mb-2">Gerando QR Code...</h3>
              <p className="text-muted-foreground text-sm">
                Aguarde enquanto preparamos a conexão
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Desconectado - overlay principal
  return (
    <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="glass-card p-8 text-center max-w-md animate-scale-in border-destructive/30">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center">
              <WifiOff className="w-10 h-10 text-destructive" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-destructive rounded-full flex items-center justify-center animate-pulse">
              <AlertTriangle className="w-4 h-4 text-destructive-foreground" />
            </div>
          </div>
          
          <div>
            <h3 className="text-xl font-bold text-foreground mb-2">WhatsApp Desconectado</h3>
            <p className="text-muted-foreground text-sm">
              Reconecte para enviar e receber mensagens
            </p>
          </div>

          <Button
            onClick={connectInstance}
            size="lg"
            className="bg-gradient-to-r from-primary to-primary-light hover:from-primary/90 hover:to-primary-light/90 shadow-glow"
          >
            <QrCode className="w-5 h-5 mr-2" />
            Reconectar Agora
          </Button>
        </div>
      </Card>
    </div>
  );
}
