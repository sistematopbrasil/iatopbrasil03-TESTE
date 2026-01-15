import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, X, Smartphone } from 'lucide-react';

export function InstallAdminPWA() {
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  
  useEffect(() => {
    // Verificar se já está em modo standalone (já instalado)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as any).standalone === true;
    
    if (isStandalone) {
      setShowBanner(false);
      return;
    }
    
    // Verificar se já foi descartado recentemente
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      const hoursSinceDismissed = (Date.now() - dismissedAt) / (1000 * 60 * 60);
      if (hoursSinceDismissed < 24) {
        setShowBanner(false);
        return;
      }
    }
    
    // Detectar plataforma
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    const isAndroidDevice = /android/.test(userAgent);
    
    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);
    
    // Mostrar apenas em mobile
    if (isIOSDevice || isAndroidDevice) {
      setShowBanner(true);
    }
  }, []);
  
  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    setShowBanner(false);
  };
  
  if (!showBanner) return null;
  
  return (
    <Card className="mx-4 mb-4 p-4 bg-gradient-to-r from-primary/20 to-primary/5 border-primary/30">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Smartphone className="w-5 h-5 text-primary" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-sm mb-1">
            Instalar App Admin
          </h3>
          <p className="text-xs text-muted-foreground mb-2">
            {isIOS ? (
              <>
                Toque em <strong>Compartilhar</strong> (ícone de seta) e depois em{' '}
                <strong>"Adicionar à Tela Inicial"</strong>
              </>
            ) : isAndroid ? (
              <>
                Toque no menu (⋮) e selecione{' '}
                <strong>"Adicionar à tela inicial"</strong>
              </>
            ) : (
              'Adicione este app à sua tela inicial para acesso rápido'
            )}
          </p>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-xs h-7 px-2"
            >
              <X className="w-3 h-3 mr-1" />
              Depois
            </Button>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="h-8 w-8 p-0 flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}
