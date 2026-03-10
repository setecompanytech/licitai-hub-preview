import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // GET = webhook verification (Evolution API / Z-API pattern)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const challenge = url.searchParams.get("hub.challenge");
    if (challenge) {
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }
    return new Response("OK", { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body).slice(0, 500));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Normalize payload from different providers
    const message = normalizeMessage(body);
    if (!message) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Normalized message:", JSON.stringify(message));

    // Find user by phone number (match against whatsapp_preferencias)
    const { data: prefs } = await supabase
      .from("whatsapp_preferencias")
      .select("user_id, telefone, telefone_licitacoes, telefone_juridico, telefone_financeiro, telefone_documentos")
      .eq("ativo", true);

    if (!prefs || prefs.length === 0) {
      console.log("No active WhatsApp preferences found");
      return new Response(JSON.stringify({ ok: true, no_users: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Match the destination number to a user
    const matchedPref = prefs.find((p: any) => {
      const numbers = [
        p.telefone,
        p.telefone_licitacoes,
        p.telefone_juridico,
        p.telefone_financeiro,
        p.telefone_documentos,
      ].filter(Boolean);
      return numbers.some((n: string) => message.to.includes(n) || n.includes(message.to));
    });

    if (!matchedPref) {
      console.log("No matching user for destination:", message.to);
      return new Response(JSON.stringify({ ok: true, no_match: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = matchedPref.user_id;

    // Get routing config
    const { data: routingConfig } = await supabase
      .from("whatsapp_roteamento_config")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // Classify the message sector using AI
    const classification = await classifyMessage(message.content);
    console.log("AI Classification:", JSON.stringify(classification));

    // Find or create conversation
    const { data: existingConv } = await supabase
      .from("whatsapp_conversas")
      .select("*")
      .eq("user_id", userId)
      .eq("contato_telefone", message.from)
      .maybeSingle();

    let conversaId: string;

    if (existingConv) {
      conversaId = existingConv.id;
      await supabase
        .from("whatsapp_conversas")
        .update({
          ultima_mensagem: message.content,
          ultima_mensagem_at: new Date().toISOString(),
          setor: classification.setor,
          classificacao_ia: classification.setor,
          auto_roteada: true,
        })
        .eq("id", conversaId);
    } else {
      const { data: newConv } = await supabase
        .from("whatsapp_conversas")
        .insert({
          user_id: userId,
          contato_nome: message.senderName || message.from,
          contato_telefone: message.from,
          setor: classification.setor,
          ultima_mensagem: message.content,
          ultima_mensagem_at: new Date().toISOString(),
          provider_chat_id: message.chatId,
          classificacao_ia: classification.setor,
          auto_roteada: true,
        })
        .select("id")
        .single();
      conversaId = newConv!.id;
    }

    // Save the incoming message
    const { data: savedMsg } = await supabase
      .from("whatsapp_mensagens")
      .insert({
        user_id: userId,
        conversa_id: conversaId,
        direcao: "entrada",
        conteudo: message.content,
        status: "recebido",
        setor_classificado: classification.setor,
        confianca_classificacao: classification.confianca,
        provider_message_id: message.messageId,
      })
      .select("id")
      .single();

    // Log the routing
    await supabase.from("whatsapp_roteamento_log").insert({
      user_id: userId,
      conversa_id: conversaId,
      mensagem_id: savedMsg?.id,
      setor_destino: classification.setor,
      confianca: classification.confianca,
      motivo: classification.motivo,
      acao: "classificacao",
    });

    // Auto-respond if enabled
    let autoReplyContent: string | null = null;

    if (routingConfig?.resposta_automatica && routingConfig?.ativo) {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const currentTime = hour * 60 + minute;
      const dayOfWeek = now.getDay();

      const [startH, startM] = (routingConfig.horario_inicio || "08:00").split(":").map(Number);
      const [endH, endM] = (routingConfig.horario_fim || "18:00").split(":").map(Number);
      const startTime = startH * 60 + startM;
      const endTime = endH * 60 + endM;
      const workDays: number[] = routingConfig.dias_semana || [1, 2, 3, 4, 5];

      const isWorkingHours = workDays.includes(dayOfWeek) && currentTime >= startTime && currentTime <= endTime;

      if (isWorkingHours) {
        // Generate AI auto-response
        autoReplyContent = await generateAutoReply(
          message.content,
          classification.setor,
          message.senderName || "Cliente"
        );
      } else {
        autoReplyContent = routingConfig.mensagem_fora_horario ||
          "Olá! No momento estamos fora do horário de atendimento. Sua mensagem foi registrada e será respondida em breve.";
      }

      if (autoReplyContent) {
        // Save auto-reply message
        await supabase.from("whatsapp_mensagens").insert({
          user_id: userId,
          conversa_id: conversaId,
          direcao: "saida",
          conteudo: autoReplyContent,
          status: routingConfig.provider_url ? "pendente_envio" : "simulado",
          auto_resposta: true,
          setor_classificado: classification.setor,
        });

        // If provider is configured, send the actual message
        if (routingConfig.provider_url && routingConfig.provider_api_key_id) {
          try {
            await sendViaProvider(
              routingConfig.provider,
              routingConfig.provider_url,
              routingConfig.provider_instance || "",
              routingConfig.provider_api_key_id,
              message.from,
              autoReplyContent
            );
          } catch (err) {
            console.error("Failed to send via provider:", err);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        conversa_id: conversaId,
        setor: classification.setor,
        confianca: classification.confianca,
        auto_reply_sent: !!autoReplyContent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Normalize messages from different providers ──

interface NormalizedMessage {
  from: string;
  to: string;
  content: string;
  senderName: string | null;
  messageId: string | null;
  chatId: string | null;
  type: string;
}

function normalizeMessage(body: any): NormalizedMessage | null {
  // Evolution API format
  if (body.data?.key?.remoteJid) {
    const msg = body.data;
    const content =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      "[mídia]";
    if (msg.key.fromMe) return null; // Skip own messages
    return {
      from: msg.key.remoteJid.replace("@s.whatsapp.net", ""),
      to: body.instance || "",
      content,
      senderName: msg.pushName || null,
      messageId: msg.key.id || null,
      chatId: msg.key.remoteJid,
      type: "text",
    };
  }

  // Z-API format
  if (body.phone && body.text?.message) {
    if (body.fromMe) return null;
    return {
      from: body.phone.replace(/\D/g, ""),
      to: body.connectedPhone || "",
      content: body.text.message,
      senderName: body.senderName || null,
      messageId: body.messageId || null,
      chatId: body.chatId || null,
      type: "text",
    };
  }

  // Twilio format
  if (body.From && body.Body) {
    return {
      from: body.From.replace("whatsapp:", "").replace("+", ""),
      to: body.To?.replace("whatsapp:", "").replace("+", "") || "",
      content: body.Body,
      senderName: body.ProfileName || null,
      messageId: body.MessageSid || null,
      chatId: body.From || null,
      type: "text",
    };
  }

  // Generic / test format
  if (body.from && body.message) {
    return {
      from: body.from.replace(/\D/g, ""),
      to: body.to || "",
      content: body.message,
      senderName: body.name || null,
      messageId: body.id || null,
      chatId: body.chat_id || null,
      type: "text",
    };
  }

  console.log("Unknown message format, skipping");
  return null;
}

// ── AI Classification ──

async function classifyMessage(content: string): Promise<{
  setor: string;
  confianca: number;
  motivo: string;
}> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.warn("LOVABLE_API_KEY not set, defaulting to licitações");
    return { setor: "licitações", confianca: 0.5, motivo: "IA indisponível - setor padrão" };
  }

  try {
    const response = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Você é um classificador de mensagens de WhatsApp para uma empresa de licitações públicas.
Classifique a mensagem recebida em UM dos setores: licitações, jurídico, financeiro, documentos.

Critérios:
- licitações: editais, pregão, disputa, proposta, certame, compras públicas, portal, lance
- jurídico: recurso, impugnação, mandado, contrato, advogado, processo, prazo legal, defesa
- financeiro: pagamento, empenho, nota fiscal, garantia, caução, faturamento, banco, boleto
- documentos: certidão, atestado, alvará, registro, habilitação, CND, documentação, vencimento`,
          },
          {
            role: "user",
            content: `Classifique esta mensagem: "${content}"`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classificar_setor",
              description: "Classifica a mensagem em um setor",
              parameters: {
                type: "object",
                properties: {
                  setor: {
                    type: "string",
                    enum: ["licitações", "jurídico", "financeiro", "documentos"],
                  },
                  confianca: {
                    type: "number",
                    description: "Confiança da classificação de 0 a 1",
                  },
                  motivo: {
                    type: "string",
                    description: "Breve motivo da classificação",
                  },
                },
                required: ["setor", "confianca", "motivo"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classificar_setor" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI classification error:", response.status, errorText);
      return { setor: "licitações", confianca: 0.3, motivo: "Erro na IA - setor padrão" };
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      return JSON.parse(toolCall.function.arguments);
    }

    return { setor: "licitações", confianca: 0.3, motivo: "Resposta IA inválida - setor padrão" };
  } catch (err) {
    console.error("Classification error:", err);
    return { setor: "licitações", confianca: 0.3, motivo: "Exceção na IA - setor padrão" };
  }
}

// ── AI Auto-Reply ──

async function generateAutoReply(
  incomingMessage: string,
  setor: string,
  senderName: string
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return `Olá ${senderName}! Recebi sua mensagem. Ela foi encaminhada ao setor de ${setor}. Retornaremos em breve!`;
  }

  try {
    const response = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Você é um assistente de atendimento profissional de uma empresa de licitações.
Gere uma resposta automática curta (máximo 3 frases) e cordial para o WhatsApp.
A mensagem foi classificada como pertencente ao setor: ${setor}.
Informe que a mensagem foi recebida e encaminhada ao setor responsável.
Use tom profissional mas acolhedor. NÃO faça perguntas. Apenas confirme o recebimento.
Use emojis com moderação (máximo 2).`,
          },
          {
            role: "user",
            content: `Nome do remetente: ${senderName}\nMensagem recebida: ${incomingMessage}\n\nGere a resposta automática:`,
          },
        ],
      }),
    });

    if (!response.ok) {
      await response.text();
      return `Olá ${senderName}! ✅ Sua mensagem foi recebida e encaminhada ao setor de ${setor}. Retornaremos em breve!`;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 
      `Olá ${senderName}! ✅ Sua mensagem foi recebida e encaminhada ao setor de ${setor}. Retornaremos em breve!`;
  } catch {
    return `Olá ${senderName}! ✅ Sua mensagem foi recebida e encaminhada ao setor de ${setor}. Retornaremos em breve!`;
  }
}

// ── Send via Provider ──

async function sendViaProvider(
  provider: string,
  baseUrl: string,
  instance: string,
  apiKey: string,
  to: string,
  message: string
): Promise<void> {
  let url: string;
  let headers: Record<string, string>;
  let body: string;

  switch (provider) {
    case "evolution":
      url = `${baseUrl}/message/sendText/${instance}`;
      headers = { "Content-Type": "application/json", apikey: apiKey };
      body = JSON.stringify({ number: to, text: message });
      break;

    case "zapi":
      url = `${baseUrl}/send-text`;
      headers = { "Content-Type": "application/json", "Client-Token": apiKey };
      body = JSON.stringify({ phone: to, message });
      break;

    case "twilio":
      url = baseUrl;
      headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(apiKey)}`,
      };
      body = `To=whatsapp:+${to}&From=whatsapp:+${instance}&Body=${encodeURIComponent(message)}`;
      break;

    default:
      console.log(`Unknown provider: ${provider}, skipping send`);
      return;
  }

  const response = await fetch(url, { method: "POST", headers, body });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Provider ${provider} error [${response.status}]: ${text}`);
  }
  await response.text(); // consume body
}
