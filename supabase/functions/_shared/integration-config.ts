/**
 * Helper compartilhado para leitura de chaves de integração.
 *
 * Estratégia (Fase D):
 *   1. Cache em memória por 60s (por instância de edge function)
 *   2. Tenta ler de `integration_settings` via RPC `get_integration_value`
 *   3. Se vazio/erro → fallback para Deno.env.get(key)
 *   4. Se ambos vazios → retorna null (chamador decide se erro)
 *
 * Mantém comportamento atual enquanto a tabela estiver vazia.
 */

interface CacheEntry {
  value: string | null;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAdmin = any;

/**
 * Lê o valor de uma chave de integração com fallback automático para env.
 * Nunca lança — retorna null se não encontrado.
 */
export async function getIntegrationValue(
  key: string,
  supabaseAdmin: SupabaseAdmin | null,
): Promise<string | null> {
  // 1. Cache hit?
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  let value: string | null = null;

  // 2. Tenta ler do banco
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.rpc("get_integration_value", {
        p_key: key,
      });
      if (!error && typeof data === "string" && data.length > 0) {
        value = data;
      }
    } catch (e) {
      console.warn(`[integration-config] RPC failed for ${key}:`, (e as Error).message);
    }
  }

  // 3. Fallback env
  if (!value) {
    const envValue = Deno.env.get(key);
    if (envValue && envValue.length > 0) {
      value = envValue;
    }
  }

  // 4. Cacheia (mesmo null, para não martelar)
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

/**
 * Igual a getIntegrationValue, mas lança erro se não encontrar valor.
 * Use quando a chave for obrigatória.
 */
export async function getIntegrationValueOrThrow(
  key: string,
  supabaseAdmin: SupabaseAdmin | null,
): Promise<string> {
  const value = await getIntegrationValue(key, supabaseAdmin);
  if (!value) {
    throw new Error(
      `Integration setting '${key}' não está configurada. Defina em Integrações (Super Admin) ou no ambiente.`,
    );
  }
  return value;
}

/**
 * Lê uma chave com valor padrão (para hardcodes legados que viraram chave).
 */
export async function getIntegrationValueOrDefault(
  key: string,
  defaultValue: string,
  supabaseAdmin: SupabaseAdmin | null,
): Promise<string> {
  const value = await getIntegrationValue(key, supabaseAdmin);
  return value ?? defaultValue;
}

/**
 * Limpa o cache. Útil em testes.
 */
export function clearIntegrationCache(): void {
  cache.clear();
}
