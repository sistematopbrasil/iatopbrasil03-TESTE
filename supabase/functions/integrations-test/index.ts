import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  getIntegrationValueOrDefault,
  getIntegrationValueOrThrow,
} from "../_shared/integration-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TestResult {
  ok: boolean;
  latency_ms: number;
  message: string;
}

async function testWhatsApp(supabaseAdmin: any): Promise<TestResult> {
  const start = Date.now();
  try {
    const url = await getIntegrationValueOrThrow("EVOLUTION_API_URL", supabaseAdmin);
    const key = await getIntegrationValueOrThrow("EVOLUTION_API_KEY", supabaseAdmin);
    const res = await fetch(`${url.replace(/\/$/, "")}/instance/fetchInstances`, {
      headers: { apikey: key },
    });
    const latency = Date.now() - start;
    if (!res.ok) {
      return {
        ok: false,
        latency_ms: latency,
        message: `Evolution respondeu ${res.status}`,
      };
    }
    return { ok: true, latency_ms: latency, message: "Conectado à Evolution API" };
  } catch (e) {
    return {
      ok: false,
      latency_ms: Date.now() - start,
      message: (e as Error).message,
    };
  }
}

async function testMetaAds(supabaseAdmin: any): Promise<TestResult> {
  const start = Date.now();
  try {
    const token = await getIntegrationValueOrThrow("META_ACCESS_TOKEN", supabaseAdmin);
    const version = await getIntegrationValueOrDefault(
      "META_GRAPH_VERSION",
      "v21.0",
      supabaseAdmin,
    );
    const res = await fetch(
      `https://graph.facebook.com/${version}/me?access_token=${encodeURIComponent(token)}`,
    );
    const latency = Date.now() - start;
    const data = await res.json();
    if (!res.ok || data.error) {
      return {
        ok: false,
        latency_ms: latency,
        message: data.error?.message ?? `Meta respondeu ${res.status}`,
      };
    }
    return {
      ok: true,
      latency_ms: latency,
      message: `Conectado como ${data.name ?? data.id}`,
    };
  } catch (e) {
    return {
      ok: false,
      latency_ms: Date.now() - start,
      message: (e as Error).message,
    };
  }
}

async function testInstagram(supabaseAdmin: any): Promise<TestResult> {
  const start = Date.now();
  try {
    const token = await getIntegrationValueOrThrow("APIFY_API_KEY", supabaseAdmin);
    const res = await fetch(
      `https://api.apify.com/v2/users/me?token=${encodeURIComponent(token)}`,
    );
    const latency = Date.now() - start;
    if (!res.ok) {
      return {
        ok: false,
        latency_ms: latency,
        message: `Apify respondeu ${res.status}`,
      };
    }
    const data = await res.json();
    return {
      ok: true,
      latency_ms: latency,
      message: `Conectado a Apify (${data.data?.username ?? "ok"})`,
    };
  } catch (e) {
    return {
      ok: false,
      latency_ms: Date.now() - start,
      message: (e as Error).message,
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Valida usuário (precisa estar logado)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: isSuperAdmin, error: roleErr } = await supabaseUser.rpc("is_super_admin");
    if (roleErr || !isSuperAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const category = body?.category as string | undefined;

    if (!category || !["whatsapp", "meta_ads", "instagram"].includes(category)) {
      return new Response(
        JSON.stringify({ error: "category inválida (whatsapp | meta_ads | instagram)" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    let result: TestResult;
    if (category === "whatsapp") result = await testWhatsApp(supabaseAdmin);
    else if (category === "meta_ads") result = await testMetaAds(supabaseAdmin);
    else result = await testInstagram(supabaseAdmin);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, latency_ms: 0, message: (e as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
