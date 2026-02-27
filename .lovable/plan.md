

## Plan: Fix Calendars + CRM Incoming Messages

### Calendar Bug (Instagram + Traffic)

**Root cause**: In both `DatePeriodFilter.tsx` and `TrafficPeriodFilter.tsx`, the calendar `selected` prop uses:
```js
selected={value.from && value.to ? { from: value.from, to: value.to } : undefined}
```
When the user clicks the first date, `from` is set but `to` is still null. The ternary evaluates to `undefined`, resetting the visual selection. The user can never complete a range because their first click gets visually erased.

**Fix**: Change to `selected={value.from ? { from: value.from, to: value.to ?? undefined } : undefined}` so partial selections (from without to) are preserved visually, allowing the second click to complete the range.

### CRM Incoming Messages

**Root cause confirmed via logs**: The webhook receives `send.message` and `messages.update` events, but **zero** `messages.upsert` events. The `crm-check-connection` keeps reconfiguring the webhook to `webhook_by_events: false`, but the Evolution API keeps reporting `webhook_by_events: true` -- the setting is not persisting.

This means the Evolution API is routing `MESSAGES_UPSERT` events to a subpath (e.g., `/crm-webhook/MESSAGES_UPSERT`) which Supabase cannot handle, while `send.message` and `messages.update` happen to arrive at the base URL.

**Fix (3-pronged approach)**:

1. **Fix webhook/set call format**: Add `enabled: true` and try `webhookByEvents` (camelCase) alongside `webhook_by_events`. Some Evolution API versions only accept the camelCase variant.

2. **Add `verify_jwt = false` in config.toml**: The `config.toml` currently has no function config. Even though events are arriving, some may be silently rejected by JWT validation.

3. **Add frontend polling fallback for incoming messages**: In `useMessages.ts`, always start a background poll (every 5s) that calls `crmService.getMessages()` to catch any messages missed by realtime. This ensures no message is ever lost regardless of webhook issues.

### Implementation Steps

1. Fix `DatePeriodFilter.tsx` calendar `selected` prop to preserve partial range selection
2. Fix `TrafficPeriodFilter.tsx` calendar `selected` prop same way
3. Update `crm-check-connection/index.ts` webhook/set to include `enabled: true` and `webhookByEvents: false` (camelCase)
4. Update `crm-create-instance/index.ts` same fix
5. Update `useMessages.ts` to always run polling as safety net (not just as realtime fallback)

