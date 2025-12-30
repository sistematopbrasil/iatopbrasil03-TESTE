-- Enable realtime for whatsapp_instances table
-- This allows the frontend to receive instant updates when qr_code or status changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_instances;