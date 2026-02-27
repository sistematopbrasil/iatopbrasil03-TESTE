

## Plan: Fix CRM Incoming Messages + Security Hardening

### CRM Root Cause (Definitive)

The analytics logs confirm **ZERO POST requests** from Evolution API to `crm-webhook`. Despite repeatedly setting `webhook_by_events: false`, the Evolution API reports `true` on every check. The webhook is simply not receiving incoming messages.

The sync function (`crm-sync-recent`) DOES work -- it successfully fetches 77 messages via API polling. But it only runs every 60 seconds and only when the CRM page is open.

**Solution**: Since the webhook is unreliable, make `crm-sync-recent` the primary message ingestion mechanism with much higher frequency. The webhook stays as a bonus if it ever works.

### Implementation Steps

#### Step 1: Increase sync frequency for near-realtime messaging
In `useConversations.ts`:
- Change sync interval from 60s to **15s** (line 63)
- Increase `messagesPerChat` in auto-sync from 15 to 30

In `useMessages.ts`:
- The polling already runs every 3s (line 50) for the active conversation -- this is good
- But it only polls messages for the OPEN conversation. Add a lightweight sync trigger that also refreshes the conversation list

#### Step 2: Add conversation-level polling in useMessages
When polling detects new messages, also invalidate the conversations query so new conversations from incoming messages (created by sync) appear immediately.

#### Step 3: Fix create-admin weak secret
In `supabase/functions/create-admin/index.ts`:
- Remove the default fallback `|| 'topbrasil2025'`
- Fail if `ADMIN_CREATION_SECRET` is not set
- Increase minimum password length to 8

#### Step 4: Tighten quiz_submissions RLS policies
Create a migration to:
- Add session-based validation for quiz_submissions INSERT/UPDATE
- Restrict `quiz_submissions_new` UPDATE to only allow updates within a 1-hour window AND require `organization_id` match for non-recent updates
- These are public-facing quiz forms, so anonymous INSERT must remain but with reasonable constraints

#### Step 5: Add webhook secret validation for CRM webhook
- Check if Evolution API supports a webhook secret header
- Add `x-webhook-secret` header validation in `crm-webhook/index.ts` using a stored secret
- This prevents spoofed webhook requests even with `verify_jwt = false`

#### Step 6: Enable leaked password protection
Use the configure-auth tool to enable leaked password protection.

### Technical Notes

The 15-second sync interval is the key fix. Since `crm-sync-recent` already creates conversations and inserts messages via upsert (with `ignoreDuplicates: true`), running it more frequently is safe and idempotent. Combined with the 3-second message polling for the active conversation, this provides near-realtime messaging without depending on the broken webhook.

The `quiz_submissions` tables need `WITH CHECK (true)` for INSERT because they're public quiz forms submitted by anonymous users. The risk is acceptable given the data is non-sensitive lead information. We'll add rate limiting via timestamp checks instead.

