import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentConsultant } from '@/lib/consultant-context';
import { toast } from 'sonner';

export interface AIConversationState {
  id: string;
  conversation_id: string;
  user_id: string;
  is_active: boolean;
  paused_until: string | null;
  paused_by: string;
  permanently_disabled: boolean;
  last_ai_message_at: string | null;
  messages_sent: number;
  total_tokens_used: number;
}

export function useAIConversationState(conversationId: string | null) {
  const queryClient = useQueryClient();

  const { data: state, isLoading } = useQuery({
    queryKey: ['ai-conversation-state', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const { data } = await supabase
        .from('ai_conversation_state')
        .select('*')
        .eq('conversation_id', conversationId)
        .maybeSingle();
      return data as AIConversationState | null;
    },
    enabled: !!conversationId,
    refetchInterval: 10000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['ai-conversation-state', conversationId] });
  };

  const pauseMutation = useMutation({
    mutationFn: async (minutes: number) => {
      if (!conversationId) throw new Error('No conversation');
      const consultant = await getCurrentConsultant();
      if (!consultant) throw new Error('Not authenticated');

      const pausedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();

      if (state) {
        await supabase
          .from('ai_conversation_state')
          .update({ paused_until: pausedUntil, paused_by: 'manual', is_active: true, permanently_disabled: false })
          .eq('conversation_id', conversationId);
      } else {
        await supabase
          .from('ai_conversation_state')
          .insert({ conversation_id: conversationId, user_id: consultant.id, paused_until: pausedUntil, paused_by: 'manual' });
      }
    },
    onSuccess: () => { invalidate(); toast.success('IA pausada temporariamente'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      if (!conversationId) throw new Error('No conversation');
      const consultant = await getCurrentConsultant();
      if (!consultant) throw new Error('Not authenticated');

      if (state) {
        await supabase
          .from('ai_conversation_state')
          .update({ paused_until: null, is_active: true, permanently_disabled: false, paused_by: 'manual' })
          .eq('conversation_id', conversationId);
      } else {
        await supabase
          .from('ai_conversation_state')
          .insert({ conversation_id: conversationId, user_id: consultant.id, is_active: true });
      }
    },
    onSuccess: () => { invalidate(); toast.success('IA reativada'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      if (!conversationId) throw new Error('No conversation');
      const consultant = await getCurrentConsultant();
      if (!consultant) throw new Error('Not authenticated');

      if (state) {
        await supabase
          .from('ai_conversation_state')
          .update({ permanently_disabled: true, is_active: false, paused_by: 'manual' })
          .eq('conversation_id', conversationId);
      } else {
        await supabase
          .from('ai_conversation_state')
          .insert({ conversation_id: conversationId, user_id: consultant.id, permanently_disabled: true, is_active: false });
      }
    },
    onSuccess: () => { invalidate(); toast.success('IA desativada nesta conversa'); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Compute status
  let status: 'active' | 'paused' | 'disabled' | 'none' = 'none';
  if (state) {
    if (state.permanently_disabled || !state.is_active) {
      status = 'disabled';
    } else if (state.paused_until && new Date(state.paused_until) > new Date()) {
      status = 'paused';
    } else {
      status = 'active';
    }
  }

  return {
    state,
    status,
    isLoading,
    pause: (minutes: number) => pauseMutation.mutate(minutes),
    resume: () => resumeMutation.mutate(),
    disable: () => disableMutation.mutate(),
    isPending: pauseMutation.isPending || resumeMutation.isPending || disableMutation.isPending,
  };
}
