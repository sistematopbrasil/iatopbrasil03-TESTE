import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getIntegrationValue, getIntegrationValueOrDefault } from "../_shared/integration-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const token = await getIntegrationValue("META_ACCESS_TOKEN", supabaseAdmin);
    if (!token) {
      return new Response(JSON.stringify({ valid: false, error: "META_ACCESS_TOKEN not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const version = await getIntegrationValueOrDefault("META_GRAPH_VERSION", "v21.0", supabaseAdmin);

    const res = await fetch(`https://graph.facebook.com/${version}/me?access_token=${token}`);
    const data = await res.json();

    if (data.error) {
      return new Response(JSON.stringify({ valid: false, error: data.error.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ valid: true, name: data.name, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ valid: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
