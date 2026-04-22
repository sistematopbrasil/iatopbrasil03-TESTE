import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type IntegrationCategory = 'whatsapp' | 'meta_ads' | 'instagram';

export interface IntegrationMetadata {
  id: string;
  category: IntegrationCategory;
  key: string;
  is_secret: boolean;
  description: string | null;
  has_value: boolean;
  updated_by: string | null;
  updated_by_name: string | null;
  updated_at: string | null;
}

/**
 * Definição estática das chaves esperadas pelo painel.
 * Garante que linhas inexistentes apareçam mesmo antes de salvar.
 */
export const INTEGRATION_KEYS: Array<{
  key: string;
  category: IntegrationCategory;
  label: string;
  description: string;
  is_secret: boolean;
  placeholder?: string;
}> = [
  // WhatsApp / Evolution
  {
    key: 'EVOLUTION_API_URL',
    category: 'whatsapp',
    label: 'Evolution API URL',
    description: 'URL base da Evolution API (ex.: https://evo.suaempresa.com).',
    is_secret: false,
    placeholder: 'https://evo.exemplo.com',
  },
  {
    key: 'EVOLUTION_API_KEY',
    category: 'whatsapp',
    label: 'Evolution API Key',
    description: 'Token global da Evolution API (apikey).',
    is_secret: true,
  },
  {
    key: 'EVOLUTION_WEBHOOK_SECRET',
    category: 'whatsapp',
    label: 'Webhook Secret',
    description:
      'Secret enviado no header x-webhook-secret. Quando preenchido, o webhook rejeita chamadas sem ele.',
    is_secret: true,
  },
  // Meta Ads
  {
    key: 'META_ACCESS_TOKEN',
    category: 'meta_ads',
    label: 'Meta Access Token',
    description: 'Access token de longa duração da Meta Graph API.',
    is_secret: true,
  },
  {
    key: 'META_APP_ID',
    category: 'meta_ads',
    label: 'Meta App ID',
    description: 'ID público do app Meta.',
    is_secret: false,
  },
  {
    key: 'META_APP_SECRET',
    category: 'meta_ads',
    label: 'Meta App Secret',
    description: 'Secret do app Meta.',
    is_secret: true,
  },
  {
    key: 'META_GRAPH_VERSION',
    category: 'meta_ads',
    label: 'Meta Graph API Version',
    description: 'Versão da Graph API (ex.: v21.0). Padrão atual: v21.0.',
    is_secret: false,
    placeholder: 'v21.0',
  },
  // Instagram / Apify
  {
    key: 'APIFY_API_KEY',
    category: 'instagram',
    label: 'Apify API Key',
    description: 'Token Apify usado para scrape de perfis Instagram.',
    is_secret: true,
  },
  {
    key: 'APIFY_ACTOR_ID',
    category: 'instagram',
    label: 'Apify Actor ID',
    description:
      'Actor responsável pelo scrape (padrão: apify~instagram-profile-scraper).',
    is_secret: false,
    placeholder: 'apify~instagram-profile-scraper',
  },
];

export function useIntegrationSettings() {
  return useQuery({
    queryKey: ['integration-settings-metadata'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'list_integration_settings_metadata' as any,
      );
      if (error) throw error;
      return (data as IntegrationMetadata[]) ?? [];
    },
    staleTime: 30_000,
  });
}

export function useSaveIntegrationValue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      key: string;
      value: string;
      category: IntegrationCategory;
      is_secret: boolean;
      description?: string;
    }) => {
      const { error } = await supabase.rpc('set_integration_value' as any, {
        p_key: params.key,
        p_value: params.value,
        p_category: params.category,
        p_is_secret: params.is_secret,
        p_description: params.description ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integration-settings-metadata'] });
      toast.success('Integração salva com sucesso');
    },
    onError: (e: any) => toast.error(`Erro ao salvar: ${e.message}`),
  });
}

export function useClearIntegrationValue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const { error } = await supabase.rpc('clear_integration_value' as any, {
        p_key: key,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integration-settings-metadata'] });
      toast.success('Valor removido — voltando a usar variável de ambiente');
    },
    onError: (e: any) => toast.error(`Erro ao limpar: ${e.message}`),
  });
}

export async function revealIntegrationValue(key: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('reveal_integration_value' as any, {
    p_key: key,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function testIntegration(category: IntegrationCategory): Promise<{
  ok: boolean;
  latency_ms: number;
  message: string;
}> {
  const { data, error } = await supabase.functions.invoke('integrations-test', {
    body: { category },
  });
  if (error) throw error;
  return data as any;
}
