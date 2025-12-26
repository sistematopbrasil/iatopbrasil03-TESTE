import { useState, useEffect, useRef } from 'react';
import { crmService, WhatsAppInstance } from '@/lib/crm-service';
import { toast } from 'sonner';

export function useWhatsAppConnection() {
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadInstance();
    return () => stopPolling();
  }, []);

  // Polling enquanto houver QR visível ou status connecting
  useEffect(() => {
    const shouldPoll = qrCode !== null || isConnecting || instance?.status === 'connecting';
    if (shouldPoll) {
      startPolling();
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [qrCode, isConnecting, instance?.status]);

  function startPolling() {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      await refreshQRCode();
    }, 3500); // Intervalo mais curto para refresh mais ágil
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function loadInstance() {
    setIsLoading(true);
    try {
      const data = await crmService.getInstance();
      setInstance(data);

      if (data?.status === 'connecting') {
        setIsConnecting(true);
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
    setIsConnecting(true);
    try {
      const result = await crmService.createInstance();

      if (!result.success) {
        toast.error(result.error || 'Erro ao criar instância');
        setIsConnecting(false);
        return;
      }

      setInstance(result.data!);
      toast.success('Instância criada com sucesso!');

      await connectInstance();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar instância');
      setIsConnecting(false);
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
        setIsConnecting(false);
        return;
      }

      if (result.data?.status === 'connected') {
        toast.success('WhatsApp conectado com sucesso!');
        await loadInstance();
        setQrCode(null);
        setIsConnecting(false);
      } else if (result.data?.qr_code) {
        setQrCode(result.data.qr_code);
        // manter isConnecting = true para continuar poll
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao conectar');
      setIsConnecting(false);
    }
  }

  async function refreshQRCode() {
    try {
      const result = await crmService.getQRCode();

      if (result.success) {
        if (result.data?.status === 'connected') {
          toast.success('WhatsApp conectado com sucesso!');
          setInstance((prev) => prev ? { ...prev, status: 'connected' } : prev);
          setQrCode(null);
          setIsConnecting(false);
          stopPolling();
          await loadInstance();
        } else if (result.data?.qr_code) {
          setQrCode(result.data.qr_code);
          setInstance((prev) => prev ? { ...prev, status: 'connecting' } : prev);
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
    refreshQRCode, // exposto para refresh manual
  };
}
