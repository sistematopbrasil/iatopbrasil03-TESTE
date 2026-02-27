
## Plan: Fix Instagram Dates + CRM Missing Incoming Messages

### Root Cause Analysis

**Instagram dates are wrong**: The data was inserted with year **2025** instead of **2026**. Only today's date (2026-02-27) is correct. When you select "30 days" (2026-01-28 to 2026-02-27), only 1 record matches. When you select "Total" (no date filter), all data shows. Fix: SQL migration to shift all 2025 dates to 2026.

**CRM missing incoming messages**: The webhook logs show `send.message` and `messages.update` events arriving, but **zero** `messages.upsert` events (which carry incoming messages). The likely cause is `webhook_by_events: true` in the Evolution API webhook configuration. In some Evolution API versions, this causes events to be routed to subpaths (e.g., `/crm-webhook/MESSAGES_UPSERT`) instead of the base URL. Supabase edge functions don't support path routing, so those events silently fail. Meanwhile, `send.message` and `messages.update` may route differently or not use subpaths.

---

### Implementation Steps

#### Step 1: Fix Instagram dates via SQL migration
```sql
UPDATE insta_follower_metrics 
SET recorded_date = recorded_date + INTERVAL '1 year'
WHERE recorded_date < '2026-01-01';
```
This shifts all 2025 dates to 2026 so they appear in "30 days" and other filters correctly.

#### Step 2: Fix webhook configuration - disable `webhook_by_events`
Update `crm-create-instance/index.ts` and `crm-check-connection/index.ts`:
- Change `webhook_by_events: true` → `webhook_by_events: false`
- This ensures ALL events (including `MESSAGES_UPSERT`) are sent to the same base webhook URL

#### Step 3: Force webhook reconfiguration on connection check
Update `crm-check-connection/index.ts`:
- Always reconfigure webhook when connected (not just when events are missing), since the `webhook_by_events` setting change won't be detected by the current event-check logic

#### Step 4: Add catch-all logging for unrecognized events with message data
Update `crm-webhook/index.ts` default case:
- When an unrecognized event arrives and the payload contains `key` and `message` fields, process it as a message (same as `messages_upsert`) rather than ignoring it
- This provides resilience against event name variations across Evolution API versions
