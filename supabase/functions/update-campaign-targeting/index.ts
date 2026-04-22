import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getIntegrationValue, getIntegrationValueOrDefault } from "../_shared/integration-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { adset_id, age_min, age_max, genders, publisher_platforms, daily_budget } = await req.json();

    if (!adset_id) {
      return new Response(JSON.stringify({ error: "adset_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const META_ACCESS_TOKEN = await getIntegrationValue("META_ACCESS_TOKEN", supabaseAdmin);
    if (!META_ACCESS_TOKEN) throw new Error("META_ACCESS_TOKEN não configurado");
    const version = await getIntegrationValueOrDefault("META_GRAPH_VERSION", "v21.0", supabaseAdmin);

    // Build update payload
    const updates: Record<string, any> = { access_token: META_ACCESS_TOKEN };

    // If targeting fields are provided, build targeting object
    if (age_min !== undefined || age_max !== undefined || genders !== undefined || publisher_platforms !== undefined) {
      // First fetch current targeting to merge
      const getUrl = `https://graph.facebook.com/${version}/${adset_id}?fields=targeting&access_token=${META_ACCESS_TOKEN}`;
      const getResp = await fetch(getUrl);
      const getData = await getResp.json();
      
      if (getData.error) {
        return new Response(JSON.stringify({ error: getData.error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const currentTargeting = getData.targeting || {};
      const newTargeting = { ...currentTargeting };

      if (age_min !== undefined) newTargeting.age_min = age_min;
      if (age_max !== undefined) newTargeting.age_max = age_max;
      if (genders !== undefined) newTargeting.genders = genders; // [1] = male, [2] = female, [] = all
      if (publisher_platforms !== undefined) newTargeting.publisher_platforms = publisher_platforms;

      updates.targeting = JSON.stringify(newTargeting);
    }

    // Update budget if provided (Meta expects budget in cents)
    if (daily_budget !== undefined) {
      updates.daily_budget = Math.round(daily_budget * 100);
    }

    const url = `https://graph.facebook.com/${version}/${adset_id}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error("Meta API error:", data);
      return new Response(
        JSON.stringify({ error: data.error?.message || "Erro ao atualizar conjunto de anúncios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("update-campaign-targeting error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
