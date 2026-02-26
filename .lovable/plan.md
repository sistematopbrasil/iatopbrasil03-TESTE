

## Plan: Fix Instagram Data, Fix CRM Messages, Add Capture Leads Tab

### 1. Fix Instagram Historical Metrics (9 profiles)

**Problem**: The previously inserted data has incorrect values.

**Approach**: 
- Delete ALL existing records from `insta_follower_metrics` for all 9 profiles
- Re-insert correct data for each profile using the data provided by the user
- 9 separate SQL operations (one DELETE-all, then 9 INSERTs with correct data)

Profile IDs mapping:
- `2ad3d597` = brenonogueiraferraz (44 rows)
- `0c4c7120` = davidfernandesaz (40 rows)  
- `b892102c` = dioleno.topbrasil (43 rows)
- `dbf19347` = rodrigo.topbrasil (43 rows)
- `19b67c78` = cris.topbrasil (43 rows)
- `65ede526` = loysegurgel (43 rows)
- `6906b0b9` = danilo.embaixador (43 rows)
- `70ce42b9` = gabrielquinteiroo (43 rows)
- `5bdbd1a2` = o_rei_da_protecao (6 rows)

Total: ~348 records to insert.

### 2. Fix CRM Messages Not Appearing

**Problem**: The `crm-sync-recent` function calls Evolution API's `/chat/findChats` which returns 0 chats. The webhook receives `messages_update` events but not `messages_upsert` for new messages. Result: `crm_messages` table has 0 rows despite WhatsApp being connected.

**Root Cause Analysis**:
- The Evolution API `/chat/findChats` endpoint uses POST with empty body `{}` which may not work with all Evolution API versions
- The webhook event normalization converts dots to underscores (`messages.upsert` -> `messages_upsert`), which should work, but the webhook only received `messages_update` (status updates), not actual new messages

**Fix approach**:
1. In `crm-sync-recent/index.ts`: Try GET method for `/chat/findChats` as a fallback, and also try the alternative endpoint `/chat/findContacts`
2. In `crm-webhook/index.ts`: Add handling for `messages_set` event (Evolution API v2 sends bulk messages under this event) and add more event normalization patterns
3. Add a manual "force sync" that fetches messages directly from known conversations

### 3. Add Capture Page Leads Tab in CRM

**Problem**: The CRM Leads section only has "Leads do Quiz" and "Leads do WhatsApp" sub-tabs. Capture page leads (`lead_source = 'capture'`) exist in the database but aren't shown.

**Approach**:
- Create a new `CaptureLeadsList` component (similar to `QuizLeadsList` but filtered by `lead_source = 'capture'`)
- Add a third sub-tab "Leads da Captura" in `AdminCRM.tsx` with a distinct icon/color (e.g., `FileText` icon, blue theme)
- The component will show: name, phone, email, location, temperature, and a "Conversar" button

### Implementation Steps

1. **Delete all existing Instagram metrics** (single SQL DELETE)
2. **Insert correct data for all 9 profiles** (9 SQL INSERT operations, executed sequentially with user approval)
3. **Fix `crm-sync-recent` edge function** to handle different Evolution API response formats for chat listing
4. **Fix `crm-webhook` edge function** to handle additional event types
5. **Create `CaptureLeadsList` component** based on existing `QuizLeadsList`
6. **Update `AdminCRM.tsx`** to add the third "Leads da Captura" sub-tab

