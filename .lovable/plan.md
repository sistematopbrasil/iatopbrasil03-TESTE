

## Plan: Fix CRM Messages + Instagram Visual Overhaul

### Problem Root Causes

**CRM - Why messages aren't appearing:**

1. **`config.toml` missing `verify_jwt = false` for `crm-webhook`**: The webhook function requires JWT by default. Evolution API sends plain POST requests without auth tokens. This likely causes intermittent 401 rejections. Must add `[functions.crm-webhook]\nverify_jwt = false`.

2. **Sync blocks conversation creation on message check**: The sync function calls `findMessages` to check if a chat has messages BEFORE creating a conversation (line 265). The API returns data in an unrecognized format, so it reports "0 messages" and skips creating the conversation entirely. Result: 0 conversations, 0 messages synced despite finding 317 chats and 20 valid phone numbers.

3. **`findMessages` format mismatch**: The Evolution API likely returns messages in a nested structure (e.g., `{messages: {records: [...]}}` or paginated format) that none of the three format checks catch (`Array.isArray`, `.messages[]`, `Object.values`).

**Instagram - Why it looks "empty/monotone":**

4. The data IS in the database (357 records, 9 profiles, dates up to today). The issue is likely the user hasn't navigated to the Instagram tab since the data was inserted, or the default "7d" filter needs the latest data to show up properly. The UI is functional but plain.

5. User wants: total followers gained in period (not daily average), more visual effects, interactivity.

---

### Implementation Steps

#### Step 1: Add `verify_jwt = false` for webhook in config.toml
Since config.toml is auto-generated, add `[functions.crm-webhook]` section with `verify_jwt = false` so Evolution API can call it without auth.

#### Step 2: Fix `crm-sync-recent` - Remove message-gate, add debug logging
- Remove the check-messages-before-creating-conversation logic (lines 264-283). Instead, ALWAYS create the conversation for valid chats, then fetch messages.
- Add raw response logging for `findMessages` to see exactly what the API returns.
- Try additional response formats: `data.messages.records`, `data.records`, `data.data`, paginated responses.
- Increase default `messagesPerChat` to 50.

#### Step 3: Fix `crm-webhook` - Handle more event names  
- Add handling for `messages_upsert` variants: `message_upsert`, `message`, `messages`, `new_message`.
- Log the raw incoming payload structure when event is unrecognized.
- Ensure `messages_update` also handles message content (some Evolution API versions send full message data in update events too).

#### Step 4: Instagram Dashboard - Change "Média/Dia" to "Seguidores Ganhos"
In `InstagramDashboard.tsx`, replace the "Média Crescimento/Dia" card with "Seguidores Ganhos no Período" showing the sum of `daily_change` across all profiles for the filtered period.

#### Step 5: Instagram Visual Overhaul
Redesign `InstagramDashboard.tsx`, `InstagramProfileCard.tsx`, `InstagramAnalytics.tsx`:
- Add gradient backgrounds to stat cards (green for growth, orange for best profile)
- Animated count-up effect on numbers
- Hover scale transitions on profile cards
- Colored borders/accents based on growth trend (green/red)
- Glass-morphism effect on ranking items
- Pulsing dot indicator for "live" data
- Better sparkline with gradient fill
- Profile cards with subtle shadow and border glow on hover

#### Step 6: Deploy and test sync
Deploy the updated edge functions and trigger a sync to verify messages are now fetched and stored.

### Technical Details

The `verify_jwt` setting is critical - without it, Supabase returns 401 to unauthenticated webhook calls from Evolution API. The telemetry updates seen (`last_webhook_at`) may have been from calls that passed through before a function restart enforced JWT, or from internal routing that bypasses JWT.

The sync's "check messages before creating conversation" pattern is overly cautious - it prevents conversations from being created even when chats exist with valid phone numbers, because the message-fetching API returns data in an unexpected format.

