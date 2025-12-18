import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Não autorizado");
    }

    const { instanceId } = await req.json();

    if (!instanceId) {
      throw new Error("ID da instância é obrigatório");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Buscar instância
    const { data: instance, error: fetchError } = await supabaseAdmin
      .from("whatsapp_instances")
      .select("*")
      .eq("id", instanceId)
      .single();

    if (fetchError || !instance) {
      throw new Error("Instância não encontrada");
    }

    console.log(`Desconectando instância: ${instance.instance_name}`);

    // Desconectar na Evolution API
    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");

    if (evolutionApiUrl && evolutionApiKey) {
      try {
        const logoutResponse = await fetch(
          `${evolutionApiUrl}/instance/logout/${instance.instance_name}`,
          {
            method: "DELETE",
            headers: {
              "apikey": evolutionApiKey,
            },
          }
        );

        console.log(`Evolution API logout response: ${logoutResponse.status}`);
      } catch (apiError) {
        console.error("Erro ao chamar Evolution API:", apiError);
        // Continue even if Evolution API fails
      }
    }

    // Atualizar status no banco
    const { error: updateError } = await supabaseAdmin
      .from("whatsapp_instances")
      .update({
        status: "disconnected",
        qr_code: null,
        phone_number: null,
        last_connected_at: null,
      })
      .eq("id", instanceId);

    if (updateError) {
      throw new Error("Erro ao atualizar status da instância");
    }

    console.log(`Instância ${instance.instance_name} desconectada com sucesso`);

    return new Response(
      JSON.stringify({ success: true, message: "WhatsApp desconectado com sucesso" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Erro ao desconectar:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro ao desconectar WhatsApp" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
