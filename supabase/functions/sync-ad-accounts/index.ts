import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { accounts, organization_id } = await req.json();
    if (!accounts?.length || !organization_id) {
      return new Response(JSON.stringify({ error: "accounts and organization_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = Deno.env.get("META_ACCESS_TOKEN")!;
    const results: any[] = [];

    for (const acc of accounts) {
      // Try to fetch page and instagram info
      let page_id = null, page_name = null, instagram_user_id = null, instagram_username = null;
      try {
        const pagesRes = await fetch(
          `https://graph.facebook.com/v21.0/act_${acc.ad_account_id}/promote_pages?fields=id,name,instagram_business_account{id,username}&access_token=${token}`
        );
        const pagesData = await pagesRes.json();
        if (pagesData.data?.[0]) {
          page_id = pagesData.data[0].id;
          page_name = pagesData.data[0].name;
          if (pagesData.data[0].instagram_business_account) {
            instagram_user_id = pagesData.data[0].instagram_business_account.id;
            instagram_username = pagesData.data[0].instagram_business_account.username;
          }
        }
      } catch (_) { /* ignore */ }

      const { data, error } = await supabase
        .from("ad_accounts")
        .upsert({
          ad_account_id: acc.ad_account_id,
          name: acc.name,
          meta_status: String(acc.account_status || ""),
          timezone: acc.timezone,
          currency: acc.currency,
          organization_id,
          page_id,
          page_name,
          instagram_user_id,
          instagram_username,
          is_monitored: true,
          status: "active",
        }, { onConflict: "ad_account_id,organization_id" })
        .select()
        .single();

      results.push({ ad_account_id: acc.ad_account_id, success: !error, error: error?.message });
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
