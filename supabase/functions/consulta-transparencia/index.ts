// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  dataBr, fichaDaPessoaJuridica, janelasMensais, mensagemDaApi, mesAnoDe, registrosDoCnpj, verificarIdoneidade,
} from '../_shared/portal-transparencia.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Portal da Transparência do Governo Federal — os nomes de parâmetro, a
// conferência do filtro por CNPJ e a idoneidade vivem em
// `_shared/portal-transparencia.ts` (22/09); aqui fica o roteamento por tipo.
const BASE_URL = 'https://api.portaldatransparencia.gov.br/api-de-dados';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      tipo, cnpj, pagina = 1, termo, dataInicio, dataFim, orgao, uf,
      // Detalhes de licitação e contrato, notas fiscais (Onda 2, 22/09).
      id, codigoUG, numero, codigoModalidade, chave,
    } = await req.json();

    const API_KEY = Deno.env.get('PORTAL_TRANSPARENCIA_API_KEY');
    // Sem a chave a API devolve 401 — e a tela mostrava um erro genérico que
    // não dizia o que fazer. Falha com instrução é falha que se resolve.
    if (!API_KEY) {
      return new Response(JSON.stringify({
        error: 'A chave da API do Portal da Transparência ainda não foi configurada. '
          + 'Cadastre um e-mail em portaldatransparencia.gov.br/api-de-dados/cadastrar-email '
          + '(gratuito, resposta imediata) e informe a chave ao administrador do sistema.',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'chave-api-dados': API_KEY,
    };
    const responder = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    let url = '';
    const params = new URLSearchParams();
    params.set('pagina', String(pagina));

    switch (tipo) {
      case 'ceis':
      case 'cnep': {
        // CEIS e CNEP filtram por `codigoSancionado` na especificação atual
        // (22/09); o nome antigo `cnpjSancionado` vai junto — parâmetro
        // desconhecido é ignorado, o conhecido filtra. `ufSancionado` só
        // existe no CEPIM. A conferência do filtro vem depois da resposta.
        url = `${BASE_URL}/${tipo}`;
        if (cnpj) {
          const c = cnpj.replace(/\D/g, '');
          params.set('codigoSancionado', c);
          params.set('cnpjSancionado', c);
        }
        if (termo) params.set('nomeSancionado', termo);
        if (orgao) params.set('orgaoSancionador', orgao);
        if (dataInicio) params.set('dataInicialSancao', dataInicio);
        if (dataFim) params.set('dataFinalSancao', dataFim);
        break;
      }
      case 'cepim': {
        // Cadastro de Entidades Privadas sem Fins Lucrativos Impedidas
        url = `${BASE_URL}/cepim`;
        if (cnpj) params.set('cnpjSancionado', cnpj.replace(/\D/g, ''));
        if (termo) params.set('nomeSancionado', termo);
        if (uf) params.set('ufSancionado', uf);
        break;
      }
      case 'leniencia': {
        // Acordos de leniência (Lei 12.846/2013) — o quarto cadastro (22/09).
        url = `${BASE_URL}/acordos-leniencia`;
        if (cnpj) params.set('cnpjSancionado', cnpj.replace(/\D/g, ''));
        if (termo) params.set('nomeSancionado', termo);
        if (dataInicio) params.set('dataInicialSancao', dataInicio);
        if (dataFim) params.set('dataFinalSancao', dataFim);
        break;
      }
      case 'licitacoes': {
        // Licitações: a API EXIGE codigoOrgao (spec oficial, conferida em
        // 08/09). Sem ele, devolver a exigência com instrução — o 400 cru da
        // API não diz onde achar o código.
        if (!orgao) {
          return responder({
            error: 'Para licitações federais a API exige o código SIAFI do órgão. '
              + 'Informe-o no campo "Código do órgão" (ex.: 26403 — IFPA; '
              + 'a lista completa está no Portal da Transparência, em Órgãos).',
          });
        }
        // A API aceita no máximo UM MÊS por consulta; a tela pede seis. Varre
        // mês a mês, página a página, e junta sem repetir (22/09). Antes a
        // API recusava a janela e a tela mostrava a recusa como erro.
        const hoje = new Date();
        const fim = dataFim || dataBr(hoje);
        const inicio = dataInicio || dataBr(new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 1, hoje.getUTCDate())));
        const janelas = janelasMensais(inicio, fim, 12);
        const vistos = new Set<string>();
        const dados: Record<string, unknown>[] = [];
        for (const janela of janelas) {
          for (let pg = 1; pg <= 5; pg++) {
            const q = new URLSearchParams({ codigoOrgao: orgao, dataInicial: janela.de, dataFinal: janela.ate, pagina: String(pg) });
            const r = await fetch(`${BASE_URL}/licitacoes?${q.toString()}`, { headers });
            if (!r.ok) {
              const t = await r.text();
              return responder({ error: `A API do Portal da Transparência recusou a consulta de ${janela.de} a ${janela.ate}: ${mensagemDaApi(t)}` });
            }
            const lista = await r.json();
            if (!Array.isArray(lista) || lista.length === 0) break;
            for (const l of lista) {
              const id = String((l as Record<string, unknown>).id ?? JSON.stringify(l));
              if (!vistos.has(id)) { vistos.add(id); dados.push(l as Record<string, unknown>); }
            }
            if (lista.length < 15) break;
          }
        }
        return responder({
          dados, total: dados.length, pagina: 1,
          janelas: janelas.length, periodo: { de: inicio, ate: fim },
          consultadoEm: new Date().toISOString(),
        });
      }
      case 'contratos': {
        // Dois caminhos oficiais: por CNPJ do contratado (/contratos/cpf-cnpj,
        // parâmetro cpfCnpj — o caminho antigo cpfCnpjContratado não existe e
        // devolvia 403 mudo) ou por código SIAFI do órgão (/contratos).
        const cnpjLimpo = cnpj?.replace(/\D/g, '') || '';
        if (cnpjLimpo) {
          url = `${BASE_URL}/contratos/cpf-cnpj`;
          params.set('cpfCnpj', cnpjLimpo);
        } else if (orgao) {
          url = `${BASE_URL}/contratos`;
          params.set('codigoOrgao', orgao);
          if (dataInicio) params.set('dataInicial', dataInicio);
          if (dataFim) params.set('dataFinal', dataFim);
        } else {
          return new Response(JSON.stringify({
            error: 'Informe o CNPJ do contratado OU o código SIAFI do órgão — '
              + 'a API federal não lista contratos sem um dos dois.',
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        break;
      }
      case 'contratos-cnpj': {
        // Contratos por CNPJ do contratado — caminho e parâmetro da spec.
        url = `${BASE_URL}/contratos/cpf-cnpj`;
        if (cnpj) params.set('cpfCnpj', cnpj.replace(/\D/g, ''));
        break;
      }
      case 'despesas': {
        // Recebimento de recursos por favorecido: a rota exige o mês inicial
        // e o final (MM/AAAA) e chama o CNPJ de `codigoFavorecido` (spec de
        // 22/09; antes ia `cpfCnpjFavorecido` sem mês, e a API recusava).
        url = `${BASE_URL}/despesas/recursos-recebidos`;
        const hoje = new Date();
        const mesAno = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
        params.set('mesAnoInicio', mesAnoDe(dataInicio) ?? mesAno(new Date(Date.UTC(hoje.getUTCFullYear() - 1, hoje.getUTCMonth(), 1))));
        params.set('mesAnoFim', mesAnoDe(dataFim) ?? mesAno(hoje));
        if (cnpj) params.set('codigoFavorecido', cnpj.replace(/\D/g, ''));
        if (termo) params.set('nomeFavorecido', termo);
        if (uf) params.set('uf', uf);
        if (orgao) params.set('orgao', orgao);
        break;
      }
      case 'idoneidade': {
        // Verificação completa (22/09): CEIS + CNEP + CEPIM + acordos de
        // leniência, com a conferência do filtro por CNPJ e a ficha da pessoa
        // jurídica cruzada. Tudo em `_shared/portal-transparencia.ts`.
        const cnpjLimpo = cnpj?.replace(/\D/g, '') || '';
        if (cnpjLimpo.length !== 14) {
          return responder({ error: 'CNPJ é obrigatório para verificação de idoneidade' }, 400);
        }
        return responder(await verificarIdoneidade(cnpjLimpo, API_KEY));
      }
      // ── Onda 2 (22/09): órgão por nome, licitação e contrato em detalhe,
      //    ficha da pessoa jurídica e notas fiscais por produto ────────────
      case 'orgaos': {
        // O código SIAFI que licitações e contratos exigem, buscado pelo nome.
        url = `${BASE_URL}/orgaos-siafi`;
        if (termo) params.set('descricao', termo);
        if (orgao) params.set('codigo', orgao);
        break;
      }
      case 'pessoa-juridica': {
        const c = cnpj?.replace(/\D/g, '') || '';
        if (c.length !== 14) return responder({ error: 'CNPJ é obrigatório' }, 400);
        return responder({ ...(await fichaDaPessoaJuridica(c, API_KEY)), consultadoEm: new Date().toISOString() });
      }
      case 'licitacao-itens': {
        if (!id) return responder({ error: 'Informe o id da licitação' }, 400);
        url = `${BASE_URL}/licitacoes/itens-licitados`;
        params.set('id', String(id));
        break;
      }
      case 'licitacao-participantes':
      case 'licitacao-empenhos':
      case 'licitacao-contratos': {
        // A API identifica a licitação por UG + número (só dígitos) + modalidade.
        if (!codigoUG || !numero || !codigoModalidade) {
          return responder({ error: 'Informe a unidade gestora, o número e a modalidade da licitação' }, 400);
        }
        const rota = tipo === 'licitacao-participantes' ? 'participantes'
          : tipo === 'licitacao-empenhos' ? 'empenhos' : 'contratos-relacionados-licitacao';
        url = `${BASE_URL}/licitacoes/${rota}`;
        params.set('codigoUG', String(codigoUG));
        params.set('numero', String(numero).replace(/\D/g, ''));
        params.set('codigoModalidade', String(codigoModalidade));
        if (tipo === 'licitacao-contratos') params.delete('pagina');
        break;
      }
      case 'contrato-itens':
      case 'contrato-aditivos':
      case 'contrato-apostilamentos':
      case 'contrato-empenhos': {
        if (!id) return responder({ error: 'Informe o id do contrato' }, 400);
        const rota = tipo === 'contrato-itens' ? 'itens-contratados'
          : tipo === 'contrato-aditivos' ? 'termo-aditivo'
          : tipo === 'contrato-apostilamentos' ? 'apostilamento' : 'documentos-relacionados';
        url = `${BASE_URL}/contratos/${rota}`;
        params.set('id', String(id));
        if (tipo !== 'contrato-itens') params.delete('pagina');
        break;
      }
      case 'notas-fiscais': {
        url = `${BASE_URL}/notas-fiscais`;
        if (termo) params.set('nomeProduto', termo);
        if (cnpj) params.set('cnpjEmitente', cnpj.replace(/\D/g, ''));
        if (orgao) params.set('codigoOrgao', orgao);
        break;
      }
      case 'nota-fiscal': {
        if (!chave) return responder({ error: 'Informe a chave da nota fiscal' }, 400);
        url = `${BASE_URL}/notas-fiscais-por-chave`;
        params.delete('pagina');
        params.set('chaveUnicaNotaFiscal', String(chave).replace(/\D/g, ''));
        break;
      }
      case 'notas-fiscais-itens': {
        // Preço por item (22/09): as notas fiscais eletrônicas emitidas ao
        // governo federal que citam o produto, e os itens de cada uma — a única
        // fonte pública com valor unitário, NCM e quantidade. Uma página de
        // notas por consulta (até 15), itens buscados em paralelo.
        const produto = String(termo ?? '').trim();
        if (produto.length < 3) return responder({ error: 'Informe o produto com ao menos 3 letras.' }, 400);
        const q = new URLSearchParams({ nomeProduto: produto, pagina: String(pagina) });
        if (cnpj) q.set('cnpjEmitente', cnpj.replace(/\D/g, ''));
        if (orgao) q.set('codigoOrgao', orgao);
        const r = await fetch(`${BASE_URL}/notas-fiscais?${q.toString()}`, { headers });
        if (!r.ok) {
          return responder({ error: `A API do Portal da Transparência recusou a consulta: ${mensagemDaApi(await r.text())}` });
        }
        const notas = await r.json();
        const lista = (Array.isArray(notas) ? notas : []).slice(0, 15) as Record<string, unknown>[];
        const comItens = await Promise.all(lista.map(async (n) => {
          const chaveNota = String(n.chaveNotaFiscal ?? '').replace(/\D/g, '');
          if (!chaveNota) return { ...n, itens: [] };
          try {
            const d = await fetch(`${BASE_URL}/notas-fiscais-por-chave?chaveUnicaNotaFiscal=${chaveNota}`, { headers });
            if (!d.ok) { await d.text(); return { ...n, itens: [], erroItens: `HTTP ${d.status}` }; }
            const det = await d.json();
            return {
              ...n,
              itens: Array.isArray(det?.itensNotaFiscal) ? det.itensNotaFiscal : [],
              eventos: Array.isArray(det?.eventosNotaFiscal) ? det.eventosNotaFiscal : [],
            };
          } catch (e) {
            return { ...n, itens: [], erroItens: e instanceof Error ? e.message : String(e) };
          }
        }));
        return responder({ notas: comItens, total: comItens.length, pagina, produto, consultadoEm: new Date().toISOString() });
      }
      default:
        return new Response(JSON.stringify({ error: `Tipo de consulta inválido: ${tipo}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const fullUrl = `${url}?${params.toString()}`;
    console.log('Consultando:', fullUrl);

    const response = await fetch(fullUrl, { headers });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Portal da Transparência API error [${response.status}]:`, text.substring(0, 500));
      // Status 200 com {error}: repassar o 4xx fazia o invoke() do front
      // estourar com "non-2xx status code" — e a mensagem REAL da API
      // ("Informe um CNPJ válido…") ficava invisível (08/09). A tela já
      // renderiza data.error; o que a API disse chega ao usuário.
      let detalhe = text.substring(0, 200);
      try {
        const j = JSON.parse(text);
        detalhe = String(Object.values(j)[0] ?? detalhe);
      } catch { /* corpo não-JSON: fica o texto cru */ }
      return new Response(JSON.stringify({
        error: `A API do Portal da Transparência recusou a consulta: ${detalhe}`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    let dados: Record<string, unknown>[] = Array.isArray(data) ? data : [];
    let aviso: string | undefined;

    // Conferência do filtro (22/09): consulta por CNPJ só devolve registros
    // deste CNPJ. Se a API ignorou o parâmetro e mandou o cadastro inteiro,
    // isso é erro, não resultado.
    if (cnpj && ['ceis', 'cnep', 'cepim', 'leniencia'].includes(tipo)) {
      const { proprios, alheios } = registrosDoCnpj(dados, cnpj);
      if (alheios > 0 && proprios.length === 0) {
        return responder({ error: `A API devolveu ${alheios} registro(s) de outros CNPJs e nenhum deste: o filtro por CNPJ não foi aplicado. Confira no portal.` });
      }
      if (alheios > 0) aviso = `${alheios} registro(s) de outros CNPJs vieram junto e foram descartados.`;
      dados = proprios;
    }

    return responder({
      dados,
      total: dados.length,
      pagina,
      ...(aviso ? { aviso } : {}),
      consultadoEm: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro:', error);
    return new Response(JSON.stringify({ error: error.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
