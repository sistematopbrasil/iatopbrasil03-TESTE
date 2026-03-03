import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { crmService, WhatsAppInstance } from '@/lib/crm-service';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface WhatsAppConnectionContextType {
  instance: WhatsAppInstance | null;
  qrCode: string | null;
  qrSecondsLeft: number | null;
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

const CONNECTION_TIMEOUT_MS = 90000;
const HEALTH_CHECK_INTERVAL_MS = 15000;
const ACTIVE_CHECK_INTERVAL_MS = 500;
const MAX_FAILED_CHECKS = 2;
const QR_FAST_POLL_ATTEMPTS = 40;
const QR_FAST_POLL_DELAY = 150;
const QR_EXPIRATION_SECONDS = 45;

export function WhatsAppConnectionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionVerified, setConnectionVerified] = useState(false);
  const [evolutionState, setEvolutionState] = useState<string | null>(null);
  const [qrTimestamp, setQrTimestamp] = useState<number | null>(null);
  const [qrSecondsLeft, setQrSecondsLeft] = useState<number | null>(null);
  
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const healthCheckRef = useRef<NodeJS.Timeout | null>(null);
  const activeCheckRef = useRef<NodeJS.Timeout | null>(null);
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const failedChecksRef = useRef(0);
  const lastToastRef = useRef<number>(0);
  const connectionToastShownRef = useRef(false);
  
  // Locks separados para create e connect
  const isCreatingRef = useRef(false);
  const isConnectingRef = useRef(false);

  // Helper: set QR code with timestamp tracking
  const updateQrCode = useCallback((qr: string | null) => {
    setQrCode(qr);
    if (qr) {
      setQrTimestamp(Date.now());
    } else {
      setQrTimestamp(null);
      setQrSecondsLeft(null);
    }
  }, []);

  // Função centralizada para mostrar toast de conexão (apenas uma vez por ciclo)
  const showConnectedToast = useCallback(() => {
    if (!connectionToastShownRef.current) {
      connectionToastShownRef.current = true;
      toast.success('WhatsApp conectado com sucesso!');
    }
  }, []);

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

  // Realtime subscription
  useEffect(() => {
    if (!instance?.id) return;

    console.log('📡 Subscribing to realtime updates for instance:', instance.id);
    
    const channel = supabase
      .channel(`instance-updates-${instance.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_instances',
          filter: `id=eq.${instance.id}`,
        },
        (payload) => {
          console.log('📡 Realtime update received:', payload);
          const newData = payload.new as any;
          
          if (!mountedRef.current) return;
          
          // Atualizar QR code instantaneamente
          if (newData.qr_code && newData.qr_code !== qrCode) {
            console.log('✅ QR Code recebido via realtime!');
            updateQrCode(newData.qr_code);
          }
          
          if (newData.status === 'connected') {
            console.log('✅ Conectado via realtime!');
            if (isConnecting) {
              showConnectedToast();
            }
            setInstance((prev) => prev ? { ...prev, ...newData } : prev);
            setQrCode(null);
            setIsConnecting(false);
            isConnectingRef.current = false;
            isCreatingRef.current = false;
            setConnectionVerified(true);
            stopPolling();
            stopActiveCheck();
            clearConnectTimeout();
          } else if (newData.status === 'disconnected' && instance?.status === 'connected') {
            console.log('⚠️ Desconectado via realtime');
            setInstance((prev) => prev ? { ...prev, ...newData } : prev);
            setConnectionVerified(false);
            showDisconnectToast();
          } else {
            setInstance((prev) => prev ? { ...prev, ...newData } : prev);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
      });

    return () => {
      console.log('📡 Unsubscribing from realtime');
      supabase.removeChannel(channel);
    };
  }, [instance?.id, qrCode, isConnecting, showDisconnectToast]);

  useEffect(() => {
    const shouldPoll = qrCode !== null || isConnecting || instance?.status === 'connecting';
    if (shouldPoll) {
      startPolling();
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [qrCode, isConnecting, instance?.status]);

  useEffect(() => {
    if (instance?.status === 'connected') {
      startHealthCheck();
    } else {
      stopHealthCheck();
    }
    return () => stopHealthCheck();
  }, [instance?.status]);

  useEffect(() => {
    if (isConnecting) {
      startActiveCheck();
    } else {
      stopActiveCheck();
    }
    return () => stopActiveCheck();
  }, [isConnecting]);

  useEffect(() => {
    const handleFocus = () => {
      if (instance?.status === 'connected') {
        checkConnectionHealth();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [instance?.status]);

  // ✅ QR Code expiration timer - auto-refresh after 45s
  useEffect(() => {
    if (!qrCode || !qrTimestamp) {
      setQrSecondsLeft(null);
      return;
    }

    const updateCountdown = () => {
      const elapsed = Math.floor((Date.now() - qrTimestamp) / 1000);
      const remaining = QR_EXPIRATION_SECONDS - elapsed;
      setQrSecondsLeft(Math.max(0, remaining));
      
      if (remaining <= 0 && mountedRef.current) {
        console.log('⏰ QR Code expirado, atualizando automaticamente...');
        refreshQRCode();
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [qrCode, qrTimestamp]);

  const loadInstance = useCallback(async () => {
    if (!mountedRef.current) return;
    
    // Primeiro, tentar usar dados do cache para carregar instantaneamente
    const cachedInstance = queryClient.getQueryData<WhatsAppInstance>(['whatsapp-instance']);
    if (cachedInstance) {
      console.log('📦 Usando instância do cache:', cachedInstance.status);
      setInstance(cachedInstance);
      if (cachedInstance.status === 'connected') {
        setConnectionVerified(true);
        setIsLoading(false);
        // Verificar saúde em background, sem bloquear UI
        checkConnectionHealth();
        return;
      } else if (cachedInstance.status === 'connecting' && cachedInstance.qr_code) {
        updateQrCode(cachedInstance.qr_code);
        setIsConnecting(true);
        setIsLoading(false);
        return;
      }
      // Se não está conectado, continuamos para buscar dados atualizados
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    
    try {
      const data = await crmService.getInstance();
      if (!mountedRef.current) return;
      setInstance(data);
      
      // Atualizar cache
      if (data) {
        queryClient.setQueryData(['whatsapp-instance'], data);
      }

      if (data?.status === 'connecting') {
        setIsConnecting(true);
        if (data.qr_code) {
          updateQrCode(data.qr_code);
        }
      } else if (data?.status === 'connected') {
        // Verificar saúde sem bloquear
        checkConnectionHealth().then(isReallyConnected => {
          setConnectionVerified(isReallyConnected);
        });
      } else if (data?.status === 'disconnected' && !data.last_connected_at) {
        // ✅ Nova conta: instância existe mas nunca conectou - auto-iniciar conexão
        console.log('🆕 Instância nunca conectada, iniciando conexão automática...');
        setIsConnecting(true);
        setIsLoading(false);
        connectInstance();
        return;
      }
    } catch (error) {
      console.error('Erro ao carregar instância:', error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [queryClient]);

  const refreshFromDatabase = useCallback(async () => {
    try {
      const instanceData = await crmService.getInstance();
      if (!instanceData || !mountedRef.current) return;
      
      setInstance(instanceData);
      
      if (instanceData.status === 'connected') {
        if (isConnecting) {
          showConnectedToast();
        }
        setQrCode(null);
        setIsConnecting(false);
        isConnectingRef.current = false;
        isCreatingRef.current = false;
        setConnectionVerified(true);
        stopPolling();
        stopActiveCheck();
        clearConnectTimeout();
      } else if (instanceData.qr_code && instanceData.qr_code !== qrCode) {
        updateQrCode(instanceData.qr_code);
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
          showConnectedToast();
          setInstance((prev) => prev ? { ...prev, status: 'connected' } : prev);
          setQrCode(null);
          setIsConnecting(false);
          isConnectingRef.current = false;
          isCreatingRef.current = false;
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
            isCreatingRef.current = false;
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
    // Evitar múltiplas chamadas simultâneas de create
    if (isCreatingRef.current) {
      console.log('⏳ Já está criando instância, ignorando');
      return;
    }

    console.log('🚀 [createInstance] Iniciando...');
    isCreatingRef.current = true;
    setIsConnecting(true);
    // NÃO setar isConnectingRef aqui - deixar para connectInstance
    
    try {
      const result = await crmService.createInstance();

      if (!result.success) {
        toast.error(result.error || 'Erro ao criar instância');
        setIsConnecting(false);
        isCreatingRef.current = false;
        return;
      }

      console.log('✅ [createInstance] Instância criada:', result.data);
      setInstance(result.data!);
      setIsLoading(false);
      toast.success('Conexão iniciada! Aguarde o QR Code.');
      
      // Chamar connect IMEDIATAMENTE - isConnectingRef está false então vai funcionar
      console.log('🔗 [createInstance] Chamando connectInstance...');
      await connectInstance();
    } catch (error: any) {
      console.error('❌ [createInstance] Erro:', error);
      toast.error(error.message || 'Erro ao criar instância');
      setIsConnecting(false);
      isCreatingRef.current = false;
    }
  }, []);

  const connectInstance = useCallback(async () => {
    // Evitar múltiplas chamadas simultâneas de CONNECT
    if (isConnectingRef.current) {
      console.log('⏳ [connectInstance] Já está conectando, ignorando chamada duplicada');
      return;
    }

    console.log('🔗 [connectInstance] Iniciando...');
    isConnectingRef.current = true;
    connectionToastShownRef.current = false; // Reset para permitir novo toast
    setIsConnecting(true);
    setQrCode(null);
    setConnectionVerified(false);
    failedChecksRef.current = 0;
    clearConnectTimeout();

    // Timeout de segurança
    connectTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current && isConnectingRef.current) {
        console.log('⏰ Timeout de conexão - mostrando opções de retry');
      }
    }, CONNECTION_TIMEOUT_MS);

    try {
      const { data, error } = await supabase.functions.invoke('crm-repair-connection', {
        body: { mode: 'soft' }
      });

      if (error) {
        console.error('❌ [connectInstance] Erro:', error);
        toast.error('Erro ao conectar. Tentando novamente...');
        
        // Auto-retry uma vez
        await new Promise(r => setTimeout(r, 1000));
        const retryResult = await supabase.functions.invoke('crm-repair-connection', {
          body: { mode: 'soft' }
        });
        
        if (retryResult.error) {
          toast.error('Erro persistente. Tente "Resetar sessão".');
          setIsConnecting(false);
          isConnectingRef.current = false;
          isCreatingRef.current = false;
          clearConnectTimeout();
          return;
        }
        
        // Usar resultado do retry
        if (retryResult.data?.data?.qr_code) {
          console.log('✅ [connectInstance] QR obtido no retry!');
          updateQrCode(retryResult.data.data.qr_code);
          setInstance((prev) => prev ? { ...prev, status: 'connecting' } : prev);
          return;
        }
      }

      console.log('🔗 [connectInstance] Repair result:', data);

      if (data?.data?.status === 'connected') {
        showConnectedToast();
        await loadInstance();
        setQrCode(null);
        setIsConnecting(false);
        isConnectingRef.current = false;
        isCreatingRef.current = false;
        setConnectionVerified(true);
        clearConnectTimeout();
      } else if (data?.data?.qr_code) {
        console.log('✅ [connectInstance] QR Code recebido!');
        updateQrCode(data.data.qr_code);
        setInstance((prev) => prev ? { ...prev, status: 'connecting' } : prev);
      } else {
        // QR ainda não disponível - polling rápido
        console.log('⏳ [connectInstance] Aguardando QR via polling...');
        setInstance((prev) => prev ? { ...prev, status: 'connecting' } : prev);
        
        let attempts = 0;
        const fastPoll = setInterval(async () => {
          attempts++;
          if (!mountedRef.current || attempts > QR_FAST_POLL_ATTEMPTS) {
            clearInterval(fastPoll);
            if (attempts > QR_FAST_POLL_ATTEMPTS && !qrCode) {
              console.log('⚠️ Timeout no polling de QR');
            }
            return;
          }
          
          try {
            const instanceData = await crmService.getInstance();
            if (instanceData?.qr_code) {
              console.log(`✅ QR capturado na tentativa ${attempts}!`);
              updateQrCode(instanceData.qr_code);
              setInstance(instanceData);
              clearInterval(fastPoll);
            } else if (instanceData?.status === 'connected') {
              console.log('✅ Conectado durante polling!');
              showConnectedToast();
              setInstance(instanceData);
              setQrCode(null);
              setIsConnecting(false);
              isConnectingRef.current = false;
              isCreatingRef.current = false;
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
      console.error('❌ [connectInstance] Erro:', error);
      toast.error(error.message || 'Erro ao conectar');
      setIsConnecting(false);
      isConnectingRef.current = false;
      isCreatingRef.current = false;
      clearConnectTimeout();
    }
  }, [loadInstance]);

  const repairConnection = useCallback(async (mode: 'soft' | 'hard') => {
    if (isConnectingRef.current) {
      console.log('⏳ Já está processando, ignorando');
      return;
    }

    isConnectingRef.current = true;
    connectionToastShownRef.current = false; // Reset para permitir novo toast
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
        showConnectedToast();
        setIsConnecting(false);
        isConnectingRef.current = false;
        isCreatingRef.current = false;
        await loadInstance();
      } else if (data?.data?.qr_code) {
        toast.success('QR Code gerado! Escaneie para conectar.');
        updateQrCode(data.data.qr_code);
      } else {
        toast.info('Gerando QR Code...');
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
              updateQrCode(instanceData.qr_code);
              setInstance(instanceData);
              clearInterval(fastPoll);
            } else if (instanceData?.status === 'connected') {
              showConnectedToast();
              setInstance(instanceData);
              setQrCode(null);
              setIsConnecting(false);
              isConnectingRef.current = false;
              isCreatingRef.current = false;
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
    // Forçar geração de novo QR via repair soft
    try {
      setIsConnecting(true);
      toast.loading('Gerando novo QR Code...', { id: 'refresh-qr' });
      
      const { data, error } = await supabase.functions.invoke('crm-repair-connection', {
        body: { mode: 'soft' }
      });
      
      toast.dismiss('refresh-qr');
      
      if (error) {
        toast.error('Erro ao atualizar QR Code');
        setIsConnecting(false);
        return;
      }
      
      if (data?.data?.qr_code) {
        updateQrCode(data.data.qr_code);
        toast.success('QR Code atualizado!');
      } else if (data?.data?.status === 'connected') {
        toast.success('WhatsApp já está conectado!');
        await loadInstance();
        setIsConnecting(false);
      } else {
        // Fallback para polling
        await refreshFromDatabase();
      }
    } catch (error) {
      toast.dismiss('refresh-qr');
      console.error('Erro ao atualizar QR:', error);
      toast.error('Erro ao atualizar QR Code');
      setIsConnecting(false);
    }
  }, [refreshFromDatabase, loadInstance]);

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
      isCreatingRef.current = false;
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
    qrSecondsLeft,
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
