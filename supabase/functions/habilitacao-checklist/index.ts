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
import { classificarExigencia, classificarTipo, LABEL_SEGMENTO, SEGMENTOS_OBJETO } from "../_shared/habilitacao-tipos.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Avisos que ESTA rotina acrescenta — não são texto da IA e não se acumulam. */
const AVISOS_DA_ROTINA = [
  /·?\s*Esta exigência cobre mais de um documento[^·]*/g,
  /·?\s*nenhum atestado do segmento[^·]*/g,
];
const limparAvisos = (obs: string) =>
  AVISOS_DA_ROTINA.reduce((t, re) => t.replace(re, ""), obs).replace(/^\s*·\s*/, "").trim();

/** Caminho inverso do GRUPO_POR_CATEGORIA, para reconstruir a exigência gravada. */
const CATEGORIA_POR_GRUPO: Record<string, string> = {
  juridica: "Habilitação Jurídica",
  fiscal: "Regularidade Fiscal",
  tecnica: "Qualificação Técnica",
  economica: "Qualif. Econômico-Financeira",
  declaracoes: "Declarações",
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

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await userClient.auth.getUser(token);
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const { licitacao_id, edital_texto, recasar } = await req.json();
    if (!licitacao_id) return json({ error: "licitacao_id required" }, 400);
    // `recasar`: refaz só o CASAMENTO com o cofre, reaproveitando as exigências
    // já extraídas. O cofre é vivo — documento anexado depois da geração não
    // aparecia sem reler o edital inteiro, que custa ~30 mil tokens e esbarra
    // no limite por minuto. Ler o edital e casar com o cofre são trabalhos
    // diferentes; estavam presos um ao outro.
    if (!recasar && (!edital_texto || String(edital_texto).trim().length < 200)) {
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

    // ── 1. As exigências: relidas do edital, ou reaproveitadas do checklist ──
    //
    // No recasamento, a fonte é a própria linha gravada: `trecho_edital` guarda
    // a transcrição literal do órgão, que é justamente o que identifica o
    // documento. Nada de IA aqui — a extração já foi feita e paga.
    let listaGravada: Array<Record<string, unknown>> | null = null;
    let segmentoGravado: string | null = null;
    if (recasar) {
      const { data: antigas } = await admin
        .from("processo_habilitacao_checklist")
        .select("exigencia, referencia, trecho_edital, obrigatorio, grupo, observacao, conferido")
        .eq("licitacao_id", licitacao_id);
      if (!antigas?.length) {
        return json({ error: "Não há checklist para recasar — gere com a Aurélia primeiro." }, 422);
      }
      listaGravada = antigas.map((l) => ({
        nome: l.exigencia,
        artigo_referencia: l.referencia || "",
        trecho_edital: l.trecho_edital || "",
        obrigatorio: l.obrigatorio !== false,
        categoria: CATEGORIA_POR_GRUPO[String(l.grupo)] ?? "",
        // Avisos desta rotina não voltam como observação da IA: repetiriam a
        // cada recasamento até virar um parágrafo de eco.
        observacao: limparAvisos(String(l.observacao || "")),
      }));
      segmentoGravado = null;
    }

    // ── 1b. Extração via IA (prompt provado do verificar-documentos-edital) ──
    //
    // O 429 do provedor é limite POR MINUTO, não falta de crédito: o edital
    // inteiro consome ~30 mil tokens, e basta outra geração ter rodado há
    // pouco para estourar a cota do minuto. Mandar o usuário "tentar de novo"
    // num erro que passa sozinho em segundos é empurrar trabalho para ele.
    const chamarIA = async (tentativa = 1): Promise<Response> => {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          // Objeto ajuda a IA a classificar o segmento (Movimento C)
          messages: [
            {
              role: "system",
              content:
                "Você é um especialista em licitações brasileiras (Lei 14.133/2021). O texto contém um ou mais documentos do processo (edital, Termo de Referência e demais anexos), delimitados por linhas '===== DOCUMENTO: <nome> ====='. Analise TODOS os documentos e extraia TODAS as exigências de documentos para habilitação e participação, de qualquer um deles. Classifique cada uma. Para CADA exigência, informe em artigo_referencia o número do item/subitem exatamente como numerado no texto (ex.: '9.1.5', '5.7.1'); quando a exigência vier de um anexo (não do edital principal), prefixe com a sigla do documento (ex.: 'TR 9.6.4' para o Termo de Referência). A mesma exigência repetida em documentos diferentes deve virar UMA entrada só, unindo as referências (ex.: '5.4.2; TR 9.6.4'). Se a exigência não tiver numeração no texto, use string vazia. REGRA DE DESDOBRAMENTO — A MAIS IMPORTANTE DESTA TAREFA. NUNCA devolva como exigência o TÍTULO de uma seção do edital ('Habilitação Jurídica', 'Habilitação Fiscal, Social e Trabalhista', 'Qualificação Técnica'): esses são rótulos de categoria, não documentos, e uma linha assim é inútil para quem monta a pasta. O campo `nome` tem de conter SEMPRE um documento específico e nomeável ('Cartão CNPJ', 'CND Federal', 'CNDT', 'Balanço patrimonial'). Se um único item do edital exigir VÁRIOS documentos ('certidão negativa de tributos federais, estaduais e municipais, bem como do FGTS'), crie UMA LINHA POR DOCUMENTO, todas com a mesma referência e o mesmo trecho. Quando o edital exigir uma categoria genericamente ('habilitação jurídica na forma da lei', 'regularidade fiscal', 'qualificação econômico-financeira'), NÃO crie uma linha genérica — desdobre nos documentos padrão do artigo correspondente, todos com a mesma referência do item genérico: Art. 66 (jurídica) → ato constitutivo/contrato social, documentos de identificação dos sócios/administradores, inscrição no registro comercial; Art. 68 (fiscal) → CNPJ, CND Federal/União, CND Estadual, CND Municipal, CRF/FGTS, CNDT; Art. 69 (econômico-financeira) → balanço patrimonial, certidão negativa de falência; Art. 67 (técnica) → atestado(s) de capacidade técnica. Crie a linha genérica apenas se a categoria não se desdobrar nesses padrões. Para CADA exigência, transcreva em trecho_edital o texto ORIGINAL do órgão, literalmente — quem confere precisa das palavras do edital, não da sua paráfrase. Nunca invente trecho: se a exigência foi desdobrada de uma categoria genérica, transcreva o trecho genérico que a originou. Classifique também o objeto licitado no campo segmento_objeto.",
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
                          trecho_edital: {
                            type: "string",
                            description: "TRANSCRIÇÃO LITERAL do trecho do edital que cria a exigência — as palavras do órgão, sem resumir, sem reescrever, sem corrigir. Copie do item citado em artigo_referencia, começando pela numeração. Se a exigência foi desdobrada de uma categoria genérica, transcreva o trecho genérico. Máximo de 600 caracteres; se o trecho for maior, corte no fim de uma frase. String vazia só se o texto não estiver nos documentos analisados.",
                          },
                          obrigatorio: { type: "boolean" },
                          observacao: { type: "string" },
                        },
                        required: ["nome", "categoria", "obrigatorio", "artigo_referencia", "trecho_edital"],
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

      // Espera o que o provedor mandar esperar; sem cabeçalho, 20s e 40s —
      // a janela do limite é de um minuto.
      if (r.status === 429 && tentativa <= 2) {
        const sugerido = Number(r.headers.get("retry-after")) * 1000;
        const espera = Number.isFinite(sugerido) && sugerido > 0
          ? Math.min(sugerido, 45_000)
          : tentativa * 20_000;
        await new Promise((ok) => setTimeout(ok, espera));
        return chamarIA(tentativa + 1);
      }
      return r;
    };

    if (!recasar && !OPENAI_KEY) return json({ error: "OPENAI_API_KEY não configurada" }, 500);
    const aiResp = recasar ? null : await chamarIA();

    if (aiResp && !aiResp.ok) {
      const body = await aiResp.text();
      // Mensagem em português para o caso mais comum, preservando o original.
      const detalhe = aiResp.status === 429
        ? "limite de uso por minuto do provedor de IA atingido, mesmo após duas novas tentativas. Aguarde um minuto e gere de novo."
        : body.slice(0, 200);
      return json({ error: `IA indisponível (${aiResp.status}): ${detalhe}` }, 502);
    }
    const aiJson = aiResp ? await aiResp.json() : null;
    const call = aiJson?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let exigidos: { documentos_exigidos: Array<Record<string, unknown>>; segmento_objeto?: string } = { documentos_exigidos: [] };
    try { exigidos = JSON.parse(call || "{}"); } catch { /* segue vazio */ }
    const lista = listaGravada ?? (exigidos.documentos_exigidos || []);
    if (!lista.length) return json({ error: "A IA não identificou exigências no texto enviado." }, 422);
    const segmentoObjeto = recasar
      ? segmentoGravado
      : (SEGMENTOS_OBJETO.includes(exigidos.segmento_objeto as never) ? String(exigidos.segmento_objeto) : null);

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
      // Filtro por empresa desde 20260818000007: `documentos` ganhou empresa_id
      // e a RLS passou a ser por empresa. Sem o filtro, quem participa de duas
      // empresas casaria a certidão de uma no processo da outra — e o erro só
      // apareceria na habilitação, com o documento errado já enviado.
      // O fallback por user_id cobre registro antigo, que ficou sem empresa.
      userClient
        .from("documentos")
        .select("id, nome, tipo, descricao, segmento, validade, arquivo_path, empresa_id")
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
      ...(cofreJuridico || [])
        .filter((d) => !d.empresa_id || d.empresa_id === lic.empresa_id)
        .map((d) => ({
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
      // O TRECHO do edital manda: ele nomeia o documento exigido. O nome que a
      // IA deu vem depois, e é ignorado quando é só o rótulo da seção — era daí
      // que vinha o casamento por acaso ("Habilitação Fiscal, Social e
      // Trabalhista" casando com a CNDT por causa da palavra no título).
      const { tipo: taxo, ambigua } = classificarExigencia({
        nome: String(ex.nome || ""),
        trecho: String(ex.trecho_edital || ""),
        observacao: String(ex.observacao || ""),
      });
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
        // Transcrição literal, para quem confere não precisar abrir o PDF.
        trecho_edital: String(ex.trecho_edital || "").trim()
          ? String(ex.trecho_edital).trim().replace(/\s+/g, " ").slice(0, 700)
          : null,
        obrigatorio: ex.obrigatorio !== false,
        observacao: [
          ex.observacao ? String(ex.observacao).slice(0, 400) : null,
          // Exigência que cobre vários documentos não casa com um só arquivo:
          // dizer "casado" ali afirmaria uma cobertura inexistente.
          ambigua ? "Esta exigência cobre mais de um documento — confira um a um" : null,
          avisoSegmento,
        ]
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
