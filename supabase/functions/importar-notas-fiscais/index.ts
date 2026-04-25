// Importação de XMLs NF-e (mod 55) e NFS-e (padrão ABRASF)
// Cria lançamentos financeiros automaticamente e marca apurações como desatualizadas (via trigger)
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.5.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface NotaParseada {
  tipo: "nfe" | "nfse";
  direcao: "entrada" | "saida";
  chave_acesso: string | null;
  numero: string | null;
  serie: string | null;
  data_emissao: string;
  cnpj_emitente: string | null;
  nome_emitente: string | null;
  cnpj_destinatario: string | null;
  nome_destinatario: string | null;
  valor_total: number;
  valor_servicos: number;
  valor_produtos: number;
  iss_retido: number;
  tipo_servico: "comercio" | "servico" | "outro";
}

const limparCnpj = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const num = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(",", "."));
  return isFinite(n) ? n : 0;
};
const txt = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
};

function parseDataEmissao(raw: unknown): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  const s = String(raw);
  // ISO ou yyyy-mm-dd
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // dd/mm/yyyy
  const m2 = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  return new Date().toISOString().slice(0, 10);
}

/** Tenta parsear um XML como NF-e modelo 55 */
function parseNFe(root: any, cnpjEmpresa: string): NotaParseada | null {
  // Pode vir como nfeProc > NFe > infNFe ou direto NFe > infNFe
  const nfe = root?.nfeProc?.NFe ?? root?.NFe;
  const inf = nfe?.infNFe;
  if (!inf) return null;

  const ide = inf.ide ?? {};
  const emit = inf.emit ?? {};
  const dest = inf.dest ?? {};
  const total = inf.total?.ICMSTot ?? {};

  const cnpjEmit = limparCnpj(emit.CNPJ);
  const cnpjDest = limparCnpj(dest.CNPJ ?? dest.CPF);
  const direcao: "entrada" | "saida" = cnpjEmit === cnpjEmpresa ? "saida" : "entrada";

  // Chave de acesso: vem em infNFe.@_Id no formato "NFe35..."
  const id = inf["@_Id"] ?? "";
  const chave = id.replace(/^NFe/i, "") || null;

  return {
    tipo: "nfe",
    direcao,
    chave_acesso: chave,
    numero: txt(ide.nNF),
    serie: txt(ide.serie),
    data_emissao: parseDataEmissao(ide.dhEmi ?? ide.dEmi),
    cnpj_emitente: cnpjEmit || null,
    nome_emitente: txt(emit.xNome),
    cnpj_destinatario: cnpjDest || null,
    nome_destinatario: txt(dest.xNome),
    valor_total: num(total.vNF),
    valor_produtos: num(total.vProd),
    valor_servicos: 0,
    iss_retido: num(total.vISSRet ?? inf.total?.ISSQNtot?.vISSRet),
    tipo_servico: "comercio",
  };
}

/** NFS-e padrão ABRASF (também aceita variações comuns) */
function parseNFSe(root: any, cnpjEmpresa: string): NotaParseada | null {
  // Caminhos comuns: CompNfse > Nfse > InfNfse / ConsultarNfseResposta > ListaNfse > CompNfse > Nfse > InfNfse
  const inf =
    root?.CompNfse?.Nfse?.InfNfse ??
    root?.Nfse?.InfNfse ??
    root?.ConsultarNfseResposta?.ListaNfse?.CompNfse?.Nfse?.InfNfse ??
    root?.InfNfse;
  if (!inf) return null;

  const ident = inf.IdentificacaoNfse ?? {};
  const servico = inf.Servico ?? {};
  const valores = servico.Valores ?? {};
  const prest = inf.PrestadorServico?.IdentificacaoPrestador ?? inf.Prestador ?? {};
  const tomador = inf.TomadorServico?.IdentificacaoTomador?.CpfCnpj ?? inf.Tomador?.IdentificacaoTomador?.CpfCnpj ?? {};
  const tomadorRaiz = inf.TomadorServico ?? inf.Tomador ?? {};

  const cnpjPrest = limparCnpj(prest.Cnpj ?? prest.CNPJ);
  const cnpjTom = limparCnpj(tomador.Cnpj ?? tomador.CNPJ ?? tomador.Cpf);
  const direcao: "entrada" | "saida" = cnpjPrest === cnpjEmpresa ? "saida" : "entrada";

  const valorServ = num(valores.ValorServicos);
  const valorLiq = num(valores.ValorLiquidoNfse) || valorServ;

  return {
    tipo: "nfse",
    direcao,
    chave_acesso: txt(ident.CodigoVerificacao) ?? txt(inf["@_Id"]),
    numero: txt(ident.Numero ?? inf.Numero),
    serie: txt(ident.Serie),
    data_emissao: parseDataEmissao(inf.DataEmissao),
    cnpj_emitente: cnpjPrest || null,
    nome_emitente: txt(inf.PrestadorServico?.RazaoSocial ?? inf.Prestador?.RazaoSocial),
    cnpj_destinatario: cnpjTom || null,
    nome_destinatario: txt(tomadorRaiz?.RazaoSocial),
    valor_total: valorLiq,
    valor_servicos: valorServ,
    valor_produtos: 0,
    iss_retido: num(valores.ValorIssRetido ?? valores.IssRetido),
    tipo_servico: "servico",
  };
}

