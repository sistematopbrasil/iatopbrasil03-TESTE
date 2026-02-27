

## Plan: Configure EVOLUTION_WEBHOOK_SECRET

The `crm-webhook` function already validates this secret, but it's not set yet. I need to:

1. **Generate and store the secret**: Use a strong random value (e.g., UUID-based) and add it as a Supabase secret via the `add_secret` tool
2. **Pass the secret in webhook configuration**: Update `crm-create-instance/index.ts` and `crm-check-connection/index.ts` to include the secret as a header in the Evolution API webhook/set call, so the Evolution API sends it back with every webhook request

### Implementation Steps

1. Add `EVOLUTION_WEBHOOK_SECRET` secret with a generated secure value
2. Update `crm-create-instance/index.ts` webhook/set body to include `headers: { 'x-webhook-secret': webhookSecret }` where `webhookSecret = Deno.env.get('EVOLUTION_WEBHOOK_SECRET')`
3. Update `crm-check-connection/index.ts` same way

Note: The Evolution API supports a `headers` field in the webhook configuration that gets sent with every callback request. This is how the secret will flow from config → Evolution API → back to our webhook.

