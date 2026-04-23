import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helpers for date arithmetic in YYYY-MM-DD
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}
function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const { organization_id, days_back = 90 } = body;

    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch monitored accounts
    const { data: accounts, error: accErr } = await supabase
      .from("ad_accounts")
      .select("ad_account_id, organization_id")
      .eq("is_monitored", true)
      .eq("organization_id", organization_id);

    if (accErr) throw accErr;
    if (!accounts?.length) {
      return new Response(JSON.stringify({ message: "No monitored accounts", filled: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const startWindow = addDays(today, -days_back);

    const baseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const filled: any[] = [];

    for (const acc of accounts) {
      try {
        // Get all dates we have for this account in the window
        const { data: existing } = await supabase
          .from("ad_metrics")
          .select("date")
          .eq("ad_account_id", acc.ad_account_id)
          .eq("organization_id", acc.organization_id)
          .gte("date", isoDate(startWindow))
          .lte("date", isoDate(today))
          .order("date", { ascending: true });

        const have = new Set((existing || []).map((r: any) => r.date));

        // Build list of missing dates
        const missing: string[] = [];
        for (let i = 0; i <= days_back; i++) {
          const d = addDays(startWindow, i);
          const key = isoDate(d);
          if (!have.has(key)) missing.push(key);
        }

        if (missing.length === 0) {
          filled.push({ ad_account_id: acc.ad_account_id, gaps: 0, days_filled: 0 });
          continue;
        }

        // Group consecutive missing dates into ranges
        const ranges: Array<{ since: string; until: string }> = [];
        let rangeStart = missing[0];
        let prev = missing[0];
        for (let i = 1; i < missing.length; i++) {
          const cur = missing[i];
          const prevDate = new Date(prev + "T00:00:00Z");
          const curDate = new Date(cur + "T00:00:00Z");
          if (diffDays(curDate, prevDate) === 1) {
            prev = cur;
            continue;
          }
          ranges.push({ since: rangeStart, until: prev });
          rangeStart = cur;
          prev = cur;
        }
        ranges.push({ since: rangeStart, until: prev });

        let totalSynced = 0;
        for (const r of ranges) {
          const res = await fetch(`${baseUrl}/functions/v1/fetch-meta-ads-data`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              ad_account_id: acc.ad_account_id,
              organization_id: acc.organization_id,
              time_range: { since: r.since, until: r.until },
            }),
          });
          const data = await res.json();
          totalSynced += data.synced || 0;
        }

        filled.push({
          ad_account_id: acc.ad_account_id,
          gaps: ranges.length,
          missing_days: missing.length,
          days_filled: totalSynced,
          ranges,
        });
      } catch (e: any) {
        filled.push({ ad_account_id: acc.ad_account_id, error: e.message });
      }
    }

    return new Response(JSON.stringify({ filled }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
