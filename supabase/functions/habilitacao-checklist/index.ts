// @ts-nocheck
// Edge Function: habilitacao-checklist — Fase 3 do prontuário integrado.
//
// POST { licitacao_id, edital_texto } →
//   1. IA extrai as exigências de habilitação do edital (mesmo prompt provado
//      do verificar-documentos-edital);
//   2. cada exigência é classificada na taxonomia compartilhada;
//   3. casamento com o cofre da EMPRESA (agent_documentos) por TIPO — nunca
//      por nome de arquivo — com validade comparada à DATA DA SESSÃO
//      (documento presente-porém-vencido = faltante na prática);
//   4. o checklist é PERSISTIDO em processo_habilitacao_checklist (recriado a
//      cada geração; o aceite humano acontece na UI e vai para a trilha).
//
// Acesso: JWT do usuário; a licitação é lida com o client do usuário — o RLS
// por empresa decide (princípio nº 2 do CLAUDE.md).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { classificarTipo, LABEL_SEGMENTO, SEGMENTOS_OBJETO } from "../_shared/habilitacao-tipos.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_KEY) return json({ error: "OPENAI_API_KEY não configurada" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await userClient.auth.getUser(token);
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const { licitacao_id, edital_texto } = await req.json();
    if (!licitacao_id) return json({ error: "licitacao_id required" }, 400);
    if (!edital_texto || String(edital_texto).trim().length < 200) {
      return json({ error: "edital_texto insuficiente para análise (mínimo ~200 caracteres)" }, 400);
    }

    // Licitação via RLS do usuário: empresa e data da sessão
    const { data: lic } = await userClient
      .from("licitacoes")
      .select("id, empresa_id, numero, orgao, objeto, data_encerramento")
      .eq("id", licitacao_id)
      .maybeSingle();
    if (!lic) return json({ error: "Licitação não encontrada" }, 404);
    if (!lic.empresa_id) return json({ error: "Processo sem empresa vinculada" }, 400);

    // ── 1. Extração via IA (prompt provado do verificar-documentos-edital) ──
    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        // Objeto ajuda a IA a classificar o segmento (Movimento C)
      messages: [
          {
            role: "system",
            content:
              "Você é um especialista em licitações brasileiras (Lei 14.133/2021). O texto contém um ou mais documentos do processo (edital, Termo de Referência e demais anexos), delimitados por linhas '===== DOCUMENTO: <nome> ====='. Analise TODOS os documentos e extraia TODAS as exigências de documentos para habilitação e participação, de qualquer um deles. Classifique cada uma. Para CADA exigência, informe em artigo_referencia o número do item/subitem exatamente como numerado no texto (ex.: '9.1.5', '5.7.1'); quando a exigência vier de um anexo (não do edital principal), prefixe com a sigla do documento (ex.: 'TR 9.6.4' para o Termo de Referência). A mesma exigência repetida em documentos diferentes deve virar UMA entrada só, unindo as referências (ex.: '5.4.2; TR 9.6.4'). Se a exigência não tiver numeração no texto, use string vazia. REGRA DE DESDOBRAMENTO (Lei 14.133/2021): quando o edital exigir uma categoria genericamente ('habilitação jurídica na forma da lei', 'regularidade fiscal', 'qualificação econômico-financeira'), NÃO crie uma linha genérica — desdobre nos documentos padrão do artigo correspondente, todos com a mesma referência do item genérico: Art. 66 (jurídica) → ato constitutivo/contrato social, documentos de identificação dos sócios/administradores, inscrição no registro comercial; Art. 68 (fiscal) → CNPJ, CND Federal/União, CND Estadual, CND Municipal, CRF/FGTS, CNDT; Art. 69 (econômico-financeira) → balanço patrimonial, certidão negativa de falência; Art. 67 (técnica) → atestado(s) de capacidade técnica. Crie a linha genérica apenas se a categoria não se desdobrar nesses padrões. Classifique também o objeto licitado no campo segmento_objeto.",
          },
          {
            role: "user",
            content: `Objeto da licitação: ${String(lic.objeto || "não informado").slice(0, 500)}\n\nAnalise os documentos do processo abaixo e extraia todas as exigências de habilitação e participação.\n\nDOCUMENTOS DO PROCESSO:\n${String(edital_texto).slice(0, 240000)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extrair_documentos_edital",
              description: "Retorna lista de documentos exigidos pelo edital",
              parameters: {
                type: "object",
                properties: {
                  segmento_objeto: {
                    type: "string",
                    enum: ["alimentos", "informatica", "limpeza", "escritorio", "moveis", "vestuario", "medicamentos", "manutencao", "outros"],
                    description: "Segmento do OBJETO licitado (para casar atestados de capacidade técnica do mesmo segmento)",
                  },
                  documentos_exigidos: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        nome: { type: "string" },
                        categoria: {
                          type: "string",
                          enum: ["Habilitação Jurídica", "Regularidade Fiscal", "Qualificação Técnica", "Qualif. Econômico-Financeira", "Declarações", "Proposta", "Outros"],
                        },
                        artigo_referencia: {
                          type: "string",
                          description: "Número do item/subitem do edital onde a exigência aparece, exatamente como no texto (ex.: '9.1.5'). String vazia apenas se o trecho não for numerado.",
                        },
                        obrigatorio: { type: "boolean" },
                        observacao: { type: "string" },
                      },
                      required: ["nome", "categoria", "obrigatorio", "artigo_referencia"],
                    },
                  },
                },
                required: ["documentos_exigidos", "segmento_objeto"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extrair_documentos_edital" } },
      }),
    });

    if (!aiResp.ok) {
      const body = await aiResp.text();
      return json({ error: `IA indisponível (${aiResp.status}): ${body.slice(0, 200)}` }, 502);
    }
    const aiJson = await aiResp.json();
    const call = aiJson?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let exigidos: { documentos_exigidos: Array<Record<string, unknown>>; segmento_objeto?: string } = { documentos_exigidos: [] };
    try { exigidos = JSON.parse(call || "{}"); } catch { /* segue vazio */ }
    const lista = exigidos.documentos_exigidos || [];
    if (!lista.length) return json({ error: "A IA não identificou exigências no texto enviado." }, 422);
    const segmentoObjeto = SEGMENTOS_OBJETO.includes(exigidos.segmento_objeto as never)
      ? String(exigidos.segmento_objeto)
      : null;

    // ── 2/3. Classificação por tipo + casamento com os TRÊS cofres ──────────
    // agent_documentos: cofre automatizado da empresa (certidões coletadas).
    // documentos: o módulo Jurídico → Documentos, onde o usuário anexa manualmente
    // (hoje por user_id — RLS do requisitante decide; migração p/ empresa é F3.1).
    // processo_anexos (Habilitação/Declarações): o casamento REVERSO — o que o
    // usuário anexou direto na pasta do certame (declarações produzidas para
    // este pregão) conta como documento presente ao regenerar o checklist.
    const [{ data: cofreAgent }, { data: cofreJuridico }, { data: pastaCertame }] = await Promise.all([
      admin
        .from("agent_documentos")
        .select("id, tipo, validade")
        .eq("empresa_id", lic.empresa_id),
      userClient
        .from("documentos")
        .select("id, nome, tipo, descricao, segmento, validade, arquivo_path")
        .not("arquivo_path", "is", null),
      userClient
        .from("processo_anexos")
        .select("id, nome_arquivo, categoria, descricao")
        .eq("licitacao_id", licitacao_id)
        .in("categoria", ["habilitacao", "declaracoes"]),
    ]);

    const cofreClassificado = [
      ...(cofreAgent || []).map((d) => ({
        id: d.id,
        nome: d.tipo,
        validade: d.validade,
        origem: "agent_documentos",
        taxo: classificarTipo(d.tipo),
      })),
      // Cofre lido por INTEIRO: descrição (objeto do atestado) e segmento
      // entram na classificação — atestados gravados como tipo "Qualificação
      // Técnica" eram invisíveis quando o nome não continha "atestado".
      ...(cofreJuridico || []).map((d) => ({
        id: d.id,
        nome: d.nome,
        validade: d.validade,
        origem: "documentos",
        segmento: d.segmento || null,
        taxo: classificarTipo(
          `${d.nome} ${d.tipo || ""} ${d.descricao || ""} ${LABEL_SEGMENTO[d.segmento || ""] || ""}`,
        ),
      })),
      // Sem validade própria: anexo do certame vale para a sessão deste certame.
      // Classificado pelo nome do arquivo + descrição (que carrega a exigência
      // quando o arquivo foi copiado pelo "Montar pasta de habilitação").
      ...(pastaCertame || []).map((d) => ({
        id: d.id,
        nome: d.nome_arquivo,
        validade: null as string | null,
        origem: "processo_anexos",
        taxo: classificarTipo(`${d.nome_arquivo} ${d.descricao || ""}`),
      })),
    ];

    const dataSessao = lic.data_encerramento ? String(lic.data_encerramento).slice(0, 10) : null;

    const GRUPO_POR_CATEGORIA: Record<string, string> = {
      "Habilitação Jurídica": "juridica",
      "Regularidade Fiscal": "fiscal",
      "Qualificação Técnica": "tecnica",
      "Qualif. Econômico-Financeira": "economica",
      "Declarações": "declaracoes",
    };

    const rows = lista.map((ex) => {
      const taxo = classificarTipo(String(ex.nome || "") + " " + String(ex.observacao || ""));
      // Casamento POR TIPO. Havendo mais de um candidato, prefere o que segue
      // válido na data da sessão; empate resolve pela validade mais distante.
      let candidatos = taxo
        ? cofreClassificado
            .filter((d) => d.taxo?.id === taxo.id)
            .sort((a, b) => String(b.validade || "").localeCompare(String(a.validade || "")))
        : [];
      // Atestado casa pelo SEGMENTO DO OBJETO (cadeiras → moveis): os do
      // segmento vêm primeiro; sem nenhum do segmento, cai para os demais com
      // aviso — presença não garante pertinência (Art. 67), quem sela é o aceite.
      let avisoSegmento: string | null = null;
      if (taxo?.id === "atestado_tecnico" && segmentoObjeto && candidatos.length) {
        const doSegmento = candidatos.filter((d) => (d as { segmento?: string | null }).segmento === segmentoObjeto);
        if (doSegmento.length) {
          candidatos = doSegmento;
        } else {
          avisoSegmento = `nenhum atestado do segmento ${LABEL_SEGMENTO[segmentoObjeto] || segmentoObjeto} — casado com atestado de outro segmento`;
        }
      }
      const validoNaSessao = (d: { validade: string | null }) => {
        const v = d.validade ? String(d.validade).slice(0, 10) : null;
        return !v || !dataSessao || v >= dataSessao;
      };
      const match = candidatos.find(validoNaSessao) ?? candidatos[0] ?? null;

      let status = "faltante";
      let documento_validade: string | null = null;
      if (match) {
        documento_validade = match.validade ? String(match.validade).slice(0, 10) : null;
        const vencido = documento_validade && dataSessao && documento_validade < dataSessao;
        status = vencido ? "vence_antes_sessao" : "ok";
      }

      return {
        empresa_id: lic.empresa_id,
        licitacao_id,
        tipo: taxo?.id ?? null,
        grupo: taxo?.grupo ?? GRUPO_POR_CATEGORIA[String(ex.categoria)] ?? "outro",
        exigencia: String(ex.nome || "").slice(0, 500),
        referencia: String(ex.artigo_referencia || "").trim() ? String(ex.artigo_referencia).trim().slice(0, 120) : null,
        obrigatorio: ex.obrigatorio !== false,
        observacao: [ex.observacao ? String(ex.observacao).slice(0, 400) : null, avisoSegmento]
          .filter(Boolean)
          .join(" · ") || null,
        status,
        documento_origem: match?.origem ?? null,
        documento_id: match?.id ?? null,
        documento_nome: match?.nome ?? null,
        documento_validade,
      };
    });

    // ── 4. Persistência: recria o checklist do processo ─────────────────────
    await admin.from("processo_habilitacao_checklist").delete().eq("licitacao_id", licitacao_id);
    const { error: insErr } = await admin.from("processo_habilitacao_checklist").insert(rows);
    if (insErr) return json({ error: `Falha ao gravar checklist: ${insErr.message}` }, 500);

    const resumo = {
      total: rows.length,
      ok: rows.filter((r) => r.status === "ok").length,
      vence_antes_sessao: rows.filter((r) => r.status === "vence_antes_sessao").length,
      faltante: rows.filter((r) => r.status === "faltante").length,
    };
    return json({ success: true, licitacao_id, data_sessao: dataSessao, segmento_objeto: segmentoObjeto, resumo });
  } catch (e) {
    console.error("[habilitacao-checklist]", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});
