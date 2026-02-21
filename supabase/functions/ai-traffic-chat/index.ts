import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PROMPT = `Você é um especialista sênior em Meta Ads (Facebook e Instagram Ads), com profundo conhecimento em estratégias de performance, otimização de campanhas e análise de métricas.

INSTRUÇÕES:
- Responda SEMPRE em português brasileiro
- Seja preciso e use os dados reais fornecidos
- Ao analisar campanhas, cite nomes e métricas específicas
- Identifique anomalias: CTR abaixo de 1%, CPC acima da média do setor, frequência alta (>3)
- Ao sugerir otimizações, explique o raciocínio com base nos dados
- Sugira públicos baseados no targeting existente
- Quando criar briefings de novas campanhas, seja detalhado: objetivo, público-alvo, orçamento sugerido, posicionamentos recomendados, tipos de criativo
- Compare performance entre campanhas quando relevante
- Use formatação markdown para listas e destaques
- Se algum dado estiver ausente, informe e sugira como obtê-lo`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, account_name, ad_account_id, campaigns_data, metrics_summary, organization_id } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Load AI settings from DB
    let aiModel = "google/gemini-3-flash-preview";
    let aiTemperature = 0.5;
    let customPrompt: string | null = null;
    let responseMode = "detailed";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (supabaseUrl && supabaseKey) {
      try {
        const sb = createClient(supabaseUrl, supabaseKey);
        // Try to find organization_id from the request or by ad_account_id
        let orgId = organization_id;
        if (!orgId && ad_account_id) {
          const { data: acc } = await sb
            .from("ad_accounts")
            .select("organization_id")
            .eq("ad_account_id", ad_account_id)
            .limit(1)
            .single();
          orgId = acc?.organization_id;
        }

        if (orgId) {
          const { data: settings } = await sb
            .from("traffic_settings")
            .select("ai_model, ai_system_prompt, ai_temperature, ai_response_mode")
            .eq("organization_id", orgId)
            .single();
          if (settings) {
            aiModel = settings.ai_model || aiModel;
            aiTemperature = Number(settings.ai_temperature) || aiTemperature;
            customPrompt = settings.ai_system_prompt || null;
            responseMode = settings.ai_response_mode || responseMode;
          }
        }
      } catch (e) {
        console.warn("Failed to load AI settings, using defaults:", e);
      }
    }

    const campaignsJson = campaigns_data
      ? JSON.stringify(campaigns_data, null, 2).slice(0, 8000)
      : "Nenhuma campanha disponível";
    const metricsJson = metrics_summary
      ? JSON.stringify(metrics_summary, null, 2)
      : "Métricas não disponíveis";

    const responseModeInstruction = responseMode === "summary"
      ? "\n- Seja conciso e direto, use bullet points curtos"
      : responseMode === "technical"
      ? "\n- Use linguagem técnica avançada, inclua fórmulas e benchmarks do setor"
      : "\n- Forneça análises detalhadas e aprofundadas";

    const basePrompt = customPrompt || DEFAULT_PROMPT;

    const systemPrompt = `${basePrompt}
${responseModeInstruction}

CONTEXTO DA CONTA:
- Nome da conta: ${account_name || "N/A"}
- ID da conta: ${ad_account_id || "N/A"}

CAMPANHAS ATUAIS:
${campaignsJson}

MÉTRICAS AGREGADAS DO PERÍODO:
${metricsJson}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: "system", content: systemPrompt },
          ...(messages || []),
        ],
        stream: true,
        temperature: aiTemperature,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "Erro ao conectar com a IA." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-traffic-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
