import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) return res;
      if (i < retries - 1) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error("Max retries reached");
}

async function processBatch(profiles: any[], supabase: any, apifyKey: string, bucketUrl: string) {
  const results: any[] = [];

  for (const profile of profiles) {
    try {
      const apifyUrl = `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${apifyKey}`;
      const res = await fetchWithRetry(apifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [profile.username], resultsLimit: 1 }),
      });

      const data = await res.json();
      if (!data || data.length === 0) {
        results.push({ username: profile.username, status: "not_found" });
        continue;
      }

      const ig = data[0];
      const followerCount = ig.followersCount;
      if (!followerCount || followerCount === 0 || isNaN(followerCount)) {
        results.push({ username: profile.username, status: "invalid_data" });
        continue;
      }

      // Get today's date in São Paulo timezone
      const now = new Date();
      const spDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const recordedDate = spDate.toISOString().split("T")[0];

      // Get previous day's metrics for daily_change
      const { data: prevMetric } = await supabase
        .from("insta_follower_metrics")
        .select("follower_count")
        .eq("profile_id", profile.id)
        .lt("recorded_date", recordedDate)
        .order("recorded_date", { ascending: false })
        .limit(1)
        .single();

      const dailyChange = prevMetric ? followerCount - prevMetric.follower_count : 0;
      const growthRate = prevMetric && prevMetric.follower_count > 0
        ? ((dailyChange / prevMetric.follower_count) * 100)
        : 0;

      // Upsert metrics
      const { error: metricsError } = await supabase
        .from("insta_follower_metrics")
        .upsert({
          profile_id: profile.id,
          follower_count: followerCount,
          following_count: ig.followsCount || 0,
          posts_count: ig.postsCount || 0,
          daily_change: dailyChange,
          growth_rate: Math.round(growthRate * 100) / 100,
          recorded_date: recordedDate,
          recorded_at: new Date().toISOString(),
        }, { onConflict: "profile_id,recorded_date" });

      if (metricsError) {
        console.error(`Metrics upsert error for ${profile.username}:`, metricsError);
      }

      // Update profile picture and display name
      const profilePic = ig.profilePicUrlHD || ig.profilePicUrl || null;
      const updateData: any = {
        display_name: ig.fullName || profile.display_name,
        updated_at: new Date().toISOString(),
      };

      // Download and store profile picture
      if (profilePic) {
        try {
          const picRes = await fetch(profilePic);
          if (picRes.ok) {
            const blob = await picRes.blob();
            const arrayBuf = await blob.arrayBuffer();
            const filePath = `${profile.id}.jpg`;
            
            await supabase.storage
              .from("insta-profile-pictures")
              .upload(filePath, new Uint8Array(arrayBuf), {
                contentType: "image/jpeg",
                upsert: true,
              });

            const { data: urlData } = supabase.storage
              .from("insta-profile-pictures")
              .getPublicUrl(filePath);

            if (urlData?.publicUrl) {
              updateData.profile_picture = urlData.publicUrl + "?t=" + Date.now();
            }
          }
        } catch (picErr) {
          console.error(`Profile pic download failed for ${profile.username}:`, picErr);
          if (profilePic) updateData.profile_picture = profilePic;
        }
      }

      await supabase.from("insta_profiles").update(updateData).eq("id", profile.id);

      results.push({
        username: profile.username,
        status: "success",
        followers: followerCount,
        dailyChange,
      });
    } catch (err) {
      console.error(`Error processing ${profile.username}:`, err);
      results.push({ username: profile.username, status: "error", error: (err as Error).message });
    }
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apifyKey = Deno.env.get("APIFY_API_KEY");

    if (!apifyKey) {
      return new Response(JSON.stringify({ error: "APIFY_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    let body: any = {};
    try { body = await req.json(); } catch {}

    // Health check
    if (body?.mode === "health") {
      return new Response(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build query for profiles
    let query = supabase.from("insta_profiles").select("*").eq("is_active", true);

    if (body?.profileId) {
      query = query.eq("id", body.profileId);
    } else if (body?.organizationId) {
      query = query.eq("organization_id", body.organizationId);
    }

    const { data: profiles, error: profilesError } = await query;
    if (profilesError) throw profilesError;
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum perfil ativo encontrado", results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process in batches of 3
    const batchSize = 3;
    const allResults: any[] = [];
    for (let i = 0; i < profiles.length; i += batchSize) {
      const batch = profiles.slice(i, i + batchSize);
      const batchPromises = batch.map(p => processBatch([p], supabase, apifyKey, supabaseUrl));
      const batchResults = await Promise.all(batchPromises);
      allResults.push(...batchResults.flat());
    }

    return new Response(JSON.stringify({
      message: `${allResults.filter(r => r.status === "success").length}/${profiles.length} perfis atualizados`,
      results: allResults,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
