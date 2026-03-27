const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { ad_account_id } = await req.json();
    if (!ad_account_id) {
      return new Response(JSON.stringify({ error: "ad_account_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = Deno.env.get("META_ACCESS_TOKEN");
    if (!token) {
      return new Response(JSON.stringify({ error: "META_ACCESS_TOKEN not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch campaigns with adsets (including ads with creatives) and insights
    const fields = [
      "id",
      "name",
      "status",
      "objective",
      "daily_budget",
      "lifetime_budget",
      "budget_remaining",
      "start_time",
      "stop_time",
      "created_time",
      "insights.date_preset(last_30d){spend,impressions,clicks,reach,ctr,cpc,frequency}",
      "adsets{id,name,status,daily_budget,lifetime_budget,optimization_goal,targeting,insights.date_preset(last_30d){spend,impressions,clicks,reach,ctr,cpc,frequency},ads{id,name,status,creative{id,name,thumbnail_url,image_url,body,title}}}",
    ].join(",");

    const url = `https://graph.facebook.com/v21.0/act_${ad_account_id}/campaigns?fields=${encodeURIComponent(fields)}&limit=50&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      return new Response(JSON.stringify({ error: data.error.message, code: data.error.code }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    function parseInsights(insightsData: any) {
      return {
        spend: Number(insightsData?.spend || 0),
        impressions: Number(insightsData?.impressions || 0),
        clicks: Number(insightsData?.clicks || 0),
        reach: Number(insightsData?.reach || 0),
        ctr: Number(insightsData?.ctr || 0),
        cpc: Number(insightsData?.cpc || 0),
        frequency: Number(insightsData?.frequency || 0),
      };
    }

    function parseTargeting(targeting: any) {
      const geoLocations = targeting?.geo_locations || {};
      const cities = (geoLocations.cities || []).map((city: any) => city.name || city.key);
      const regions = (geoLocations.regions || []).map((r: any) => r.name || r.key);
      const countries = (geoLocations.countries || []);
      const allLocations = [...cities, ...regions, ...countries].filter(Boolean);

      const flexibleSpec = targeting?.flexible_spec || [];
      const interests: string[] = [];
      for (const spec of flexibleSpec) {
        for (const interest of spec.interests || []) interests.push(interest.name);
        for (const behavior of spec.behaviors || []) interests.push(behavior.name);
      }

      const genders = targeting?.genders || [];
      let genderLabel = "Todos";
      if (genders.length === 1) genderLabel = genders[0] === 1 ? "Masculino" : "Feminino";

      const publisherPlatforms = targeting?.publisher_platforms || [];
      const facebookPositions = targeting?.facebook_positions || [];
      const instagramPositions = targeting?.instagram_positions || [];
      const allPlacements = [
        ...publisherPlatforms,
        ...facebookPositions.map((p: string) => `fb_${p}`),
        ...instagramPositions.map((p: string) => `ig_${p}`),
      ];

      return {
        age_min: targeting?.age_min || 18,
        age_max: targeting?.age_max || 65,
        gender: genderLabel,
        locations: allLocations,
        interests,
        placements: allPlacements,
        publisher_platforms: publisherPlatforms,
      };
    }

    const campaigns = (data.data || []).map((c: any) => {
      const insightsData = c.insights?.data?.[0] || {};
      const adsets = c.adsets?.data || [];
      const firstAdset = adsets[0] || {};

      const parsedAdsets = adsets.map((as: any) => {
        const asAds = (as.ads?.data || []).map((ad: any) => ({
          id: ad.id,
          name: ad.name,
          status: ad.status,
          creative: ad.creative ? {
            id: ad.creative.id,
            name: ad.creative.name || null,
            thumbnail_url: ad.creative.thumbnail_url || null,
            image_url: ad.creative.image_url || null,
            body: ad.creative.body || null,
            title: ad.creative.title || null,
          } : null,
        }));

        return {
          id: as.id,
          name: as.name,
          status: as.status,
          daily_budget: as.daily_budget ? Number(as.daily_budget) / 100 : null,
          lifetime_budget: as.lifetime_budget ? Number(as.lifetime_budget) / 100 : null,
          optimization_goal: as.optimization_goal || null,
          targeting: parseTargeting(as.targeting),
          insights: parseInsights(as.insights?.data?.[0]),
          ads: asAds,
        };
      });

      return {
        id: c.id,
        name: c.name,
        status: c.status,
        objective: c.objective || "UNKNOWN",
        daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
        lifetime_budget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
        budget_remaining: c.budget_remaining ? Number(c.budget_remaining) / 100 : null,
        start_time: c.start_time,
        stop_time: c.stop_time,
        created_time: c.created_time,
        insights: parseInsights(insightsData),
        targeting: parseTargeting(firstAdset.targeting),
        adsets_count: adsets.length,
        adsets: parsedAdsets,
      };
    });

    return new Response(JSON.stringify({ campaigns }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error fetching campaigns:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
