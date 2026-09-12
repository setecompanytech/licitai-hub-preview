// Alertas escalonados de reajuste contratual (12/09).
//
// A régua do interregno anual (Lei 10.192/2001, arts. 2º-3º) era passiva —
// só avisava quem abrisse a página do contrato. Este cron diário dispara nos
// marcos 90/60/30/7/0 dias antes do aniversário da data-base e, depois de
// devido, um lembrete por mês. Dois canais: alerta no sistema (alertas_gerados,
// por membro da empresa) e e-mail digest por empresa aos destinatários de
// alertas já cadastrados (a mesma lista das certidões). Dedupe permanente por
// (contrato, marco) em contratos_reajuste_alertas_log.
//
// O marco da contagem anda: data-base da cláusula ou o último aditivo de
// reajuste/repactuação registrado — a mesma regra da lib do front.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { autorizadoComoCron, respostaNaoAutorizado } from "../_shared/cron-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Espelho Deno de lib/contratos/reajuste.somarMeses (fim de mês preso). */
function somarMeses(dataIso: string, meses: number): string {
  const [a, m, d] = dataIso.slice(0, 10).split("-").map(Number);
  const alvoMes = m - 1 + meses;
  const ano = a + Math.floor(alvoMes / 12);
  const mes = ((alvoMes % 12) + 12) % 12;
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const dia = Math.min(d, ultimoDia);
  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

const TIPOS_REAJUSTE = /reajust|repactua/i;
const MARCOS_ANTES = [90, 60, 30, 7, 0];

const dataBr = (iso: string) => iso.split("-").reverse().join("/");

const diffDias = (deIso: string, ateIso: string): number =>
  Math.round((Date.parse(ateIso + "T00:00:00Z") - Date.parse(deIso + "T00:00:00Z")) / 86_400_000);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!autorizadoComoCron(req)) return respostaNaoAutorizado(corsHeaders);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const hoje = new Date().toISOString().slice(0, 10);

    const { data: contratos, error } = await supabase
      .from("contratos")
      .select("id, empresa_id, numero_contrato, orgao_contratante, indice_reajuste, data_base_reajuste, valor_global, status")
      .eq("status", "vigente")
      .not("data_base_reajuste", "is", null);
    if (error) throw error;
    if (!contratos?.length) {
      return new Response(JSON.stringify({ message: "sem contratos com data-base", disparos: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ids = contratos.map((c) => c.id);
    const { data: aditivos } = await supabase
      .from("contrato_aditivos")
      .select("contrato_id, tipo, data_assinatura, data_base_reajuste")
      .in("contrato_id", ids);

    type Disparo = {
      contrato: typeof contratos[number];
      aniversario: string;
      marcoTag: string;
      rotulo: string;
      urgente: boolean;
    };
    const disparos: Disparo[] = [];

    for (const c of contratos) {
      const base = String(c.data_base_reajuste).slice(0, 10);
      const registrados = (aditivos ?? [])
        .filter((a) => a.contrato_id === c.id && TIPOS_REAJUSTE.test(String(a.tipo || "")))
        .map((a) => (a.data_base_reajuste ?? a.data_assinatura))
        .filter((d): d is string => !!d)
        .map((d) => d.slice(0, 10))
        .sort();
      const ultimo = registrados.length ? registrados[registrados.length - 1] : null;
      const marco = ultimo && ultimo > base ? ultimo : base;
      const aniversario = somarMeses(marco, 12);
      const dias = diffDias(hoje, aniversario); // >0 falta; <=0 devido

      if (dias > 0) {
        if (MARCOS_ANTES.includes(dias)) {
          disparos.push({
            contrato: c, aniversario,
            marcoTag: `${aniversario}:${dias}d`,
            rotulo: dias === 0 ? "aniversário HOJE" : `faltam ${dias} dias`,
            urgente: dias <= 7,
          });
        }
      } else if (dias === 0) {
        disparos.push({
          contrato: c, aniversario,
          marcoTag: `${aniversario}:0d`,
          rotulo: "aniversário HOJE — reajuste devido",
          urgente: true,
        });
      } else {
        // Devido: um lembrete por mês-calendário, até o reajuste ser registrado
        // (o registro move o marco e zera a régua).
        disparos.push({
          contrato: c, aniversario,
          marcoTag: `${aniversario}:devido-${hoje.slice(0, 7)}`,
          rotulo: `devido desde ${dataBr(aniversario)} (${Math.floor(-dias / 30)} mês(es))`,
          urgente: true,
        });
      }
    }

    // Dedupe permanente: um disparo por (contrato, marco).
    const novos: Disparo[] = [];
    for (const d of disparos) {
      const { data: ja } = await supabase
        .from("contratos_reajuste_alertas_log")
        .select("id").eq("contrato_id", d.contrato.id).eq("marco_tag", d.marcoTag).maybeSingle();
      if (!ja) novos.push(d);
    }

    let alertasSistema = 0, emails = 0;
    const erros: string[] = [];

    // Agrupa por empresa: um e-mail digest por empresa por dia.
    const porEmpresa = new Map<string, Disparo[]>();
    for (const d of novos) {
      porEmpresa.set(d.contrato.empresa_id, [...(porEmpresa.get(d.contrato.empresa_id) ?? []), d]);
    }

    for (const [empresaId, lista] of porEmpresa) {
      // Canal 1 — alerta no sistema, para cada membro da empresa.
      const { data: membros } = await supabase
        .from("empresa_membros").select("user_id").eq("empresa_id", empresaId);
      for (const d of lista) {
        for (const m of membros ?? []) {
          const { error: insErr } = await supabase.from("alertas_gerados").insert({
            user_id: m.user_id,
            tipo: "reajuste",
            titulo: `Reajuste do contrato ${d.contrato.numero_contrato ?? ""} — ${d.rotulo}`,
            descricao: `${d.contrato.orgao_contratante ?? ""} · índice ${d.contrato.indice_reajuste ?? "não registrado"} · aniversário ${dataBr(d.aniversario)}. Peça o reajuste ANTES de assinar qualquer aditivo (preclusão lógica) — aplicação por apostila, art. 136, I da Lei 14.133/2021.`,
            orgao: d.contrato.orgao_contratante ?? null,
            uf: null,
            fonte: "CONTRATOS",
            urgente: d.urgente,
          });
          if (!insErr) alertasSistema++;
        }
      }

      // Canal 2 — e-mail digest aos destinatários de alertas da empresa.
      const { data: dest } = await supabase
        .from("documentos_alertas_destinatarios")
        .select("email, nome").eq("empresa_id", empresaId).eq("ativo", true);
      for (const destinatario of dest ?? []) {
        const { error: envioErr } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "reajuste-contratual",
            recipientEmail: destinatario.email,
            idempotencyKey: `reajuste-${empresaId}-${destinatario.email}-${hoje}`,
            templateData: {
              nome: destinatario.nome ?? null,
              data: dataBr(hoje),
              contratos: lista.map((d) => ({
                numero: d.contrato.numero_contrato ?? "—",
                orgao: d.contrato.orgao_contratante ?? "—",
                indice: d.contrato.indice_reajuste ?? "não registrado",
                aniversario: dataBr(d.aniversario),
                situacao: d.rotulo,
                urgente: d.urgente,
              })),
            },
          },
        });
        if (envioErr) erros.push(`email ${destinatario.email}: ${envioErr.message}`);
        else emails++;
      }

      // Log do dedupe — depois dos envios, um por (contrato, marco).
      for (const d of lista) {
        await supabase.from("contratos_reajuste_alertas_log").insert({
          contrato_id: d.contrato.id,
          marco_tag: d.marcoTag,
          destinatarios: (dest ?? []).length,
        });
      }
    }

    return new Response(JSON.stringify({
      contratos_vigiados: contratos.length,
      disparos_novos: novos.length,
      alertas_sistema: alertasSistema,
      emails,
      erros,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("alertas-reajuste:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
