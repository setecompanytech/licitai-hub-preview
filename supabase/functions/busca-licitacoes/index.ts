// @ts-nocheck
/**
 * busca-licitacoes — Edge Function PNCP
 *
 * v4 — Correções:
 * 1. Sem retry sequencial forçando modalidade 6
 * 2. Busca em "todas as modalidades" via cache sincronizado
 * 3. Fallback para cache em timeout/erro do PNCP
 * 4. Resposta estável para evitar erro + resultado controverso
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/security-headers.ts';

const PNCP_BASE = 'https://pncp.gov.br/api/consulta/v1';

const MODALIDADES: Record<number, string> = {
  1: 'Leilão - Eletrônico',
  2: 'Diálogo Competitivo',
  3: 'Concurso',
  4: 'Concorrência - Eletrônica',
  5: 'Concorrência - Presencial',
  6: 'Pregão - Eletrônico',
  7: 'Pregão - Presencial',
  8: 'Dispensa de Licitação',
  9: 'Inexigibilidade',
  10: 'Manifestação de Interesse',
  11: 'Pré-qualificação',
  12: 'Credenciamento',
  13: 'Leilão - Presencial',
};

const SITUACOES: Record<number, { label: string; cor: string }> = {
  1: { label: 'Divulgada no PNCP', cor: 'azul' },
  2: { label: 'Revogada', cor: 'cinza' },
  3: { label: 'Anulada', cor: 'cinza' },
  4: { label: 'Suspensa', cor: 'amarelo' },
  5: { label: 'Encerrada', cor: 'cinza' },
  6: { label: 'Homologada', cor: 'verde' },
  7: { label: 'Deserta', cor: 'cinza' },
  8: { label: 'Fracassada', cor: 'vermelho' },
};

const CACHE_MIN_SAMPLE = 200;
const CACHE_MAX_SAMPLE = 1000;
const CACHE_PAGE_MULTIPLIER = 10;

type BuscaParams = {
  termo: string;
  uf: string;
  pagina: number;
  tamanhoPagina: number;
  dataInicial: string;
  dataFinal: string;
  modalidade: string;
  situacao: string;
  esfera: string;
};

function calcularStatus(item: Record<string, unknown>): string {
  const situacaoId = Number(item.situacaoCompraId);
  const agora = new Date();
  const encerramento = item.dataEncerramentoProposta
    ? new Date(item.dataEncerramentoProposta as string)
    : null;
  const abertura = item.dataAberturaProposta
    ? new Date(item.dataAberturaProposta as string)
    : null;

  if ([2, 3, 7, 8].includes(situacaoId)) return 'encerrado';
  if (situacaoId === 4) return 'suspenso';
  if (situacaoId === 5) return 'encerrado';
  if (situacaoId === 6) return 'homologado';

  if (encerramento && encerramento < agora) return 'encerrado';
  if (abertura && abertura > agora) return 'aguardando';
  return 'aberto';
}

function calcularStatusCache(item: Record<string, unknown>): string {
  const situacao = String(item.situacao || '').toLowerCase();
  const agora = new Date();
  const encerramento = item.data_encerramento_proposta
    ? new Date(item.data_encerramento_proposta as string)
    : null;
  const abertura = item.data_abertura_proposta
    ? new Date(item.data_abertura_proposta as string)
    : null;

  if (situacao.includes('susp')) return 'suspenso';
  if (situacao.includes('homolog')) return 'homologado';
  if (
    situacao.includes('encerr') ||
    situacao.includes('revog') ||
    situacao.includes('anulad') ||
    situacao.includes('desert') ||
    situacao.includes('fracass')
  ) {
    return 'encerrado';
  }

  if (encerramento && encerramento < agora) return 'encerrado';
  if (abertura && abertura > agora) return 'aguardando';
  return 'aberto';
}

function mapearItem(item: Record<string, unknown>) {
  const orgao = (item.orgaoEntidade as Record<string, unknown>) || {};
  const unidade = (item.unidadeOrgao as Record<string, unknown>) || {};
  const situacaoId = Number(item.situacaoCompraId);
  const situacao = SITUACOES[situacaoId] || { label: 'Indefinida', cor: 'cinza' };

  return {
    id: `${item.anoCompra}-${item.sequencialCompra}-${orgao.cnpj}`,
    numeroCompra: item.numeroCompra || `${item.sequencialCompra}/${item.anoCompra}`,
    processo: item.processo || '',
    objeto: item.objetoCompra || 'Objeto não informado',
    orgao: orgao.razaoSocial || 'Órgão não informado',
    cnpj: orgao.cnpj || '',
    municipio: (unidade.municipioNome as string) || '',
    uf: (unidade.ufSigla as string) || (unidade.ufNome as string) || '',
    esfera: orgao.esferaId || '',
    poder: orgao.poderId || '',
    unidade: (unidade.nomeUnidade as string) || '',
    modalidadeId: Number(item.modalidadeId) || 0,
    modalidade: MODALIDADES[Number(item.modalidadeId)] || 'Modalidade não informada',
    valorEstimado: Number(item.valorTotalEstimado) || null,
    valorHomologado: Number(item.valorTotalHomologado) || null,
    dataPublicacao: item.dataInclusao || item.dataPublicacaoPncp || null,
    dataAbertura: item.dataAberturaProposta || null,
    dataEncerramento: item.dataEncerramentoProposta || null,
    situacaoId,
    situacaoNome: item.situacaoCompraNome || situacao.label,
    situacaoCor: situacao.cor,
    status: calcularStatus(item),
    srp: Boolean(item.srp),
    modoDisputa: item.modoDisputaNome || '',
    tipoEdital: item.tipoInstrumentoConvocatorioNome || 'Edital',
    link: item.linkSistemaOrigem || '',
    linkPncp: `https://pncp.gov.br/app/editais/${orgao.cnpj}/${item.anoCompra}/${item.sequencialCompra}`,
    informacaoComplementar: item.informacaoComplementar || '',
  };
}

function mapRawParaCache(raw: Record<string, unknown>): Record<string, unknown> | null {
  const orgao = (raw.orgaoEntidade as Record<string, unknown>) || {};
  const unidade = (raw.unidadeOrgao as Record<string, unknown>) || {};
  // PNCP usa "numeroControlePNCP" (maiúsculo) como chave única por contratação
  const numeroControle = (raw.numeroControlePNCP as string) || null;
  if (!numeroControle) return null; // sem chave estável, não insere
  const pncpId = numeroControle;
  return {
    pncp_id: pncpId,
    fonte: 'PNCP',
    fonte_id: numeroControle,
    numero_controle_pncp: numeroControle,
    cnpj_orgao: (orgao.cnpj as string) || null,
    ano_compra: raw.anoCompra ? String(raw.anoCompra) : null,
    sequencial_compra: raw.sequencialCompra ? String(raw.sequencialCompra) : null,
    numero_compra: (raw.numeroCompra as string) || null,
    orgao: (orgao.razaoSocial as string) || null,
    unidade_orgao: (unidade.nomeUnidade as string) || null,
    objeto: (raw.objetoCompra as string) || null,
    modalidade_id: Number(raw.modalidadeId) || null,
    modalidade_nome: MODALIDADES[Number(raw.modalidadeId)] || null,
    situacao: (raw.situacaoCompraNome as string) || null,
    valor_total_estimado: raw.valorTotalEstimado ? Number(raw.valorTotalEstimado) : null,
    uf: (unidade.ufSigla as string) || (unidade.ufNome as string) || null,
    municipio: (unidade.municipioNome as string) || null,
    municipio_ibge: unidade.codigoIbge ? String(unidade.codigoIbge) : null,
    esfera_id: (orgao.esferaId as string) || null,
    data_publicacao_pncp: (raw.dataPublicacaoPncp as string) || (raw.dataInclusao as string) || null,
    data_abertura_proposta: (raw.dataAberturaProposta as string) || null,
    data_encerramento_proposta: (raw.dataEncerramentoProposta as string) || null,
    link_sistema_origem: (raw.linkSistemaOrigem as string) || null,
    url_pncp: `https://pncp.gov.br/app/editais/${orgao.cnpj}/${raw.anoCompra}/${raw.sequencialCompra}`,
    tipo_instrumento: (raw.tipoInstrumentoConvocatorioNome as string) || null,
    srp: Boolean(raw.srp),
    codigo_unidade: unidade.codigoUnidade ? String(unidade.codigoUnidade) : null,
    lei_base: (raw as any).amparoLegal?.descricao || null,
    link_comprasnet: null,
  };
}

function mapearItemCache(item: Record<string, unknown>) {
  const status = calcularStatusCache(item);
  const linkPncp = item.url_pncp || (
    item.cnpj_orgao && item.ano_compra && item.sequencial_compra
      ? `https://pncp.gov.br/app/editais/${item.cnpj_orgao}/${item.ano_compra}/${item.sequencial_compra}`
      : ''
  );

  return {
    id: String(item.id || `${item.ano_compra}-${item.sequencial_compra}-${item.cnpj_orgao || 'cache'}`),
    numeroCompra: item.numero_compra || `${item.sequencial_compra}/${item.ano_compra}`,
    processo: item.numero_controle_pncp || '',
    objeto: item.objeto || 'Objeto não informado',
    orgao: item.orgao || 'Órgão não informado',
    cnpj: item.cnpj_orgao || '',
    municipio: (item.municipio as string) || '',
    uf: (item.uf as string) || '',
    esfera: item.esfera_id || '',
    modalidadeId: Number(item.modalidade_id) || 0,
    modalidade: item.modalidade_nome || MODALIDADES[Number(item.modalidade_id)] || 'Modalidade não informada',
    valorEstimado: Number(item.valor_total_estimado) || null,
    valorHomologado: null,
    dataPublicacao: item.data_publicacao_pncp || null,
    dataAbertura: item.data_abertura_proposta || null,
    dataEncerramento: item.data_encerramento_proposta || null,
    situacaoId: 0,
    situacaoNome: item.situacao || 'Publicada',
    situacaoCor: status === 'homologado'
      ? 'verde'
      : status === 'suspenso'
        ? 'amarelo'
        : status === 'encerrado'
          ? 'cinza'
          : 'azul',
    status,
    srp: Boolean(item.srp),
    modoDisputa: '',
    tipoEdital: item.tipo_instrumento || 'Edital',
    link: item.link_sistema_origem || item.link_comprasnet || '',
    linkPncp,
    informacaoComplementar: '',
  };
}

function aplicarFiltroSituacao<T extends { status: string }>(items: T[], situacao: string): T[] {
  if (situacao === 'abertas') {
    return items.filter((item) => item.status === 'aberto' || item.status === 'aguardando');
  }

  if (situacao === 'encerradas') {
    return items.filter((item) => item.status === 'encerrado');
  }

  return items;
}

function formatPncpDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function formatIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function createServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Configuração do cache indisponível');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function buscarNoCache(params: BuscaParams, cors: HeadersInit, aviso: string) {
  const supabase = createServiceClient();
  const sampleSize = Math.min(
    CACHE_MAX_SAMPLE,
    Math.max(CACHE_MIN_SAMPLE, params.pagina * params.tamanhoPagina * CACHE_PAGE_MULTIPLIER),
  );

  const { data, error } = await supabase.rpc('busca_editais_instantanea', {
    p_q: params.termo || null,
    p_uf: params.uf || null,
    p_municipio_ibge: null,
    p_esfera: params.esfera || null,
    p_modalidade_id: params.modalidade && params.modalidade !== 'all' && params.modalidade !== '0'
      ? Number(params.modalidade)
      : null,
    p_segmento: null,
    p_data_inicio: params.dataInicial || null,
    p_data_fim: params.dataFinal || null,
    p_ordenacao: params.situacao === 'abertas' ? 'data_abertura' : 'data_publicacao',
    p_direcao: 'desc',
    p_pagina: 1,
    p_tamanho: sampleSize,
  });

  if (error) {
    throw error;
  }

  const mapped = aplicarFiltroSituacao(
    ((data || []) as Record<string, unknown>[]).map(mapearItemCache),
    params.situacao,
  );

  const inicio = (params.pagina - 1) * params.tamanhoPagina;
  const paginados = mapped.slice(inicio, inicio + params.tamanhoPagina);
  const total = mapped.length;
  const avisoFinal = sampleSize === CACHE_MAX_SAMPLE && (data?.length || 0) >= CACHE_MAX_SAMPLE
    ? `${aviso} A paginação pode ser parcial em pesquisas muito amplas.`
    : aviso;

  return new Response(JSON.stringify({
    data: paginados,
    total,
    paginas: Math.max(1, Math.ceil(total / params.tamanhoPagina)),
    pagina: params.pagina,
    aviso: avisoFinal,
  }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  let parsedBody: Record<string, unknown> = {};

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  try {
    parsedBody = await req.json();
    const {
      termo = '',
      uf = '',
      pagina = 1,
      tamanhoPagina = 20,
      dataInicial,
      dataFinal,
      modalidade,
      situacao = 'abertas',
      esfera,
    } = parsedBody;

    const hoje = new Date();
    const pageSize = Math.max(10, Math.min(Number(tamanhoPagina) || 20, 50));
    const paginaAtual = Math.max(1, Number(pagina) || 1);

    // Default: 30 dias atrás
    const inicio30 = new Date(hoje);
    inicio30.setDate(inicio30.getDate() - 30);

    const dataInicialFiltro = dataInicial || formatIsoDate(inicio30);
    const dataFinalFiltro = dataFinal || formatIsoDate(hoje);
    const modalidadeFiltro = modalidade ? String(modalidade) : '';
    const esferaFiltro = esfera && esfera !== 'all' ? String(esfera) : '';

    const buscaParams: BuscaParams = {
      termo,
      uf,
      pagina: paginaAtual,
      tamanhoPagina: pageSize,
      dataInicial: dataInicialFiltro,
      dataFinal: dataFinalFiltro,
      modalidade: modalidadeFiltro,
      situacao,
      esfera: esferaFiltro,
    };

    if (!modalidadeFiltro || modalidadeFiltro === 'all' || modalidadeFiltro === '0') {
      // Busca ao vivo no PNCP para as modalidades mais comuns em paralelo
      const MODALIDADES_COMUNS = [6, 4, 8, 9, 5, 7]; // Pregão Eletrônico, Concorrência Eletrônica, Dispensa, Inexigibilidade, Concorrência Presencial, Pregão Presencial

      const fetchModalidade = async (modId: number): Promise<{
        mapped: ReturnType<typeof mapearItem>[];
        raw: Record<string, unknown>[];
      }> => {
        const p = new URLSearchParams({
          pagina: '1',
          tamanhoPagina: String(Math.min(50, pageSize * 3)),
        });
        if (termo) p.set('q', termo);
        if (uf) p.set('uf', uf.toUpperCase());
        if (esferaFiltro) p.set('codigoEsfera', esferaFiltro);
        p.set('codigoModalidadeContratacao', String(modId));
        p.set('dataInicial', dataInicialFiltro.replace(/-/g, ''));
        p.set('dataFinal', dataFinalFiltro.replace(/-/g, ''));
        const resp = await fetch(`${PNCP_BASE}/contratacoes/publicacao?${p}`, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'Praefectus/1.0 (licitacoes@praefectus.com.br)' },
          signal: AbortSignal.timeout(25_000),
        });
        if (!resp.ok) return { mapped: [], raw: [] };
        const json = await resp.json();
        const rawItems = (json.data || []) as Record<string, unknown>[];
        return { mapped: rawItems.map(mapearItem), raw: rawItems };
      };

      try {
        const settled = await Promise.allSettled(MODALIDADES_COMUNS.map(fetchModalidade));
        const allItems: ReturnType<typeof mapearItem>[] = [];
        const allRaw: Record<string, unknown>[] = [];
        for (const r of settled) {
          if (r.status === 'fulfilled') {
            allItems.push(...r.value.mapped);
            allRaw.push(...r.value.raw);
          }
        }

        if (allItems.length > 0) {
          const filtrados = aplicarFiltroSituacao(allItems, situacao);
          filtrados.sort((a, b) => new Date(b.dataPublicacao || '').getTime() - new Date(a.dataPublicacao || '').getTime());
          const inicio = (paginaAtual - 1) * pageSize;

          // Salva resultados no cache para ter dados de fallback quando PNCP falhar
          if (allRaw.length > 0) {
            try {
              const sc = createServiceClient();
              // Filtra nulos e deduplica por (fonte,fonte_id) — igual ao pncp-sync-diario
              const mapped = allRaw.map(mapRawParaCache).filter(Boolean) as Record<string, unknown>[];
              const dedupMap = new Map<string, Record<string, unknown>>();
              for (const item of mapped) {
                const k = `PNCP::${item.fonte_id}`;
                dedupMap.set(k, item);
              }
              const dedupItems = [...dedupMap.values()];
              if (dedupItems.length > 0) {
                const { error: cacheErr } = await sc.from('pncp_editais_cache')
                  .upsert(dedupItems, { ignoreDuplicates: true });
                if (cacheErr) console.warn('Cache upsert error:', cacheErr.message);
                else console.log(`Cache: ${dedupItems.length} itens salvos`);
              }
            } catch (cacheInitErr: any) {
              console.warn('Cache init/upsert error:', cacheInitErr?.message || cacheInitErr);
            }
          }

          return new Response(JSON.stringify({
            data: filtrados.slice(inicio, inicio + pageSize),
            total: filtrados.length,
            paginas: Math.max(1, Math.ceil(filtrados.length / pageSize)),
            pagina: paginaAtual,
          }), { headers: { ...cors, 'Content-Type': 'application/json' } });
        }
      } catch (e) {
        console.error('Multi-modalidade PNCP error:', e);
      }

      return await buscarNoCache(
        buscaParams,
        cors,
        'Pesquisa em todas as modalidades via cache sincronizado do PNCP.',
      );
    }

    const params = new URLSearchParams({
      pagina: String(paginaAtual),
      tamanhoPagina: String(pageSize),
    });

    if (termo) params.set('q', termo);
    if (uf) params.set('uf', uf.toUpperCase());
    if (esferaFiltro) params.set('codigoEsfera', esferaFiltro);
    params.set('codigoModalidadeContratacao', modalidadeFiltro);

    // Dates
    params.set('dataInicial', dataInicialFiltro.replace(/-/g, ''));
    params.set('dataFinal', dataFinalFiltro.replace(/-/g, ''));

    const endpoint = `${PNCP_BASE}/contratacoes/publicacao`;
    const url = `${endpoint}?${params.toString()}`;
    console.log(`PNCP request: ${url}`);

    const resp = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Praefectus/1.0 (licitacoes@praefectus.com.br)',
      },
      signal: AbortSignal.timeout(45_000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`PNCP error ${resp.status}: ${errText.slice(0, 500)}`);

      try {
        return await buscarNoCache(
          buscaParams,
          cors,
          `Consulta ao PNCP indisponível (HTTP ${resp.status}); exibindo resultados do cache sincronizado.`,
        );
      } catch (cacheError) {
        console.error('cache fallback error:', cacheError);
      }

      return new Response(JSON.stringify({
        error: `Erro na consulta PNCP (HTTP ${resp.status}). Tente novamente.`,
        data: [], total: 0, paginas: 0,
      }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const json = await resp.json();
    const items: Record<string, unknown>[] = json.data || [];

    const mapeados = items.map(mapearItem);
    const resultado = aplicarFiltroSituacao(mapeados, situacao);

    const filteredCount = resultado.length;
    const totalOriginal = json.totalRegistros || items.length;

    return new Response(JSON.stringify({
      data: resultado,
      total: situacao === 'todas' ? totalOriginal : filteredCount,
      paginas: situacao === 'todas'
        ? (json.totalPaginas || Math.ceil(totalOriginal / pageSize))
        : Math.max(1, Math.ceil(filteredCount / pageSize)),
      pagina: paginaAtual,
    }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('busca-licitacoes error:', err);

    const msg = err instanceof Error ? err.message : 'Erro interno';
    if (msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('timed out')) {
      try {
        const hoje = new Date();
        const inicio30 = new Date(hoje);
        inicio30.setDate(inicio30.getDate() - 30);

        return await buscarNoCache({
          termo: String(parsedBody.termo || ''),
          uf: String(parsedBody.uf || ''),
          pagina: Math.max(1, Number(parsedBody.pagina) || 1),
          tamanhoPagina: Math.max(10, Math.min(Number(parsedBody.tamanhoPagina) || 20, 50)),
          dataInicial: String(parsedBody.dataInicial || formatIsoDate(inicio30)),
          dataFinal: String(parsedBody.dataFinal || formatIsoDate(hoje)),
          modalidade: parsedBody.modalidade ? String(parsedBody.modalidade) : '',
          situacao: String(parsedBody.situacao || 'abertas'),
          esfera: String(parsedBody.esfera || ''),
        }, cors, 'O PNCP demorou para responder; exibindo resultados do cache sincronizado.');
      } catch (cacheError) {
        console.error('cache fallback error:', cacheError);
      }
    }

    return new Response(JSON.stringify({
      error: msg,
      data: [], total: 0, paginas: 0,
    }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
