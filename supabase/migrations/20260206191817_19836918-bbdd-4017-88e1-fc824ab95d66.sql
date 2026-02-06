-- Enable realtime for CRM tables
ALTER PUBLICATION supabase_realtime ADD TABLE crm_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE crm_conversations;