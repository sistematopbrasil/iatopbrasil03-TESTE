const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, account_name, ad_account_id, campaigns_data, metrics_summary } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build system prompt with full account context
    const campaignsJson = campaigns_data
      ? JSON.stringify(campaigns_data, null, 2).slice(0, 8000)
      : "Nenhuma campanha disponível";
    const metricsJson = metrics_summary
      ? JSON.stringify(metrics_summary, null, 2)
      : "Métricas não disponíveis";

    const systemPrompt = `Você é um especialista sênior em Meta Ads (Facebook e Instagram Ads), com profundo conhecimento em estratégias de performance, otimização de campanhas e análise de métricas.

CONTEXTO DA CONTA:
- Nome da conta: ${account_name || "N/A"}
- ID da conta: ${ad_account_id || "N/A"}

CAMPANHAS ATUAIS:
${campaignsJson}

MÉTRICAS AGREGADAS DO PERÍODO:
${metricsJson}

INSTRUÇÕES:
- Responda SEMPRE em português brasileiro
- Seja preciso e use os dados reais fornecidos acima
- Ao analisar campanhas, cite nomes e métricas específicas
- Ao sugerir otimizações, explique o raciocínio com base nos dados
- Quando criar briefings de novas campanhas, seja detalhado: objetivo, público-alvo, orçamento sugerido, posicionamentos recomendados, tipos de criativo
- Use formatação markdown para listas e destaques
- Se algum dado estiver ausente, informe e sugira como obtê-lo
- Identifique oportunidades e problemas proativamente nos dados fornecidos`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...(messages || []),
        ],
        stream: true,
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
