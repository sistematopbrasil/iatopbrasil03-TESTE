import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentConsultant, isSuperAdmin } from '@/lib/consultant-context';
import { FunnelType, isFunnelType } from '@/lib/funnel-types';

const STORAGE_KEY = 'top-brasil:active-funnel';

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

function readStoredFunnel(): ActiveFunnel | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'all' || v === 'consultor' || v === 'associado') return v;
  } catch {}
  return null;
}

function writeStoredFunnel(value: ActiveFunnel) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {}
}

export function FunnelProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);
  const [availableFunnels, setAvailableFunnels] = useState<FunnelType[]>(['consultor']);
  const [defaultFunnel, setDefaultFunnel] = useState<FunnelType>('consultor');
  const [canSeeAll, setCanSeeAll] = useState(false);
  const [activeFunnel, setActiveFunnelState] = useState<ActiveFunnel>('consultor');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const user = await getCurrentConsultant();
        if (!user) {
          if (mounted) setIsLoading(false);
          return;
        }
        const superAdmin = isSuperAdmin(user.role);

        // Carrega allowed/default/last via RPC
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

        // Ordem de prioridade: localStorage > last_active_funnel > default_funnel
        const stored = readStoredFunnel();
        let initial: ActiveFunnel = defF;
        if (stored) {
          if (stored === 'all' && superAdmin) initial = 'all';
          else if (stored !== 'all' && allowed.includes(stored)) initial = stored;
          else initial = defF;
        } else if (lastF && allowed.includes(lastF)) {
          initial = lastF;
        }

        if (!mounted) return;
        setAvailableFunnels(allowed);
        setDefaultFunnel(defF);
        setCanSeeAll(superAdmin);
        setActiveFunnelState(initial);
      } catch (e) {
        console.warn('[FunnelContext] Falha ao inicializar:', e);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const setActiveFunnel = useCallback(
    (funnel: ActiveFunnel) => {
      // Validar
      if (funnel === 'all' && !canSeeAll) return;
      if (funnel !== 'all' && !availableFunnels.includes(funnel)) return;

      setActiveFunnelState(funnel);
      writeStoredFunnel(funnel);

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
