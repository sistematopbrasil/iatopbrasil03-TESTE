

## Plan: Fix CRM Messages, QR Code, and New Account Issues

### Root Cause Analysis

**Messages not appearing**: Two problems compound:
1. The webhook is rejecting ALL incoming messages (`⛔ Webhook request com secret inválido`) because the Evolution API was configured before the secret was added. Even though `crm-check-connection` reconfigures the webhook every 15s, it keeps reverting to `webhook_by_events: true`.
2. The `crm-sync-recent` function finds 3 chats but skips ALL of them because they have invalid phone numbers (6-7 digits). The sync returns `0 conversas, 0 mensagens` every time. This means neither webhook NOR sync is delivering messages.

**QR Code issues**: No expiration timer. QR codes display indefinitely even after expiring (~45-60s). No auto-refresh on expiration.

**New account showing reconnect**: When a new user opens CRM, `loadInstance()` calls `crmService.getInstance()` which queries `whatsapp_instances` filtered by user. If a previous instance record exists (status = `disconnected`), it shows the reconnect screen instead of the fresh "create instance" screen.

### Implementation Steps

#### Step 1: Make webhook secret validation graceful during transition
In `supabase/functions/crm-webhook/index.ts`:
- Change the secret validation to **log a warning but still process the request** if the secret is missing from the request headers (not reject with 401)
- Only reject if a secret IS provided but doesn't match
- This allows the transition period where Evolution API hasn't been reconfigured yet

```
// If secret is configured but request has NO secret header -> allow (transition period)  
// If secret is configured and request HAS wrong secret -> reject
```

#### Step 2: Fix crm-sync-recent to handle short phone numbers
In `supabase/functions/crm-sync-recent/index.ts`:
- The current filter rejects phones with < 12 digits. But the Evolution API sometimes returns short JIDs for status broadcasts or service numbers
- Lower the minimum to 10 digits (DDD + 8-digit number without country code)
- Add `55` prefix for 10-11 digit numbers before validation

#### Step 3: Add QR Code expiration timer
In `src/contexts/WhatsAppConnectionContext.tsx`:
- Add a `qrCodeTimestamp` state that records when the QR was set
- Add a 45-second timer that auto-calls `refreshQRCode()` when the QR expires
- Clear the timer when QR changes or connection succeeds

In `src/components/crm/DisconnectedOverlay.tsx` and `src/components/crm/ConnectionPanel.tsx`:
- Show a countdown timer next to QR code ("Expira em Xs")
- When expired, show "QR Expirado" with auto-refresh animation

#### Step 4: Fix new account showing reconnect screen
In `src/components/crm/ConnectionPanel.tsx`:
- The component already handles `!instance` (no instance) correctly with the "Iniciar Conexão" button
- The issue is that a new user may inherit an old disconnected instance. Fix `loadInstance` in the context to treat a `disconnected` instance that was NEVER connected (no `last_connected_at`) as equivalent to no instance — show the create flow

In `src/contexts/WhatsAppConnectionContext.tsx`:
- In `loadInstance`, if instance exists with status `disconnected` and `last_connected_at` is null, treat it as a fresh setup: auto-call `connectInstance()` instead of showing the disconnected overlay

#### Step 5: Force webhook reconfiguration with secret on next health check
In `supabase/functions/crm-check-connection/index.ts`:
- Always include the webhook secret in reconfiguration (already done)
- Add a check: if the current webhook config doesn't have the `x-webhook-secret` header, force reconfigure even if events are correct
- This ensures the secret propagates after first health check

### Technical Notes
- The most critical fix is Step 1 (webhook grace period). Without it, ALL webhook messages are rejected. The sync alone can't compensate because it's finding only invalid short numbers.
- QR codes from Evolution API typically expire in 45-60 seconds. The 45s auto-refresh gives a buffer.
- The new account issue likely happens because `crm-create-instance` creates a record before the QR flow completes, leaving an orphaned `disconnected` instance.

