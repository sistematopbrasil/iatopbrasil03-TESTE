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
  connectionVerified: boolean;
  createInstance: () => Promise<void>;
  connectInstance: () => Promise<void>;
  disconnectInstance: () => Promise<void>;
  refreshInstance: () => Promise<void>;
  refreshQRCode: () => Promise<void>;
  checkConnectionHealth: () => Promise<boolean>;
}

const WhatsAppConnectionContext = createContext<WhatsAppConnectionContextType | null>(null);

const CONNECT_TIMEOUT_MS = 15000;
const HEALTH_CHECK_INTERVAL_MS = 15000; // 15 segundos - mais frequente
const MAX_FAILED_CHECKS = 2; // Após 2 falhas consecutivas, marca como desconectado

export function WhatsAppConnectionProvider({ children }: { children: ReactNode }) {
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionVerified, setConnectionVerified] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const healthCheckRef = useRef<NodeJS.Timeout | null>(null);
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const failedChecksRef = useRef(0);
  const lastToastRef = useRef<number>(0);

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
    failedChecksRef.current = 0;
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

  const showDisconnectToast = useCallback(() => {
    const now = Date.now();
    // Evitar spam de toasts - só mostrar se passou mais de 30 segundos
    if (now - lastToastRef.current > 30000) {
      lastToastRef.current = now;
      toast.error('WhatsApp desconectado! Reconecte para enviar mensagens.', {
        duration: 5000,
        action: {
          label: 'Reconectar',
          onClick: () => connectInstance(),
        },
      });
    }
  }, []);

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
        // Verificar se está REALMENTE conectado
        const isReallyConnected = await checkConnectionHealth();
        setConnectionVerified(isReallyConnected);
      }
    } catch (error) {
      console.error('Erro ao carregar instância:', error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const checkConnectionHealth = useCallback(async (): Promise<boolean> => {
    if (!instance) return false;

    try {
      // Usar endpoint dedicado para verificar conexão real
      const { data, error } = await supabase.functions.invoke('crm-check-connection');
      
      if (error) {
        console.error('Erro no health check:', error);
        failedChecksRef.current++;
        
        if (failedChecksRef.current >= MAX_FAILED_CHECKS) {
          setInstance((prev) => prev ? { ...prev, status: 'disconnected' } : prev);
          setConnectionVerified(false);
          showDisconnectToast();
          return false;
        }
        return instance.status === 'connected';
      }

      const result = data;
      console.log('🔍 Health check result:', result);

      if (result?.data?.reallyConnected) {
        // Realmente conectado
        failedChecksRef.current = 0;
        setConnectionVerified(true);
        if (instance.status !== 'connected') {
          setInstance((prev) => prev ? { ...prev, status: 'connected' } : prev);
          setQrCode(null);
          setIsConnecting(false);
        }
        return true;
      } else {
        // Não está conectado de verdade
        failedChecksRef.current++;
        console.log(`⚠️ Health check failed (${failedChecksRef.current}/${MAX_FAILED_CHECKS})`);
        
        if (failedChecksRef.current >= MAX_FAILED_CHECKS) {
          setInstance((prev) => prev ? { ...prev, status: 'disconnected' } : prev);
          setQrCode(null);
          setIsConnecting(false);
          setConnectionVerified(false);
          showDisconnectToast();
          return false;
        }
        return false;
      }
    } catch (error) {
      console.error('Erro no health check:', error);
      failedChecksRef.current++;
      
      if (failedChecksRef.current >= MAX_FAILED_CHECKS) {
        setInstance((prev) => prev ? { ...prev, status: 'disconnected' } : prev);
        setConnectionVerified(false);
        showDisconnectToast();
        return false;
      }
      return false;
    }
  }, [instance, showDisconnectToast]);

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
    setQrCode(null);
    setConnectionVerified(false);
    failedChecksRef.current = 0;
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
      // SEMPRE forçar logout na Evolution API antes de pedir novo QR
      if (instance?.id) {
        console.log('🔄 Forçando logout antes de reconectar...');
        try {
          await supabase.functions.invoke('crm-disconnect-instance', {
            body: { instanceId: instance.id, forceLogout: true }
          });
        } catch (e) {
          console.log('⚠️ Logout prévio falhou (pode já estar deslogado):', e);
        }
        
        // Delay para garantir que o logout foi processado
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Buscar QR Code com forceNewQR
      const result = await crmService.getQRCode(true);

      if (!result.success) {
        toast.error(result.error || 'Erro ao gerar QR Code');
        setIsConnecting(false);
        clearConnectTimeout();
        return;
      }

      if (result.data?.status === 'connected') {
        // Verificar se está REALMENTE conectado
        const isReallyConnected = await checkConnectionHealth();
        
        if (isReallyConnected) {
          toast.success('WhatsApp conectado com sucesso!');
          await loadInstance();
          setQrCode(null);
          setIsConnecting(false);
          setConnectionVerified(true);
        } else {
          // Diz conectado mas não está - forçar novo QR
          console.log('⚠️ Estado dizia conectado mas não está. Forçando novo QR...');
          const retryResult = await crmService.getQRCode(true);
          if (retryResult.data?.qr_code) {
            setQrCode(retryResult.data.qr_code);
            setInstance((prev) => prev ? { ...prev, status: 'connecting' } : prev);
          }
        }
        clearConnectTimeout();
      } else if (result.data?.qr_code) {
        setQrCode(result.data.qr_code);
        setInstance((prev) => prev ? { ...prev, status: 'connecting' } : prev);
        clearConnectTimeout();
      } else {
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
  }, [loadInstance, isConnecting, qrCode, instance?.id, checkConnectionHealth]);

  // Refresh via banco de dados (sem chamar edge function repetidamente)
  const refreshQRCode = useCallback(async () => {
    try {
      // Priorizar leitura do banco para evitar chamadas repetidas à Evolution API
      const instanceData = await crmService.getInstance();
      
      if (!instanceData) return;
      
      // Atualizar estado local com dados do banco
      setInstance(instanceData);
      
      if (instanceData.status === 'connected') {
        // Verificar se está realmente conectado
        const isReallyConnected = await checkConnectionHealth();
        
        if (isReallyConnected) {
          if (isConnecting) {
            toast.success('WhatsApp conectado com sucesso!');
          }
          setQrCode(null);
          setIsConnecting(false);
          setConnectionVerified(true);
          stopPolling();
          clearConnectTimeout();
        }
      } else if (instanceData.qr_code) {
        // QR Code já está no banco (atualizado por webhook)
        setQrCode(instanceData.qr_code);
      } else if (instanceData.status === 'connecting' && !qrCode) {
        // Ainda connecting mas sem QR - aguardar mais um pouco
        console.log('⏳ Status connecting mas sem QR Code ainda...');
      }
    } catch (error) {
      console.error('Erro ao atualizar QR Code:', error);
    }
  }, [checkConnectionHealth, isConnecting, qrCode]);

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
      setConnectionVerified(false);
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
    isConnected: instance?.status === 'connected' && connectionVerified,
    connectionVerified,
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
