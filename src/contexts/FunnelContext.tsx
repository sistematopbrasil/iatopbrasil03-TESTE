import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentConsultant, isSuperAdmin } from '@/lib/consultant-context';
import { FunnelType, isFunnelType } from '@/lib/funnel-types';

const STORAGE_KEY = 'top-brasil:active-funnel';
const STORAGE_OWNER_KEY = 'top-brasil:active-funnel-owner';

export type ActiveFunnel = FunnelType | 'all';

interface FunnelContextValue {
  activeFunnel: ActiveFunnel;
  availableFunnels: FunnelType[];
  defaultFunnel: FunnelType;
  canSeeAll: boolean; // super admin
  isLoading: boolean;
  setActiveFunnel: (funnel: ActiveFunnel) => void;
  /**
   * Quando activeFunnel === 'all', retorna o defaultFunnel.
   * Útil para páginas que não suportam visão "todos" (ex: pipeline).
   */
  resolvedFunnel: FunnelType;
}

const FunnelContext = createContext<FunnelContextValue | null>(null);

function readStored(): { value: ActiveFunnel | null; owner: string | null } {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    const owner = localStorage.getItem(STORAGE_OWNER_KEY);
    if (value === 'all' || value === 'consultor' || value === 'associado') {
      return { value, owner };
    }
  } catch {}
  return { value: null, owner: null };
}

function writeStored(value: ActiveFunnel, owner: string) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
    localStorage.setItem(STORAGE_OWNER_KEY, owner);
  } catch {}
}

function clearStored() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_OWNER_KEY);
  } catch {}
}

export function FunnelProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);
  const [availableFunnels, setAvailableFunnels] = useState<FunnelType[]>(['consultor']);
  const [defaultFunnel, setDefaultFunnel] = useState<FunnelType>('consultor');
  const [canSeeAll, setCanSeeAll] = useState(false);
  const [activeFunnel, setActiveFunnelState] = useState<ActiveFunnel>('consultor');
  const currentUserIdRef = useRef<string | null>(null);

  // Re-inicializa o contexto quando o usuário autenticado muda
  const initialize = useCallback(async (signal?: { cancelled: boolean }) => {
    setIsLoading(true);
    try {
      const user = await getCurrentConsultant();
      if (signal?.cancelled) return;

      if (!user) {
        currentUserIdRef.current = null;
        setAvailableFunnels(['consultor']);
        setDefaultFunnel('consultor');
        setCanSeeAll(false);
        setActiveFunnelState('consultor');
        clearStored();
        return;
      }

      currentUserIdRef.current = user.id;
      const superAdmin = isSuperAdmin(user.role);

      const { data, error } = await supabase.rpc('get_my_funnel_access');
      let allowed: FunnelType[] = ['consultor'];
      let defF: FunnelType = 'consultor';
      let lastF: FunnelType | null = null;

      if (!error && Array.isArray(data) && data.length > 0) {
        const row: any = data[0];
        if (Array.isArray(row.allowed) && row.allowed.length > 0) {
          allowed = row.allowed.filter(isFunnelType) as FunnelType[];
        }
        if (isFunnelType(row.default_f)) defF = row.default_f as FunnelType;
        if (isFunnelType(row.last_active)) lastF = row.last_active as FunnelType;
      }

      if (allowed.length === 0) allowed = ['consultor'];
      if (!allowed.includes(defF)) defF = allowed[0];

      // Determinar o funil inicial respeitando as restrições do usuário
      // Prioridade: localStorage do MESMO usuário > last_active_funnel > default_funnel
      const stored = readStored();
      let initial: ActiveFunnel = defF;

      const storedBelongsToUser = stored.value && stored.owner === user.id;

      if (storedBelongsToUser) {
        if (stored.value === 'all' && superAdmin && allowed.length > 1) {
          initial = 'all';
        } else if (stored.value !== 'all' && allowed.includes(stored.value as FunnelType)) {
          initial = stored.value as FunnelType;
        } else {
          initial = defF;
        }
      } else if (lastF && allowed.includes(lastF)) {
        initial = lastF;
      }

      // ✅ Se só tem 1 funil disponível, força esse funil (sem 'all')
      if (allowed.length === 1) {
        initial = allowed[0];
      }

      // ✅ Se 'all' foi escolhido mas não é super admin OU não tem mais de 1 funil, fallback
      if (initial === 'all' && (!superAdmin || allowed.length <= 1)) {
        initial = defF;
      }

      if (signal?.cancelled) return;

      setAvailableFunnels(allowed);
      setDefaultFunnel(defF);
      setCanSeeAll(superAdmin);
      setActiveFunnelState(initial);
      writeStored(initial, user.id);
    } catch (e) {
      console.warn('[FunnelContext] Falha ao inicializar:', e);
    } finally {
      if (!signal?.cancelled) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    initialize(signal);

    // Reage a login/logout/troca de sessão
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUserId = session?.user?.id ?? null;
      if (newUserId !== currentUserIdRef.current) {
        // Usuário mudou — limpa storage anterior e recarrega
        if (newUserId === null) {
          clearStored();
        }
        initialize();
      }
    });

    return () => {
      signal.cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [initialize]);

  const setActiveFunnel = useCallback(
    (funnel: ActiveFunnel) => {
      // Validar
      if (funnel === 'all' && (!canSeeAll || availableFunnels.length <= 1)) return;
      if (funnel !== 'all' && !availableFunnels.includes(funnel)) return;

      setActiveFunnelState(funnel);
      const ownerId = currentUserIdRef.current;
      if (ownerId) writeStored(funnel, ownerId);

      // Persiste no banco em background (apenas funnel concreto)
      if (funnel !== 'all') {
        (async () => {
          try {
            const user = await getCurrentConsultant();
            if (!user) return;
            await supabase
              .from('users')
              .update({ last_active_funnel: funnel } as any)
              .eq('id', user.id);
          } catch (e) {
            console.warn('[FunnelContext] Falha ao persistir last_active_funnel:', e);
          }
        })();
      }

      // Invalida queries dependentes de funil
      queryClient.invalidateQueries({ queryKey: ['pipeline-stages'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['leads'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['unified-ranking'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['ai-agent-config'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['conversations'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instance'], exact: false });
    },
    [availableFunnels, canSeeAll, queryClient]
  );

  const resolvedFunnel: FunnelType = useMemo(() => {
    if (activeFunnel === 'all') return defaultFunnel;
    return activeFunnel;
  }, [activeFunnel, defaultFunnel]);

  const value: FunnelContextValue = useMemo(
    () => ({
      activeFunnel,
      availableFunnels,
      defaultFunnel,
      canSeeAll,
      isLoading,
      setActiveFunnel,
      resolvedFunnel,
    }),
    [activeFunnel, availableFunnels, defaultFunnel, canSeeAll, isLoading, setActiveFunnel, resolvedFunnel]
  );

  return <FunnelContext.Provider value={value}>{children}</FunnelContext.Provider>;
}

export function useFunnel(): FunnelContextValue {
  const ctx = useContext(FunnelContext);
  if (!ctx) {
    // Fallback seguro caso esteja fora do provider (não deve ocorrer em rotas autenticadas)
    return {
      activeFunnel: 'consultor',
      availableFunnels: ['consultor'],
      defaultFunnel: 'consultor',
      canSeeAll: false,
      isLoading: false,
      setActiveFunnel: () => {},
      resolvedFunnel: 'consultor',
    };
  }
  return ctx;
}
