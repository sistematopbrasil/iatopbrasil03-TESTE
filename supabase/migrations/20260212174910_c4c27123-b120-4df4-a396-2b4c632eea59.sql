
-- Add column to track AI-sent message IDs for robust detection
ALTER TABLE public.ai_conversation_state 
ADD COLUMN IF NOT EXISTS last_ai_message_ids jsonb DEFAULT '[]'::jsonb;
