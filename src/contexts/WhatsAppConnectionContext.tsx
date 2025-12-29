import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { crmService, WhatsAppInstance } from '@/lib/crm-service';
import { toast } from 'sonner';

interface WhatsAppConnectionContextType {
  instance: WhatsAppInstance | null;
  qrCode: string | null;
  isLoading: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  createInstance: () => Promise<void>;
  connectInstance: () => Promise<void>;
  disconnectInstance: () => Promise<void>;
  refreshInstance: () => Promise<void>;
  refreshQRCode: () => Promise<void>;
}

const WhatsAppConnectionContext = createContext<WhatsAppConnectionContextType | null>(null);

export function WhatsAppConnectionProvider({ children }: { children: ReactNode }) {
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Carrega instância inicial
  useEffect(() => {
    mountedRef.current = true;
    loadInstance();
    
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
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
      if (mountedRef.current) {
        await refreshQRCode();
      }
    }, 3500);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  const loadInstance = useCallback(async () => {
    if (!mountedRef.current) return;
    setIsLoading(true);
    try {
      const data = await crmService.getInstance();
      if (!mountedRef.current) return;
      setInstance(data);

      if (data?.status === 'connecting') {
        setIsConnecting(true);
        await refreshQRCode();
      }
    } catch (error) {
      console.error('Erro ao carregar instância:', error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const createInstance = useCallback(async () => {
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
      toast.success('Conexão iniciada! Escaneie o QR Code.');

      // Buscar QR Code
      await connectInstance();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar instância');
      setIsConnecting(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const connectInstance = useCallback(async () => {
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
        setInstance((prev) => prev ? { ...prev, status: 'connecting' } : prev);
        // manter isConnecting = true para continuar poll
      } else {
        // Não tem QR nem está conectado - pode ser estado "close"
        // Tentar novamente em alguns segundos via polling
        console.log('⏳ Aguardando QR Code...');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao conectar');
      setIsConnecting(false);
    }
  }, [loadInstance]);

  const refreshQRCode = useCallback(async () => {
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
  }, [loadInstance]);

  const disconnectInstance = useCallback(async () => {
    if (!instance) return;

    if (!confirm('Tem certeza que deseja desconectar o WhatsApp? Você precisará escanear o QR Code novamente.')) {
      return;
    }

    try {
      setIsLoading(true);

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
  }, [instance]);

  const refreshInstance = useCallback(async () => {
    await loadInstance();
  }, [loadInstance]);

  const value: WhatsAppConnectionContextType = {
    instance,
    qrCode,
    isLoading,
    isConnecting,
    isConnected: instance?.status === 'connected',
    createInstance,
    connectInstance,
    disconnectInstance,
    refreshInstance,
    refreshQRCode,
  };

  return (
    <WhatsAppConnectionContext.Provider value={value}>
      {children}
    </WhatsAppConnectionContext.Provider>
  );
}

export function useWhatsAppConnectionContext() {
  const context = useContext(WhatsAppConnectionContext);
  if (!context) {
    throw new Error('useWhatsAppConnectionContext must be used within a WhatsAppConnectionProvider');
  }
  return context;
}
