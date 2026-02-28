

## Plan: Fix CRM Messages + Resolve All Security Issues

### Part 1: CRM Messages — Root Cause Found

**Evidence from logs and database:**
- The webhook IS receiving `messages_update` events (status changes) — last one at `2026-02-28 00:23:24`
- But NO `messages_upsert` events (new messages) are arriving since Feb 27
- The `crm-check-connection` function runs every 15s and detects `webhookByEvents === true`, then tries to delete+recreate the webhook. This constant 15-second churn is disrupting message delivery.

**The old working project used `webhookByEvents: true`** — meaning events go to sub-paths like `/crm-webhook/MESSAGES_UPSERT`. Supabase Edge Functions handle sub-paths natively. This worked perfectly.

Our code fights the Evolution API by setting `webhookByEvents: false`, which the API keeps reverting to `true`. The constant delete+recreate cycle every 15 seconds is the destructive factor.

**Fix (3 files):**

1. **`crm-create-instance/index.ts`** — Change all 3 occurrences of `webhookByEvents: false` to `webhookByEvents: true`. Remove the delete+recreate webhook strategy. Use simple POST.

2. **`crm-check-connection/index.ts`** — Remove `currentWebhookByEvents === true` from the `needsReconfigure` condition (since `true` is now correct). Remove the delete+recreate strategy. Only reconfigure if events are missing or secret header is needed. Change webhook payload to `webhookByEvents: true`.

3. **`crm-sync-recent/index.ts`** — No changes needed (already fixed in previous iteration).

### Part 2: Security Fixes

**Migration (1 SQL migration):**

1. Add authentication-required RLS policies for 7 tables:
   - `users` — require `auth.uid() IS NOT NULL` for SELECT
   - `quiz_submissions_new` — require auth for SELECT (public INSERT stays)  
   - `consultant_recruits` — require auth for SELECT
   - `organizations` — require auth for SELECT
   - `crm_conversations` — require auth for SELECT
   - `crm_messages` — require auth for SELECT
   - `tracking_sessions` — require auth for SELECT

2. Fix hardcoded encryption key fallback — change `encrypt_api_key` and `decrypt_api_key` to raise an exception instead of using hardcoded key

**Edge function fixes:**

3. **`supabase/functions/create-admin/index.ts`** — Return 401 instead of 500 when `ADMIN_CREATION_SECRET` is not configured

4. **`supabase/functions/crm-webhook/index.ts`** — Remove transition mode: reject requests without secret header when `EVOLUTION_WEBHOOK_SECRET` is configured

**Auth config:**

5. Enable leaked password protection via configure-auth tool

### Files to Edit
- `supabase/functions/crm-create-instance/index.ts`
- `supabase/functions/crm-check-connection/index.ts`
- `supabase/functions/create-admin/index.ts`
- `supabase/functions/crm-webhook/index.ts`
- 1 SQL migration for RLS policies + encryption key fix

