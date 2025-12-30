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
  evolutionState: string | null;
  createInstance: () => Promise<void>;
  connectInstance: () => Promise<void>;
  disconnectInstance: () => Promise<void>;
  refreshInstance: () => Promise<void>;
  refreshQRCode: () => Promise<void>;
  checkConnectionHealth: () => Promise<boolean>;
  repairConnection: (mode: 'soft' | 'hard') => Promise<void>;
}

const WhatsAppConnectionContext = createContext<WhatsAppConnectionContextType | null>(null);

const CONNECTION_TIMEOUT_MS = 90000; // 90 segundos
const HEALTH_CHECK_INTERVAL_MS = 15000;
const ACTIVE_CHECK_INTERVAL_MS = 500; // 500ms durante connecting - bem rápido
const MAX_FAILED_CHECKS = 2;
const QR_FAST_POLL_ATTEMPTS = 40; // Mais tentativas rápidas para buscar QR
const QR_FAST_POLL_DELAY = 150; // 150ms entre tentativas - mais rápido

export function WhatsAppConnectionProvider({ children }: { children: ReactNode }) {
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionVerified, setConnectionVerified] = useState(false);
  const [evolutionState, setEvolutionState] = useState<string | null>(null);
  
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const healthCheckRef = useRef<NodeJS.Timeout | null>(null);
  const activeCheckRef = useRef<NodeJS.Timeout | null>(null);
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const failedChecksRef = useRef(0);
  const lastToastRef = useRef<number>(0);
  const isConnectingRef = useRef(false); // Evitar múltiplas chamadas

  // Carrega instância inicial
  useEffect(() => {
    mountedRef.current = true;
    loadInstance();
    
    return () => {
      mountedRef.current = false;
      stopPolling();
      stopHealthCheck();
      stopActiveCheck();
      clearConnectTimeout();
    };
  }, []);

  // Polling do banco enquanto houver QR visível ou status connecting
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

  // Verificação ativa durante connecting (a cada 2s)
  useEffect(() => {
    if (isConnecting) {
      startActiveCheck();
    } else {
      stopActiveCheck();
    }
    return () => stopActiveCheck();
  }, [isConnecting]);

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
        await refreshFromDatabase();
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

  function startActiveCheck() {
    if (activeCheckRef.current) return;
    activeCheckRef.current = setInterval(async () => {
      if (mountedRef.current && isConnecting) {
        await checkConnectionHealth();
      }
    }, ACTIVE_CHECK_INTERVAL_MS);
  }

  function stopActiveCheck() {
    if (activeCheckRef.current) {
      clearInterval(activeCheckRef.current);
      activeCheckRef.current = null;
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
    if (now - lastToastRef.current > 30000) {
      lastToastRef.current = now;
      toast.error('WhatsApp desconectado! Reconecte para enviar mensagens.', {
        duration: 5000,
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
        if (data.qr_code) {
          setQrCode(data.qr_code);
        }
      } else if (data?.status === 'connected') {
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

  // Ler do banco sem chamar Evolution API
  const refreshFromDatabase = useCallback(async () => {
    try {
      const instanceData = await crmService.getInstance();
      if (!instanceData || !mountedRef.current) return;
      
      setInstance(instanceData);
      
      if (instanceData.status === 'connected') {
        if (isConnecting) {
          toast.success('WhatsApp conectado com sucesso!');
        }
        setQrCode(null);
        setIsConnecting(false);
        isConnectingRef.current = false;
        setConnectionVerified(true);
        stopPolling();
        stopActiveCheck();
        clearConnectTimeout();
      } else if (instanceData.qr_code && instanceData.qr_code !== qrCode) {
        setQrCode(instanceData.qr_code);
      }
    } catch (error) {
      console.error('Erro ao ler banco:', error);
    }
  }, [isConnecting, qrCode]);

  const checkConnectionHealth = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('crm-check-connection');
      
      if (error) {
        console.error('Erro no health check:', error);
        failedChecksRef.current++;
        
        if (failedChecksRef.current >= MAX_FAILED_CHECKS && instance?.status === 'connected') {
          setInstance((prev) => prev ? { ...prev, status: 'disconnected' } : prev);
          setConnectionVerified(false);
          showDisconnectToast();
          return false;
        }
        return false;
      }

      const result = data;
      setEvolutionState(result?.data?.evolutionState || null);

      if (result?.data?.reallyConnected) {
        failedChecksRef.current = 0;
        setConnectionVerified(true);
        
        if (isConnecting) {
          console.log('✅ Conexão detectada via check!');
          toast.success('WhatsApp conectado com sucesso!');
          setInstance((prev) => prev ? { ...prev, status: 'connected' } : prev);
          setQrCode(null);
          setIsConnecting(false);
          isConnectingRef.current = false;
          stopActiveCheck();
          clearConnectTimeout();
        } else if (instance?.status !== 'connected') {
          setInstance((prev) => prev ? { ...prev, status: 'connected' } : prev);
          setQrCode(null);
        }
        return true;
      } else {
        if (instance?.status === 'connected') {
          failedChecksRef.current++;
          
          if (failedChecksRef.current >= MAX_FAILED_CHECKS) {
            setInstance((prev) => prev ? { ...prev, status: 'disconnected' } : prev);
            setQrCode(null);
            setIsConnecting(false);
            isConnectingRef.current = false;
            setConnectionVerified(false);
            showDisconnectToast();
            return false;
          }
        }
        return false;
      }
    } catch (error) {
      console.error('Erro no health check:', error);
      return false;
    }
  }, [instance?.status, isConnecting, showDisconnectToast]);

  const createInstance = useCallback(async () => {
    setIsLoading(true);
    setIsConnecting(true);
    isConnectingRef.current = true;
    try {
      const result = await crmService.createInstance();

      if (!result.success) {
        toast.error(result.error || 'Erro ao criar instância');
        setIsConnecting(false);
        isConnectingRef.current = false;
        return;
      }

      setInstance(result.data!);
      toast.success('Conexão iniciada! Escaneie o QR Code.');
      await connectInstance();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar instância');
      setIsConnecting(false);
      isConnectingRef.current = false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const connectInstance = useCallback(async () => {
    // Evitar múltiplas chamadas simultâneas
    if (isConnectingRef.current) {
      console.log('⏳ Já está conectando, ignorando chamada duplicada');
      return;
    }

    isConnectingRef.current = true;
    setIsConnecting(true);
    setQrCode(null);
    setConnectionVerified(false);
    failedChecksRef.current = 0;
    clearConnectTimeout();

    // Timeout de segurança (90 segundos)
    connectTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current && isConnectingRef.current) {
        console.log('⏰ Timeout de conexão');
        // Não resetar isConnecting aqui, apenas mostrar aviso
      }
    }, CONNECTION_TIMEOUT_MS);

    try {
      // Usar soft repair para conectar (não faz logout agressivo)
      const { data, error } = await supabase.functions.invoke('crm-repair-connection', {
        body: { mode: 'soft' }
      });

      if (error) {
        console.error('Erro ao conectar:', error);
        toast.error('Erro ao conectar. Tente novamente.');
        setIsConnecting(false);
        isConnectingRef.current = false;
        clearConnectTimeout();
        return;
      }

      console.log('🔗 Repair result:', data);

      if (data?.data?.status === 'connected') {
        toast.success('WhatsApp conectado com sucesso!');
        await loadInstance();
        setQrCode(null);
        setIsConnecting(false);
        isConnectingRef.current = false;
        setConnectionVerified(true);
        clearConnectTimeout();
      } else if (data?.data?.qr_code) {
        setQrCode(data.data.qr_code);
        setInstance((prev) => prev ? { ...prev, status: 'connecting' } : prev);
        // Manter isConnecting = true para polling ativo
      } else {
        // QR ainda não disponível - polling rápido para buscar do banco
        console.log('⏳ Aguardando QR via webhook - iniciando polling rápido...');
        setInstance((prev) => prev ? { ...prev, status: 'connecting' } : prev);
        
        // Polling agressivo: 20 tentativas de 200ms para capturar QR rapidamente
        let attempts = 0;
        const fastPoll = setInterval(async () => {
          attempts++;
          if (!mountedRef.current || attempts > QR_FAST_POLL_ATTEMPTS) {
            clearInterval(fastPoll);
            return;
          }
          
          try {
            const instanceData = await crmService.getInstance();
            if (instanceData?.qr_code) {
              console.log(`✅ QR capturado na tentativa ${attempts}!`);
              setQrCode(instanceData.qr_code);
              setInstance(instanceData);
              clearInterval(fastPoll);
            } else if (instanceData?.status === 'connected') {
              console.log('✅ Conectado durante polling rápido!');
              toast.success('WhatsApp conectado com sucesso!');
              setInstance(instanceData);
              setQrCode(null);
              setIsConnecting(false);
              isConnectingRef.current = false;
              setConnectionVerified(true);
              clearConnectTimeout();
              clearInterval(fastPoll);
            }
          } catch (e) {
            console.error('Erro no polling rápido:', e);
          }
        }, QR_FAST_POLL_DELAY);
      }
    } catch (error: any) {
      console.error('Erro ao conectar:', error);
      toast.error(error.message || 'Erro ao conectar');
      setIsConnecting(false);
      isConnectingRef.current = false;
      clearConnectTimeout();
    }
  }, [loadInstance]);

  const repairConnection = useCallback(async (mode: 'soft' | 'hard') => {
    if (isConnectingRef.current) {
      console.log('⏳ Já está processando, ignorando');
      return;
    }

    isConnectingRef.current = true;
    setIsConnecting(true);
    setQrCode(null);
    
    const loadingToast = toast.loading(
      mode === 'hard' ? 'Resetando sessão...' : 'Reconectando...'
    );

    try {
      const { data, error } = await supabase.functions.invoke('crm-repair-connection', {
        body: { mode }
      });

      toast.dismiss(loadingToast);

      if (error) {
        toast.error('Erro ao reparar conexão');
        setIsConnecting(false);
        isConnectingRef.current = false;
        return;
      }

      console.log('🔧 Repair result:', data);

      if (data?.data?.status === 'connected') {
        toast.success('WhatsApp conectado!');
        setIsConnecting(false);
        isConnectingRef.current = false;
        await loadInstance();
      } else if (data?.data?.qr_code) {
        toast.success('QR Code gerado! Escaneie para conectar.');
        setQrCode(data.data.qr_code);
      } else {
        toast.info('Gerando QR Code...');
        // Polling agressivo para capturar QR rapidamente
        let attempts = 0;
        const fastPoll = setInterval(async () => {
          attempts++;
          if (!mountedRef.current || attempts > QR_FAST_POLL_ATTEMPTS) {
            clearInterval(fastPoll);
            return;
          }
          
          try {
            const instanceData = await crmService.getInstance();
            if (instanceData?.qr_code) {
              console.log(`✅ QR capturado na tentativa ${attempts}!`);
              setQrCode(instanceData.qr_code);
              setInstance(instanceData);
              clearInterval(fastPoll);
            } else if (instanceData?.status === 'connected') {
              toast.success('WhatsApp conectado!');
              setInstance(instanceData);
              setQrCode(null);
              setIsConnecting(false);
              isConnectingRef.current = false;
              clearInterval(fastPoll);
            }
          } catch (e) {
            console.error('Erro no polling rápido:', e);
          }
        }, QR_FAST_POLL_DELAY);
      }
    } catch (error: any) {
      toast.dismiss(loadingToast);
      toast.error(error.message || 'Erro ao reparar');
      setIsConnecting(false);
      isConnectingRef.current = false;
    }
  }, [loadInstance]);

  const refreshQRCode = useCallback(async () => {
    await refreshFromDatabase();
  }, [refreshFromDatabase]);

  const disconnectInstance = useCallback(async () => {
    if (!instance) return;

    if (!confirm('Tem certeza que deseja desconectar o WhatsApp?')) {
      return;
    }

    try {
      setIsLoading(true);
      stopPolling();
      stopHealthCheck();
      stopActiveCheck();
      clearConnectTimeout();

      const { error } = await supabase.functions.invoke('crm-disconnect-instance', {
        body: { instanceId: instance.id }
      });

      if (error) throw error;

      setInstance({ ...instance, status: 'disconnected' });
      setQrCode(null);
      setIsConnecting(false);
      isConnectingRef.current = false;
      setConnectionVerified(false);
      toast.success('WhatsApp desconectado!');
    } catch (error: any) {
      console.error('Erro ao desconectar:', error);
      toast.error('Erro ao desconectar');
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
    evolutionState,
    createInstance,
    connectInstance,
    disconnectInstance,
    refreshInstance,
    refreshQRCode,
    checkConnectionHealth,
    repairConnection,
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
