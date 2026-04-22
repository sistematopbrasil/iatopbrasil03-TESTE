import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const { ad_account_id, organization_id } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let accounts: { ad_account_id: string; organization_id: string }[] = [];
    if (ad_account_id) {
      accounts = [{ ad_account_id, organization_id }];
    } else {
      let q = supabase
        .from("ad_accounts")
        .select("ad_account_id, organization_id")
        .eq("is_monitored", true);
      if (organization_id) q = q.eq("organization_id", organization_id);
      const { data } = await q;
      accounts = data || [];
    }

    const baseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const results: any[] = [];

    for (const acc of accounts) {
      try {
        const res = await fetch(`${baseUrl}/functions/v1/fetch-meta-ads-data`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            ad_account_id: acc.ad_account_id,
            organization_id: acc.organization_id,
            date_preset: "last_90d",
          }),
        });
        const data = await res.json();
        results.push({ ad_account_id: acc.ad_account_id, ...data });
      } catch (e: any) {
        results.push({ ad_account_id: acc.ad_account_id, error: e.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
