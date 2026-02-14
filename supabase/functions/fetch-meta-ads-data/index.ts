import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { ad_account_id, organization_id, date_preset } = await req.json();
    if (!ad_account_id || !organization_id) {
      return new Response(JSON.stringify({ error: "ad_account_id and organization_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = Deno.env.get("META_ACCESS_TOKEN")!;
    const preset = date_preset || "last_7d";

    const url = `https://graph.facebook.com/v21.0/act_${ad_account_id}/insights?fields=impressions,clicks,spend,cpc,ctr,reach,frequency,actions&time_increment=1&date_preset=${preset}&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      return new Response(JSON.stringify({ error: data.error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let synced = 0;
    for (const row of data.data || []) {
      const profile_visits = (row.actions || []).find(
        (a: any) => a.action_type === "onsite_conversion.profile_visit" || a.action_type === "page_engagement"
      )?.value || 0;

      const spend = parseFloat(row.spend || "0");
      const pv = parseInt(profile_visits) || 0;

      const { error } = await supabase.from("ad_metrics").upsert({
        ad_account_id,
        date: row.date_start,
        impressions: parseInt(row.impressions || "0"),
        clicks: parseInt(row.clicks || "0"),
        spend,
        cpc: parseFloat(row.cpc || "0"),
        ctr: parseFloat(row.ctr || "0"),
        reach: parseInt(row.reach || "0"),
        frequency: parseFloat(row.frequency || "0"),
        profile_visits: pv,
        cost_per_visit: pv > 0 ? spend / pv : 0,
        organization_id,
      }, { onConflict: "ad_account_id,date,organization_id" });

      if (!error) synced++;
    }

    return new Response(JSON.stringify({ synced, total: (data.data || []).length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
