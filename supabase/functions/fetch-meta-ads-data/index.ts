import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fetchAllPages(url: string): Promise<any[]> {
  const allData: any[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const res = await fetch(nextUrl);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    if (json.data) allData.push(...json.data);
    nextUrl = json.paging?.next || null;
  }

  return allData;
}

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
    const preset = date_preset || "last_3d";

    const fields = "impressions,clicks,spend,cpc,ctr,reach,frequency,actions,action_values";
    const url = `https://graph.facebook.com/v21.0/act_${ad_account_id}/insights?fields=${fields}&time_increment=1&date_preset=${preset}&limit=100&access_token=${token}`;

    const rows = await fetchAllPages(url);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let synced = 0;
    for (const row of rows) {
      const actions = row.actions || [];

      const findAction = (...types: string[]) => {
        for (const t of types) {
          const found = actions.find((a: any) => a.action_type === t);
          if (found) return parseInt(found.value) || 0;
        }
        return 0;
      };

      const profile_visits = findAction(
        "instagram_profile_visit",
        "onsite_conversion.instagram_profile_visit",
        "onsite_conversion.profile_visit"
      );
      const post_engagement = findAction("post_engagement", "post");
      const conversions = findAction(
        "offsite_conversion.fb_pixel_purchase",
        "onsite_conversion.messaging_conversation_started_7d",
        "lead",
        "complete_registration"
      );

      const spend = parseFloat(row.spend || "0");
      const pv = profile_visits;

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
        post_engagement,
        conversions,
        organization_id,
      }, { onConflict: "ad_account_id,date,organization_id" });

      if (!error) synced++;
    }

    return new Response(JSON.stringify({ synced, total: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
