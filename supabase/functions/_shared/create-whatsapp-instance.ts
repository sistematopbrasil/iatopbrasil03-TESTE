// Helper compartilhado: cria/adota instância WhatsApp na Evolution API
// e registra no banco. Usado por create-consultant e update-consultant-funnel-access.
import { getIntegrationValue } from './integration-config.ts';

type Funnel = 'consultor' | 'associado';

interface CreateInstanceParams {
  supabaseAdmin: any;
  userId: string;
  organizationId: string;
  fullNameOrUsername: string;
  funnel: Funnel;
}

interface CreateInstanceResult {
  ok: boolean;
  funnel: Funnel;
  instance_name?: string;
  reused?: boolean;
  error?: string;
}

const FUNNEL_SUFFIX: Record<Funnel, string> = {
  consultor: 'consultor',
  associado: 'associados',
};

function sanitizeBase(name: string) {
  return (
    (name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20) || 'consultor'
  );
}

async function evolutionGet(url: string, apiKey: string) {
  try {
    const r = await fetch(url, { headers: { apikey: apiKey } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function evolutionInstanceExists(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
): Promise<boolean> {
  const cleaned = baseUrl.replace(/\/$/, '');
  // Endpoint padrão Evolution v2: GET /instance/fetchInstances?instanceName=<name>
  const data = await evolutionGet(
    `${cleaned}/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`,
    apiKey,
  );
  if (!data) return false;
  if (Array.isArray(data) && data.length > 0) return true;
  if (data?.instance) return true;
  return false;
}

export async function createWhatsAppInstanceForFunnel(
  params: CreateInstanceParams,
): Promise<CreateInstanceResult> {
  const { supabaseAdmin, userId, organizationId, fullNameOrUsername, funnel } = params;

  const EVOLUTION_API_URL = await getIntegrationValue('EVOLUTION_API_URL', supabaseAdmin);
  const EVOLUTION_API_KEY = await getIntegrationValue('EVOLUTION_API_KEY', supabaseAdmin);
  const EVOLUTION_WEBHOOK_SECRET =
    (await getIntegrationValue('EVOLUTION_WEBHOOK_SECRET', supabaseAdmin)) || '';

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return { ok: false, funnel, error: 'Evolution API não configurada' };
  }

  const baseUrl = EVOLUTION_API_URL.replace(/\/$/, '');
  const webhookBase = `${Deno.env.get('SUPABASE_URL')}/functions/v1/crm-webhook`;
  const webhookUrl = EVOLUTION_WEBHOOK_SECRET
    ? `${webhookBase}?secret=${encodeURIComponent(EVOLUTION_WEBHOOK_SECRET)}`
    : webhookBase;

  // Já existe instância para esse user+funil no banco? Aborta sem erro.
  const { data: existingDb } = await supabaseAdmin
    .from('whatsapp_instances')
    .select('id, instance_name')
    .eq('user_id', userId)
    .eq('funnel_type', funnel)
    .maybeSingle();
  if (existingDb) {
    return { ok: true, funnel, instance_name: existingDb.instance_name, reused: true };
  }

  const sanitized = sanitizeBase(fullNameOrUsername);
  const desiredBase = `${sanitized}-${FUNNEL_SUFFIX[funnel]}`;

  // Acha um nome livre tanto no banco quanto na Evolution
  let candidate = desiredBase;
  let counter = 1;
  for (let i = 0; i < 50; i++) {
    const { data: clash } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('id')
      .eq('instance_name', candidate)
      .maybeSingle();
    if (!clash) {
      const evolutionHas = await evolutionInstanceExists(baseUrl, EVOLUTION_API_KEY, candidate);
      if (!evolutionHas) break;
      // Existe na Evolution mas não no banco => vamos ADOTAR essa instância
      const { data: inserted, error: adoptErr } = await supabaseAdmin
        .from('whatsapp_instances')
        .insert({
          user_id: userId,
          organization_id: organizationId,
          instance_name: candidate,
          instance_key: candidate,
          status: 'disconnected',
          webhook_url: webhookUrl,
          funnel_type: funnel,
        })
        .select('id, instance_name')
        .single();
      if (adoptErr) {
        return { ok: false, funnel, error: `Falha ao adotar instância órfã: ${adoptErr.message}` };
      }
      return { ok: true, funnel, instance_name: inserted.instance_name, reused: true };
    }
    counter += 1;
    candidate = `${desiredBase}-${counter}`;
  }

  // Cria de fato na Evolution
  try {
    const r = await fetch(`${baseUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        instanceName: candidate,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        webhook: {
          url: webhookUrl,
          enabled: true,
          webhookByEvents: false,
          webhookBase64: true,
          headers: EVOLUTION_WEBHOOK_SECRET
            ? { 'x-webhook-secret': EVOLUTION_WEBHOOK_SECRET }
            : undefined,
          events: [
            'QRCODE_UPDATED',
            'CONNECTION_UPDATE',
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'SEND_MESSAGE',
          ],
        },
      }),
    });
    const txt = await r.text();
    if (!r.ok) {
      return { ok: false, funnel, error: `Evolution API: ${txt.substring(0, 200)}` };
    }
  } catch (e: any) {
    return { ok: false, funnel, error: `Falha ao chamar Evolution: ${e?.message || 'unknown'}` };
  }

  // Insere no banco
  const { error: insertErr } = await supabaseAdmin
    .from('whatsapp_instances')
    .insert({
      user_id: userId,
      organization_id: organizationId,
      instance_name: candidate,
      instance_key: candidate,
      status: 'disconnected',
      webhook_url: webhookUrl,
      funnel_type: funnel,
    });
  if (insertErr) {
    return { ok: false, funnel, error: `Falha ao salvar no banco: ${insertErr.message}` };
  }

  return { ok: true, funnel, instance_name: candidate };
}
