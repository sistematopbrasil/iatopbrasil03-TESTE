import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { toast } from 'sonner';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    // Detectar evento de instalação
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Verificar se já está instalado
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('✅ PWA já está instalado');
      setShowInstallBanner(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // iOS - mostrar instruções
      if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        toast.info(
          '📱 Para instalar no iOS:\n\n' +
          '1. Toque no botão de compartilhar\n' +
          '2. Role para baixo e toque em "Adicionar à Tela de Início"\n' +
          '3. Toque em "Adicionar"',
          { duration: 10000 }
        );
        return;
      }

      toast.error('Instalação não disponível neste navegador');
      return;
    }

    // Mostrar prompt de instalação
    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('✅ PWA instalado');
      toast.success('✅ App instalado com sucesso!');
    } else {
      console.log('❌ Instalação cancelada');
    }

    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  if (!showInstallBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 lg:left-auto lg:right-4 lg:w-96 z-50">
      <div className="bg-gradient-to-r from-primary to-orange-600 text-white p-4 rounded-lg shadow-2xl">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            <h3 className="font-semibold">Instalar TOP Brasil</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowInstallBanner(false)}
            className="text-white hover:bg-white/20 h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm mb-3 opacity-90">
          Instale o app para acesso rápido e trabalhe offline!
        </p>
        <Button
          onClick={handleInstall}
          className="w-full bg-white text-primary hover:bg-gray-100 font-semibold"
        >
          Instalar Agora
        </Button>
      </div>
    </div>
  );
}
