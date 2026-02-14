import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: accounts, error: accErr } = await supabase
      .from("ad_accounts")
      .select("ad_account_id, organization_id")
      .eq("is_monitored", true);

    if (accErr) throw accErr;
    if (!accounts?.length) {
      return new Response(JSON.stringify({ message: "No monitored accounts" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
            date_preset: "last_7d",
          }),
        });
        const data = await res.json();
        results.push({ ad_account_id: acc.ad_account_id, ...data });

        // Update last_synced_at
        await supabase
          .from("ad_accounts")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("ad_account_id", acc.ad_account_id)
          .eq("organization_id", acc.organization_id);
      } catch (e) {
        results.push({ ad_account_id: acc.ad_account_id, error: e.message });
      }
    }

    return new Response(JSON.stringify({ synced: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
