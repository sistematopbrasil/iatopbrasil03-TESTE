const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = Deno.env.get("META_ACCESS_TOKEN");
    if (!token) {
      return new Response(JSON.stringify({ error: "META_ACCESS_TOKEN not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status,timezone_name,currency,business_name&limit=100&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      return new Response(JSON.stringify({ error: data.error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accounts = (data.data || []).map((acc: any) => ({
      ad_account_id: acc.id.replace("act_", ""),
      name: acc.name || acc.business_name || acc.id,
      account_status: acc.account_status,
      timezone: acc.timezone_name,
      currency: acc.currency,
    }));

    return new Response(JSON.stringify({ accounts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
