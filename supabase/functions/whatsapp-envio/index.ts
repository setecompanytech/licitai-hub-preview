import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface WhatsAppRequest {
  telefone: string;
  setor: string;
  user_id: string;
  tipo?: "teste" | "alerta";
  mensagem_custom?: string;
}

const MENSAGENS_TESTE: Record<string, string> = {
  licitações: "🔔 [TESTE] Nova licitação detectada: Pregão Eletrônico nº 023/2026 - Prefeitura de Belém. Valor estimado: R$ 1.250.000,00. Prazo: 10/03/2026.",
  jurídico: "⚖️ [TESTE] Prazo de recurso expirando: Impugnação ao Edital PE 015/2026 - SEDUC/PA. Vencimento em 48h. Ação necessária.",
  financeiro: "💰 [TESTE] Empenho confirmado: Nota de Empenho nº 2026NE000345 - R$ 89.500,00 referente ao Contrato 012/2026. Pagamento previsto: 15/03/2026.",
  documentos: "📄 [TESTE] Certidão vencendo: CND Federal expira em 5 dias (01/03/2026). Providencie a renovação para manter habilitação ativa.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check — extract user_id from JWT, never from body
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user_id = user.id;

    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { telefone, setor, tipo = "alerta", mensagem_custom }: Omit<WhatsAppRequest, 'user_id'> = await req.json();

    if (!telefone || !setor) {
      return new Response(
        JSON.stringify({ error: "telefone e setor são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mensagem = mensagem_custom || MENSAGENS_TESTE[setor] || `📢 [TESTE] Notificação do setor ${setor}`;

    // SIMULATED SEND — replace this block with real API call (Z-API, Evolution, Twilio)
    // Example with Z-API:
    // const zapiResponse = await fetch(`https://api.z-api.io/instances/YOUR_INSTANCE/token/YOUR_TOKEN/send-text`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ phone: `55${telefone}`, message: mensagem }),
    // });

    console.log(`[SIMULADO] WhatsApp para ${telefone} | Setor: ${setor} | Mensagem: ${mensagem}`);

    // Log the simulated send
    const { error: logError } = await supabase.from("whatsapp_envios").insert({
      user_id,
      telefone,
      setor,
      mensagem,
      status: "simulado",
    });

    if (logError) {
      console.error("Erro ao registrar envio:", logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode: "simulado",
        message: `Envio simulado para ${telefone} no setor ${setor}`,
        telefone,
        setor,
        mensagem,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro no envio WhatsApp:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
