// SEFAZ — Consulta automática por CNPJ via certificado A1
// Fase 2 da importação de notas: substitui upload manual por consulta direta.
//
// Estratégia:
// - NF-e (mod 55, entrada/saída): SEFAZ Nacional — NFeDistribuicaoDFe (web service único nacional).
// - NFS-e: roteamento por município (codigo_ibge) usando o catálogo `sefaz_homologacoes_municipais`.
//
// Pré-requisitos para chamada real:
// - Certificado A1 (.pfx) do CNPJ consultante carregado em Storage (bucket `certificados`) + senha cifrada.
// - Em Deno Deploy, mTLS exige um proxy externo (Lambda/VPS) — esta função delega ao endpoint
//   configurado em `SEFAZ_PROXY_URL` (secret) que executa a chamada SOAP autenticada e devolve XMLs.
//
// Modo simulação:
// - Se `SEFAZ_PROXY_URL` não estiver configurado, retorna `setup_required: true` com instruções,
//   mas registra a tentativa no log para auditoria. Isto permite testar a UI sem a infra externa pronta.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConsultaPayload {
  empresa_id: string;
  cnpj: string;
  tipo: "nfe" | "nfse";
  competencia_inicio: string; // YYYY-MM-DD
  competencia_fim: string;
  municipio_codigo?: string; // obrigatório se tipo=nfse
  ambiente?: "producao" | "homologacao";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const t0 = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Não autenticado" }, 401);
    }
    const { data: userData, error: userErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData.user) return json({ error: "Sessão inválida" }, 401);
    const userId = userData.user.id;

    const payload = (await req.json()) as ConsultaPayload;
    const { empresa_id, cnpj, tipo, competencia_inicio, competencia_fim, municipio_codigo, ambiente = "producao" } = payload;

    if (!empresa_id || !cnpj || !tipo || !competencia_inicio || !competencia_fim) {
      return json({ error: "Parâmetros obrigatórios faltando" }, 400);
    }
    const cnpjLimpo = cnpj.replace(/\D/g, "");
    if (cnpjLimpo.length !== 14) return json({ error: "CNPJ inválido" }, 400);

    // Verifica que o usuário é membro da empresa
    const { data: membro } = await supabase
      .from("empresa_membros")
      .select("id")
      .eq("user_id", userId)
      .eq("empresa_id", empresa_id)
      .maybeSingle();
    if (!membro) return json({ error: "Sem acesso à empresa" }, 403);

    // Para NFS-e, valida homologação do município
    let municipioInfo: any = null;
    if (tipo === "nfse") {
      if (!municipio_codigo) return json({ error: "municipio_codigo obrigatório para NFS-e" }, 400);
      const { data: mun } = await supabase
        .from("sefaz_homologacoes_municipais")
        .select("*")
        .eq("codigo_ibge", municipio_codigo)
        .maybeSingle();
      if (!mun) {
        await registrarLog(supabase, {
          empresa_id, user_id: userId, cnpj: cnpjLimpo, tipo, municipio_codigo,
          competencia_inicio, competencia_fim, status: "nao_configurado",
          erro_mensagem: "Município não cadastrado no catálogo de homologações",
          duracao_ms: Date.now() - t0,
        });
        return json({
          error: "Município não suportado",
          message: "Este município ainda não está homologado. Use o upload manual de XMLs ou solicite homologação.",
          setup_required: true,
        }, 200);
      }
      municipioInfo = mun;
      if (mun.status === "pendente" || mun.status === "indisponivel") {
        await registrarLog(supabase, {
          empresa_id, user_id: userId, cnpj: cnpjLimpo, tipo, municipio_codigo,
          competencia_inicio, competencia_fim, status: "nao_configurado",
          erro_mensagem: `Município com homologação ${mun.status}`,
          duracao_ms: Date.now() - t0,
        });
        return json({
          ok: false,
          setup_required: true,
          message: `Homologação ${mun.status} para ${mun.municipio}/${mun.uf}. Use upload manual enquanto isso.`,
          municipio: mun,
        }, 200);
      }
    }

    // Verifica se há certificado A1 ativo para a empresa
    const { data: cert } = await supabase
      .from("cert_upload_tokens")
      .select("cert_file_path, used_at")
      .eq("empresa_id", empresa_id)
      .not("used_at", "is", null)
      .order("used_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cert?.cert_file_path) {
      await registrarLog(supabase, {
        empresa_id, user_id: userId, cnpj: cnpjLimpo, tipo, municipio_codigo,
        competencia_inicio, competencia_fim, status: "nao_configurado",
        erro_mensagem: "Certificado A1 não enviado para esta empresa",
        duracao_ms: Date.now() - t0,
      });
      return json({
        ok: false,
        setup_required: true,
        message: "Nenhum certificado A1 enviado. Cadastre o certificado digital da empresa antes de consultar a SEFAZ.",
      }, 200);
    }

    // Proxy SEFAZ (mTLS A1 não roda em Deno Deploy diretamente)
    const SEFAZ_PROXY_URL = Deno.env.get("SEFAZ_PROXY_URL");
    const SEFAZ_PROXY_TOKEN = Deno.env.get("SEFAZ_PROXY_TOKEN");

    if (!SEFAZ_PROXY_URL) {
      await registrarLog(supabase, {
        empresa_id, user_id: userId, cnpj: cnpjLimpo, tipo, municipio_codigo,
        competencia_inicio, competencia_fim, status: "nao_configurado",
        erro_mensagem: "SEFAZ_PROXY_URL não configurado",
        duracao_ms: Date.now() - t0,
      });
      return json({
        ok: false,
        setup_required: true,
        message: "Integração SEFAZ A1 requer um proxy externo (mTLS). Configure SEFAZ_PROXY_URL e SEFAZ_PROXY_TOKEN nas configurações de Lovable Cloud, ou continue com upload manual de XMLs.",
        proxy_setup: {
          required_secrets: ["SEFAZ_PROXY_URL", "SEFAZ_PROXY_TOKEN"],
          proxy_endpoint_spec: "POST {SEFAZ_PROXY_URL} { cnpj, tipo, competencia_inicio, competencia_fim, municipio_codigo?, cert_path, ambiente } → { xmls: string[] }",
          municipio: municipioInfo,
        },
      }, 200);
    }

    // Chamada real ao proxy (que tem acesso ao certificado e SEFAZ via mTLS)
    const proxyResp = await fetch(SEFAZ_PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SEFAZ_PROXY_TOKEN ?? ""}`,
      },
      body: JSON.stringify({
        cnpj: cnpjLimpo,
        tipo,
        competencia_inicio,
        competencia_fim,
        municipio_codigo,
        cert_path: cert.cert_file_path,
        padrao_nfse: municipioInfo?.padrao_nfse,
        endpoint: ambiente === "producao" ? municipioInfo?.endpoint_producao : municipioInfo?.endpoint_homologacao,
        ambiente,
      }),
    });

    if (!proxyResp.ok) {
      const erroBody = await proxyResp.text();
      await registrarLog(supabase, {
        empresa_id, user_id: userId, cnpj: cnpjLimpo, tipo, municipio_codigo,
        competencia_inicio, competencia_fim, status: "erro",
        erro_mensagem: `Proxy SEFAZ retornou ${proxyResp.status}: ${erroBody.slice(0, 500)}`,
        duracao_ms: Date.now() - t0,
      });
      return json({ error: "Erro no proxy SEFAZ", status: proxyResp.status, details: erroBody }, 502);
    }

    const { xmls = [] } = (await proxyResp.json()) as { xmls: string[] };

    // Encaminha cada XML para a função de importação existente (reuso!)
    let importadas = 0, duplicadas = 0, erros = 0;
    for (const xml of xmls) {
      try {
        const { data: impResp, error: impErr } = await supabase.functions.invoke("importar-notas-fiscais", {
          body: { empresa_id, xml_content: xml, origem: "sefaz_a1" },
          headers: { Authorization: authHeader },
        });
        if (impErr) { erros++; continue; }
        const r = (impResp as any)?.resultado;
        if (r?.status === "processada") importadas++;
        else if (r?.status === "duplicada") duplicadas++;
        else erros++;
      } catch {
        erros++;
      }
    }

    const duracao_ms = Date.now() - t0;
    const status = erros === 0 ? "sucesso" : (importadas > 0 ? "parcial" : "erro");

    await registrarLog(supabase, {
      empresa_id, user_id: userId, cnpj: cnpjLimpo, tipo, municipio_codigo,
      competencia_inicio, competencia_fim, status,
      notas_encontradas: xmls.length,
      notas_importadas: importadas,
      notas_duplicadas: duplicadas,
      duracao_ms,
      detalhes: { erros },
    });

    return json({
      ok: true,
      status,
      total: xmls.length,
      importadas,
      duplicadas,
      erros,
      duracao_ms,
    });
  } catch (e) {
    console.error("[sefaz-consulta-cnpj] erro:", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function registrarLog(supabase: any, row: Record<string, unknown>) {
  try {
    await supabase.from("sefaz_consultas_log").insert(row);
  } catch (e) {
    console.error("Falha ao registrar log:", e);
  }
}
