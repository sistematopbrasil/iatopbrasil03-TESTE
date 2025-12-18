import { useState, useEffect } from 'react';
import { crmService, WhatsAppInstance } from '@/lib/crm-service';
import { toast } from 'sonner';

export function useWhatsAppConnection() {
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    loadInstance();
  }, []);

  useEffect(() => {
    if (instance?.status === 'connecting' || isConnecting) {
      const interval = setInterval(async () => {
        await refreshQRCode();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [instance?.status, isConnecting]);

  async function loadInstance() {
    setIsLoading(true);
    try {
      const data = await crmService.getInstance();
      setInstance(data);

      if (data?.status === 'connecting') {
        await refreshQRCode();
      }
    } catch (error) {
      console.error('Erro ao carregar instância:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function createInstance() {
    setIsLoading(true);
    try {
      const result = await crmService.createInstance();

      if (!result.success) {
        toast.error(result.error || 'Erro ao criar instância');
        return;
      }

      setInstance(result.data!);
      toast.success('Instância criada com sucesso!');

      await connectInstance();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar instância');
    } finally {
      setIsLoading(false);
    }
  }

  async function connectInstance() {
    setIsConnecting(true);
    try {
      const result = await crmService.getQRCode();

      if (!result.success) {
        toast.error(result.error || 'Erro ao gerar QR Code');
        return;
      }

      if (result.data?.status === 'connected') {
        toast.success('WhatsApp conectado com sucesso!');
        await loadInstance();
        setQrCode(null);
      } else if (result.data?.qr_code) {
        setQrCode(result.data.qr_code);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao conectar');
    } finally {
      setIsConnecting(false);
    }
  }

  async function refreshQRCode() {
    try {
      const result = await crmService.getQRCode();

      if (result.success) {
        if (result.data?.status === 'connected') {
          toast.success('WhatsApp conectado com sucesso!');
          await loadInstance();
          setQrCode(null);
          setIsConnecting(false);
        } else if (result.data?.qr_code) {
          setQrCode(result.data.qr_code);
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar QR Code:', error);
    }
  }

  async function disconnectInstance() {
    if (!instance) return;
    
    if (!confirm('Tem certeza que deseja desconectar o WhatsApp? Você precisará escanear o QR Code novamente.')) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Call edge function to disconnect
      const { supabase } = await import('@/integrations/supabase/client');
      const { error } = await supabase.functions.invoke('crm-disconnect-instance', {
        body: { instanceId: instance.id }
      });

      if (error) throw error;
      
      setInstance({ ...instance, status: 'disconnected' });
      setQrCode(null);
      toast.success('WhatsApp desconectado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao desconectar:', error);
      toast.error('Erro ao desconectar WhatsApp');
    } finally {
      setIsLoading(false);
    }
  }

  return {
    instance,
    qrCode,
    isLoading,
    isConnecting,
    isConnected: instance?.status === 'connected',
    createInstance,
    connectInstance,
    disconnectInstance,
    refreshQRCode,
  };
}
