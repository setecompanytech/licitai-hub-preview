// Alertas de vencimento de documentos — disparo diário por e-mail.
//
// Regras (espelham a lib de lembretes do front, src/lib/documentos/lembretes):
// - dias contados por DATA em UTC (hora não entra, fuso não desloca);
// - janela = antecedencia_dias da config da empresa (padrão 30);
// - VENCIDO dispara TODO dia até o documento ser renovado; antes do
//   vencimento, dispara nos marcos (antecedência, 15, 7, 3, 2, 1, 0) para
//   avisar sem virar ruído que se aprende a ignorar;
// - dedupe: no máximo 1 e-mail por destinatário por dia (trilha no log);
// - a CESSAÇÃO é estrutural: upload da renovação atualiza documentos.validade,
//   o doc sai da janela e deixa de entrar no digest — nada a "detectar".
//
// WhatsApp: aguarda contratação de provedor (Meta/Twilio) — a coluna
// destinatarios.whatsapp está reservada; este worker só envia e-mail.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function diasAteVencer(validade: string, hoje: Date): number | null {
  const m = String(validade).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const alvo = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const base = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  return Math.round((alvo - base) / 86400000);
}

const fmtBr = (iso: string) => {
  const m = String(iso).match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const cronSecret = Deno.env.get("CRON_SECRET");
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!cronSecret || token !== cronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const hoje = new Date();
    const hojeInicio = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate())).toISOString();

    const { data: configs, error: cfgErr } = await supabase
      .from("documentos_alertas_config")
      .select("empresa_id, antecedencia_dias")
      .eq("ativo", true);
    if (cfgErr) throw cfgErr;

    const resultado = { empresas: 0, emails: 0, pulados: 0, erros: [] as string[] };

    for (const cfg of configs ?? []) {
      const antecedencia = Number(cfg.antecedencia_dias) || 30;
      const marcos = new Set([antecedencia, 15, 7, 3, 2, 1, 0]);

      const [{ data: dest }, { data: docs }, { data: empresa }] = await Promise.all([
        supabase.from("documentos_alertas_destinatarios")
          .select("nome, email").eq("empresa_id", cfg.empresa_id).eq("ativo", true),
        supabase.from("documentos")
          .select("id, nome, validade").eq("empresa_id", cfg.empresa_id).not("validade", "is", null),
        supabase.from("empresas").select("razao_social, nome_fantasia").eq("id", cfg.empresa_id).maybeSingle(),
      ]);
      if (!dest?.length || !docs?.length) continue;

      const naJanela = docs
        .map((d) => ({ ...d, dias: diasAteVencer(d.validade as string, hoje) }))
        .filter((d): d is typeof d & { dias: number } => d.dias !== null && d.dias <= antecedencia)
        .sort((a, b) => a.dias - b.dias);
      if (naJanela.length === 0) continue; // tudo em dia — alertas cessados

      const temVencido = naJanela.some((d) => d.dias < 0);
      const bateMarco = naJanela.some((d) => marcos.has(d.dias));
      if (!temVencido && !bateMarco) { resultado.pulados++; continue; }

      const empresaNome = (empresa as { razao_social?: string; nome_fantasia?: string } | null)?.razao_social
        ?? (empresa as { nome_fantasia?: string } | null)?.nome_fantasia ?? "";
      const docsPayload = naJanela.map((d) => ({
        nome: d.nome, validade: fmtBr(d.validade as string), dias: d.dias,
      }));
      const vencidos = naJanela.filter((d) => d.dias < 0).length;
      resultado.empresas++;

      for (const destinatario of dest) {
        // Dedupe: 1 disparo por destinatário por dia.
        const { data: ja } = await supabase
          .from("documentos_alertas_log")
          .select("id")
          .eq("empresa_id", cfg.empresa_id)
          .eq("destinatario_email", destinatario.email)
          .gte("enviado_em", hojeInicio)
          .limit(1)
          .maybeSingle();
        if (ja) { resultado.pulados++; continue; }

        const { error: envioErr } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "vencimento-documentos",
            recipientEmail: destinatario.email,
            templateData: {
              destinatarioNome: destinatario.nome,
              empresaNome,
              docs: docsPayload,
              ctaUrl: "https://praefectus.com.br/documentos",
            },
          },
        });
        if (envioErr) {
          resultado.erros.push(`${destinatario.email}: ${envioErr.message}`);
          continue;
        }

        await supabase.from("documentos_alertas_log").insert({
          empresa_id: cfg.empresa_id,
          destinatario_email: destinatario.email,
          docs_no_digest: naJanela.length,
          vencidos,
          dias_mais_critico: naJanela[0].dias,
        });
        resultado.emails++;
      }
    }

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("alertas-documentos:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
