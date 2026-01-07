-- Step 1: Add instance_id column to crm_messages
ALTER TABLE public.crm_messages ADD COLUMN IF NOT EXISTS instance_id uuid;

-- Step 2: Backfill instance_id from crm_conversations
UPDATE public.crm_messages m 
SET instance_id = (
  SELECT c.instance_id 
  FROM public.crm_conversations c 
  WHERE c.id = m.conversation_id
)
WHERE m.instance_id IS NULL;

-- Step 3: Drop the global UNIQUE constraint on message_id (this causes message loss)
ALTER TABLE public.crm_messages DROP CONSTRAINT IF EXISTS crm_messages_message_id_key;

-- Step 4: Create a new composite UNIQUE index on (instance_id, message_id)
-- This ensures message_id uniqueness is scoped per WhatsApp instance
CREATE UNIQUE INDEX IF NOT EXISTS crm_messages_instance_message_id_key 
ON public.crm_messages(instance_id, message_id);

-- Step 5: Add index for better query performance
CREATE INDEX IF NOT EXISTS crm_messages_conversation_timestamp_idx 
ON public.crm_messages(conversation_id, timestamp DESC);