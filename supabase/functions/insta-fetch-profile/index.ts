import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getIntegrationValue, getIntegrationValueOrDefault } from "../_shared/integration-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username } = await req.json();
    if (!username) {
      return new Response(JSON.stringify({ error: "Username é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean username (remove @ and URL parts)
    const cleanUsername = username
      .replace(/^@/, "")
      .replace(/^https?:\/\/(www\.)?instagram\.com\//, "")
      .replace(/\/$/, "")
      .trim();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const apifyKey = await getIntegrationValue("APIFY_API_KEY", supabaseAdmin);
    if (!apifyKey) {
      return new Response(JSON.stringify({ error: "APIFY_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const actorId = await getIntegrationValueOrDefault(
      "APIFY_ACTOR_ID",
      "apify~instagram-profile-scraper",
      supabaseAdmin,
    );

    // Call Apify Instagram Profile Scraper
    const apifyUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apifyKey}`;
    const apifyResponse = await fetch(apifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usernames: [cleanUsername],
        resultsLimit: 1,
      }),
    });

    if (!apifyResponse.ok) {
      const errText = await apifyResponse.text();
      console.error("Apify error:", errText);
      return new Response(JSON.stringify({ error: "Erro ao buscar dados do Instagram" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await apifyResponse.json();
    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ error: "Perfil não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profile = data[0];
    const result = {
      username: profile.username || cleanUsername,
      displayName: profile.fullName || profile.username || cleanUsername,
      followerCount: profile.followersCount || 0,
      followingCount: profile.followsCount || 0,
      postsCount: profile.postsCount || 0,
      profilePicture: profile.profilePicUrl || profile.profilePicUrlHD || null,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