function parseXml(xml: string, cnpjEmpresa: string): NotaParseada | null {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true, // remove ns2:, ns3: etc
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
  });
  const obj = parser.parse(xml);
  return parseNFe(obj, cnpjEmpresa) ?? parseNFSe(obj, cnpjEmpresa);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return json({ error: "unauthorized" }, 401);
    }
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const empresaId = String(body.empresa_id ?? "");
    const arquivos = Array.isArray(body.arquivos) ? body.arquivos : [];
    if (!empresaId || arquivos.length === 0) {
      return json({ error: "empresa_id e arquivos são obrigatórios" }, 400);
    }
    if (arquivos.length > 50) {
      return json({ error: "Máximo 50 XMLs por chamada" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verifica acesso à empresa
    const { data: membro } = await admin
      .from("empresa_membros")
      .select("user_id")
      .eq("empresa_id", empresaId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membro) return json({ error: "sem acesso a esta empresa" }, 403);

    // CNPJ da empresa para detectar direção
    const { data: emp } = await admin.from("empresas").select("cnpj").eq("id", empresaId).maybeSingle();
    const cnpjEmpresa = limparCnpj(emp?.cnpj);
    if (!cnpjEmpresa) return json({ error: "Empresa sem CNPJ cadastrado" }, 400);

    const resultados: any[] = [];
    let criadas = 0, duplicadas = 0, erros = 0;

    for (const arq of arquivos) {
      const nome = String(arq.nome ?? "arquivo.xml");
      const xml = String(arq.xml ?? "");
      if (!xml.trim()) {
        resultados.push({ nome, status: "erro", erro: "XML vazio" });
        erros++;
        continue;
      }

      let nota: NotaParseada | null = null;
      try {
        nota = parseXml(xml, cnpjEmpresa);
      } catch (e: any) {
        resultados.push({ nome, status: "erro", erro: "XML inválido: " + e.message });
        erros++;
        continue;
      }
      if (!nota) {
        resultados.push({ nome, status: "erro", erro: "Formato não reconhecido (NF-e/NFS-e)" });
        erros++;
        continue;
      }

      // Detecta duplicada por chave_acesso
      if (nota.chave_acesso) {
        const { data: dup } = await admin
          .from("financeiro_notas_importadas")
          .select("id")
          .eq("empresa_id", empresaId)
          .eq("chave_acesso", nota.chave_acesso)
          .maybeSingle();
        if (dup) {
          resultados.push({ nome, status: "duplicada", chave: nota.chave_acesso });
          duplicadas++;
          continue;
        }
      }

      const competencia = nota.data_emissao.slice(0, 7) + "-01";
      const natureza = nota.direcao === "saida" ? "receita" : "despesa";
      const tipo = natureza;
      const descricao = `${nota.tipo.toUpperCase()} ${nota.numero ?? ""}/${nota.serie ?? ""} - ${
        nota.direcao === "saida" ? nota.nome_destinatario : nota.nome_emitente
      }`.trim();

      // Cria lançamento financeiro
      const { data: lanc, error: lancErr } = await admin
        .from("financeiro_lancamentos")
        .insert({
          empresa_id: empresaId,
          tipo,
          natureza,
          status: "previsto",
          descricao,
          valor: nota.valor_total,
          data_competencia: nota.data_emissao,
          data_vencimento: nota.data_emissao,
          tipo_documento: nota.tipo,
          numero_documento: nota.numero,
          serie_documento: nota.serie,
          chave_acesso_nfe: nota.chave_acesso,
          data_emissao: nota.data_emissao,
          origem: "importacao_xml",
          origem_ref: nota.chave_acesso,
          created_by: userId,
        })
        .select("id")
        .single();

      if (lancErr) {
        resultados.push({ nome, status: "erro", erro: lancErr.message });
        erros++;
        continue;
      }

      // Registra a nota
      const { error: notaErr } = await admin
        .from("financeiro_notas_importadas")
        .insert({
          empresa_id: empresaId,
          tipo: nota.tipo,
          direcao: nota.direcao,
          chave_acesso: nota.chave_acesso,
          numero: nota.numero,
          serie: nota.serie,
          data_emissao: nota.data_emissao,
          competencia,
          cnpj_emitente: nota.cnpj_emitente,
          nome_emitente: nota.nome_emitente,
          cnpj_destinatario: nota.cnpj_destinatario,
          nome_destinatario: nota.nome_destinatario,
          valor_total: nota.valor_total,
          valor_servicos: nota.valor_servicos,
          valor_produtos: nota.valor_produtos,
          iss_retido: nota.iss_retido,
          tipo_servico: nota.tipo_servico,
          lancamento_id: lanc.id,
          status: "processada",
          importado_por: userId,
        });

      if (notaErr) {
        resultados.push({ nome, status: "erro", erro: notaErr.message });
        erros++;
        continue;
      }

      criadas++;
      resultados.push({
        nome,
        status: "processada",
        tipo: nota.tipo,
        direcao: nota.direcao,
        valor: nota.valor_total,
        competencia,
      });
    }

    return json({
      ok: true,
      total: arquivos.length,
      criadas,
      duplicadas,
      erros,
      resultados,
    });
  } catch (e: any) {
    console.error("importar-notas-fiscais error:", e);
    return json({ error: e?.message ?? "erro interno" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
