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
  checkConnectionHealth: () => Promise<void>;
}

const WhatsAppConnectionContext = createContext<WhatsAppConnectionContextType | null>(null);

const CONNECT_TIMEOUT_MS = 15000; // 15 segundos timeout para conectar
const HEALTH_CHECK_INTERVAL_MS = 30000; // 30 segundos para health check quando conectado

export function WhatsAppConnectionProvider({ children }: { children: ReactNode }) {
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const healthCheckRef = useRef<NodeJS.Timeout | null>(null);
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Carrega instância inicial
  useEffect(() => {
    mountedRef.current = true;
    loadInstance();
    
    return () => {
      mountedRef.current = false;
      stopPolling();
      stopHealthCheck();
      clearConnectTimeout();
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

  // Health check periódico quando conectado
  useEffect(() => {
    if (instance?.status === 'connected') {
      startHealthCheck();
    } else {
      stopHealthCheck();
    }
    return () => stopHealthCheck();
  }, [instance?.status]);

  // Verificar conexão quando a janela receber foco
  useEffect(() => {
    const handleFocus = () => {
      if (instance?.status === 'connected') {
        checkConnectionHealth();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [instance?.status]);

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

  function startHealthCheck() {
    if (healthCheckRef.current) return;
    healthCheckRef.current = setInterval(async () => {
      if (mountedRef.current) {
        await checkConnectionHealth();
      }
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  function stopHealthCheck() {
    if (healthCheckRef.current) {
      clearInterval(healthCheckRef.current);
      healthCheckRef.current = null;
    }
  }

  function clearConnectTimeout() {
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
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
      } else if (data?.status === 'connected') {
        // Verificar se está realmente conectado
        await checkConnectionHealth();
      }
    } catch (error) {
      console.error('Erro ao carregar instância:', error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const checkConnectionHealth = useCallback(async () => {
    if (!instance) return;

    try {
      const result = await crmService.getQRCode();

      if (result.success) {
        if (result.data?.status === 'connected') {
          // Tudo OK, garantir que o estado local está correto
          if (instance.status !== 'connected') {
            setInstance((prev) => prev ? { ...prev, status: 'connected' } : prev);
            setQrCode(null);
            setIsConnecting(false);
          }
        } else if (result.data?.status === 'connecting' || result.data?.qr_code) {
          // Conexão caiu, precisa reconectar
          console.log('⚠️ Health check: WhatsApp desconectado, precisa reconectar');
          setInstance((prev) => prev ? { ...prev, status: 'connecting' } : prev);
          if (result.data?.qr_code) {
            setQrCode(result.data.qr_code);
          }
          setIsConnecting(true);
          toast.warning('WhatsApp desconectado. Por favor, escaneie o QR Code novamente.');
        } else if (result.data?.status === 'disconnected' || result.data?.status === 'close') {
          setInstance((prev) => prev ? { ...prev, status: 'disconnected' } : prev);
          setQrCode(null);
          setIsConnecting(false);
        }
      }
    } catch (error) {
      console.error('Erro no health check:', error);
    }
  }, [instance]);

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
    setQrCode(null); // Limpar QR anterior
    clearConnectTimeout();

    // Timeout de segurança
    connectTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current && isConnecting && !qrCode) {
        console.log('⏰ Timeout ao aguardar QR Code');
        setIsConnecting(false);
        toast.error('Não foi possível obter o QR Code. Tente novamente.');
      }
    }, CONNECT_TIMEOUT_MS);

    try {
      // Forçar logout na Evolution API antes de pedir novo QR
      // Isso evita cache de "connected" quando na verdade desconectou
      if (instance?.id) {
        console.log('🔄 Forçando logout antes de reconectar...');
        try {
          await supabase.functions.invoke('crm-disconnect-instance', {
            body: { instanceId: instance.id, forceLogout: true }
          });
        } catch (e) {
          // Ignorar erro - pode já estar deslogado
          console.log('⚠️ Logout prévio falhou (pode já estar deslogado):', e);
        }
        
        // Pequeno delay para garantir que o logout foi processado
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const result = await crmService.getQRCode();

      if (!result.success) {
        toast.error(result.error || 'Erro ao gerar QR Code');
        setIsConnecting(false);
        clearConnectTimeout();
        return;
      }

      if (result.data?.status === 'connected') {
        toast.success('WhatsApp conectado com sucesso!');
        await loadInstance();
        setQrCode(null);
        setIsConnecting(false);
        clearConnectTimeout();
      } else if (result.data?.qr_code) {
        setQrCode(result.data.qr_code);
        setInstance((prev) => prev ? { ...prev, status: 'connecting' } : prev);
        clearConnectTimeout(); // QR Code recebido, não precisa mais do timeout
        // manter isConnecting = true para continuar poll
      } else {
        // Não tem QR nem está conectado - tentar buscar QR novamente
        console.log('⏳ Aguardando QR Code, tentando novamente...');
        setTimeout(() => {
          if (mountedRef.current && isConnecting) {
            refreshQRCode();
          }
        }, 2000);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao conectar');
      setIsConnecting(false);
      clearConnectTimeout();
    }
  }, [loadInstance, isConnecting, qrCode, instance?.id]);

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
          clearConnectTimeout();
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
      stopPolling();
      stopHealthCheck();
      clearConnectTimeout();

      const { error } = await supabase.functions.invoke('crm-disconnect-instance', {
        body: { instanceId: instance.id }
      });

      if (error) throw error;

      setInstance({ ...instance, status: 'disconnected' });
      setQrCode(null);
      setIsConnecting(false);
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
    checkConnectionHealth,
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
