const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaign_id, status, entity_id, entity_type } = await req.json();

    // Support both legacy (campaign_id) and new (entity_id + entity_type) params
    const targetId = entity_id || campaign_id;
    const targetType = entity_type || "campaign";

    if (!targetId || !status) {
      return new Response(JSON.stringify({ error: "ID e status são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["campaign", "adset", "ad"].includes(targetType)) {
      return new Response(JSON.stringify({ error: "entity_type deve ser campaign, adset ou ad" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["ACTIVE", "PAUSED"].includes(status)) {
      return new Response(JSON.stringify({ error: "Status deve ser ACTIVE ou PAUSED" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN");
    if (!META_ACCESS_TOKEN) throw new Error("META_ACCESS_TOKEN não configurado");

    const url = `https://graph.facebook.com/v21.0/${targetId}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        access_token: META_ACCESS_TOKEN,
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error("Meta API error:", data);
      return new Response(
        JSON.stringify({ error: data.error?.message || "Erro ao alterar status da campanha" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("toggle-campaign-status error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
