

## Plan: Fix CRM Messages, Realtime, and QR Code Connection

### Problem Analysis

1. **Instagram data**: All 357 records are present in the database across 9 profiles. The data is there and should display correctly once logged in. No code changes needed for this.

2. **CRM messages not appearing**: The `crm_messages` and `crm_conversations` tables are NOT in the Supabase realtime publication. Only `capture_page_configs` is. This means all the realtime subscriptions in the code are silently failing - no messages are pushed to the UI in real-time.

3. **Zero messages in database**: The sync found 20 chats via `findContacts` but stored 0 messages. The `findMessages` endpoint likely isn't returning data in the expected format for the Evolution API version being used. The webhook may also be failing silently.

4. **QR Code phone stays loading**: When connection succeeds, the browser updates via realtime/polling, but there's no mechanism to tell the phone's WhatsApp that the pairing completed - this is controlled by the Evolution API/WhatsApp protocol itself and cannot be fixed from the app side. However, we can add a clearer UX message telling users to close WhatsApp on the phone after scanning.

---

### Implementation Steps

#### Step 1: Enable Realtime for CRM tables
Database migration to add `crm_messages` and `crm_conversations` to the `supabase_realtime` publication:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_conversations;
```
This is the single most critical fix - without this, no realtime message updates work at all.

#### Step 2: Fix message sync - try additional Evolution API endpoints
Update `crm-sync-recent/index.ts` to try multiple message-fetching endpoints:
- `POST /chat/findMessages/{instance}` (current)
- `GET /chat/findMessages/{instance}/{remoteJid}` (alternative)
- `POST /message/findMessages/{instance}` (Evolution API v2 alternate path)

Also add detailed error logging for each failed attempt to understand which endpoints the API version supports.

#### Step 3: Fix webhook message processing robustness
Update `crm-webhook/index.ts` to:
- Add more fallback patterns for extracting messages from different payload shapes
- Log the raw payload structure when message parsing fails
- Handle cases where `messageTimestamp` might be a string or BigInt

#### Step 4: Improve useMessages hook reliability
Update `src/hooks/useMessages.ts`:
- After sending a message, immediately refetch messages (don't rely solely on realtime)
- Reduce polling interval from 5s to 3s as fallback
- Add a forced refetch when the conversation becomes visible/focused

#### Step 5: Improve useConversations hook
Update `src/hooks/useConversations.ts`:
- Refetch conversations immediately after sync completes
- Add window focus listener to refetch on tab return

#### Step 6: QR Code UX improvement
Update `src/components/crm/ConnectionPanel.tsx`:
- Add instruction text: "Após escanear, feche o WhatsApp no celular. A conexão será confirmada automaticamente aqui."
- This addresses the user's concern about people waiting on the loading screen on the phone

### Technical Details

The core issue is that Supabase Realtime requires tables to be explicitly added to the `supabase_realtime` publication. Without this, all `postgres_changes` subscriptions receive nothing. The current code has proper subscription logic but it was never receiving events.

The secondary issue is the Evolution API message sync - the `findMessages` endpoint format varies between API versions, and the current implementation may not be hitting the right endpoint for the installed version.

