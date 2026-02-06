import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentConsultant } from '@/lib/consultant-context';
import { toast } from 'sonner';

export interface AIAgentConfig {
  id: string;
  user_id: string;
  organization_id: string;
  agent_name: string;
  description: string | null;
  persona: string | null;
  skills: string | null;
  products_info: string | null;
  restrictions: string | null;
  objective: string | null;
  api_provider: string;
  api_key_encrypted: string | null;
  model: string;
  temperature: number;
  max_tokens: number;
  auto_reply: boolean;
  pause_on_human_minutes: number;
  greeting_message: string | null;
  farewell_message: string | null;
  working_hours_only: boolean;
  working_hours_start: string;
  working_hours_end: string;
  auto_pipeline: boolean;
  transcribe_audio: boolean;
  analyze_images: boolean;
}

export type AIConfigFormData = Omit<AIAgentConfig, 'id' | 'user_id' | 'organization_id'>;

const DEFAULT_CONFIG: AIConfigFormData = {
  agent_name: 'Assistente',
  description: null,
  persona: null,
  skills: null,
  products_info: null,
  restrictions: null,
  objective: null,
  api_provider: 'lovable',
  api_key_encrypted: null,
  model: 'google/gemini-3-flash-preview',
  temperature: 0.7,
  max_tokens: 500,
  auto_reply: true,
  pause_on_human_minutes: 120,
  greeting_message: null,
  farewell_message: null,
  working_hours_only: false,
  working_hours_start: '08:00',
  working_hours_end: '18:00',
  auto_pipeline: false,
  transcribe_audio: true,
  analyze_images: true,
};

export function useAIConfig() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['ai-agent-config'],
    queryFn: async () => {
      const consultant = await getCurrentConsultant();
      if (!consultant) return null;

      const { data, error } = await supabase
        .from('ai_agent_configs')
        .select('*')
        .eq('user_id', consultant.id)
        .maybeSingle();

      if (error) throw error;
      return data as AIAgentConfig | null;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (formData: AIConfigFormData) => {
      const consultant = await getCurrentConsultant();
      if (!consultant) throw new Error('Usuário não autenticado');

      const payload = {
        ...formData,
        user_id: consultant.id,
        organization_id: consultant.organization_id,
      };

      // Upsert: insert or update
      const { error } = await supabase
        .from('ai_agent_configs')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-config'] });
      toast.success('Configuração da IA salva!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar: ' + error.message);
    },
  });

  return {
    config,
    isLoading,
    defaultConfig: DEFAULT_CONFIG,
    save: saveMutation.mutate,
    isSaving: saveMutation.isPending,
  };
}
