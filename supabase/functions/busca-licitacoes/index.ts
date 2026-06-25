// @ts-nocheck
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

const CACHE_SAMPLE = 500;

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
  const encerramento = item.dataEncerramentoProposta ? new Date(item.dataEncerramentoProposta as string) : null;
  const abertura = item.dataAberturaProposta ? new Date(item.dataAberturaProposta as string) : null;

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
  const encerramento = item.data_encerramento_proposta ? new Date(item.data_encerramento_proposta as string) : null;
  const abertura = item.data_abertura_proposta ? new Date(item.data_abertura_proposta as string) : null;

  if (situacao.includes('susp')) return 'suspenso';
  if (situacao.includes('homolog')) return 'homologado';
  if (situacao.includes('encerr') || situacao.includes('revog') || situacao.includes('anulad') || situacao.includes('desert') || situacao.includes('fracass')) return 'encerrado';
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
    codigoUnidade: unidade.codigoUnidade ? String(unidade.codigoUnidade) : '',
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
    situacaoCor: status === 'homologado' ? 'verde' : status === 'suspenso' ? 'amarelo' : status === 'encerrado' ? 'cinza' : 'azul',
    status,
    srp: Boolean(item.srp),
    modoDisputa: '',
    tipoEdital: item.tipo_instrumento || 'Edital',
    link: item.link_sistema_origem || item.link_comprasnet || '',
    linkPncp,
    informacaoComplementar: '',
  };
}

function mapRawParaCache(raw: Record<string, unknown>): Record<string, unknown> | null {
  const orgao = (raw.orgaoEntidade as Record<string, unknown>) || {};
  const unidade = (raw.unidadeOrgao as Record<string, unknown>) || {};
  const numeroControle = (raw.numeroControlePNCP as string) || null;
  if (!numeroControle) return null;
  return {
    pncp_id: numeroControle,
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

function aplicarFiltroSituacao<T extends { status: string }>(items: T[], situacao: string): T[] {
  if (situacao === 'abertas') return items.filter((i) => i.status === 'aberto' || i.status === 'aguardando');
  if (situacao === 'encerradas') return items.filter((i) => i.status === 'encerrado');
  return items;
}

function formatIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function createServiceClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Variáveis de ambiente do Supabase não configuradas');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function salvarNoCache(rawItems: Record<string, unknown>[]): Promise<void> {
  if (rawItems.length === 0) return;
  try {
    const sc = createServiceClient();
    const mapped = rawItems.map(mapRawParaCache).filter(Boolean) as Record<string, unknown>[];
    // Deduplica por fonte_id antes de upsert
    const dedupMap = new Map<string, Record<string, unknown>>();
    for (const item of mapped) dedupMap.set(String(item.fonte_id), item);
    const itens = [...dedupMap.values()];
    if (itens.length === 0) return;
    // ignoreDuplicates:true gera ON CONFLICT DO NOTHING — compatível com índice parcial
    const { error } = await sc.from('pncp_editais_cache').upsert(itens, { ignoreDuplicates: true });
    if (error) console.warn('Cache write error:', error.message);
    else console.log(`Cache: ${itens.length} itens salvos`);
  } catch (e: any) {
    console.warn('Cache write exception:', e?.message || e);
  }
}

async function buscarNoCache(params: BuscaParams, cors: HeadersInit): Promise<Response> {
  const sc = createServiceClient();

  const queryRpc = async (dataInicio: string | null, dataFim: string | null) =>
    sc.rpc('busca_editais_instantanea', {
      p_q: params.termo || null,
      p_uf: params.uf || null,
      p_municipio_ibge: null,
      p_esfera: params.esfera || null,
      p_modalidade_id: params.modalidade && params.modalidade !== 'all' && params.modalidade !== '0'
        ? Number(params.modalidade) : null,
      p_segmento: null,
      p_data_inicio: dataInicio,
      p_data_fim: dataFim,
      p_ordenacao: params.situacao === 'abertas' ? 'data_abertura' : 'data_publicacao',
      p_direcao: 'desc',
      p_pagina: 1,
      p_tamanho: CACHE_SAMPLE,
    });

  // Tenta com filtro de data primeiro
  let { data, error } = await queryRpc(params.dataInicial || null, params.dataFinal || null);
  if (error) throw error;

  // Se não encontrou nada com filtro de data, abre para todos os registros do cache
  // (PNCP está fora do ar — melhor mostrar dados retroativos do que tela vazia)
  if (!data || data.length === 0) {
    const r2 = await queryRpc(null, null);
    if (!r2.error) data = r2.data;
  }

  if (error) throw error;

  const mapped = aplicarFiltroSituacao(
    ((data || []) as Record<string, unknown>[]).map(mapearItemCache),
    params.situacao,
  );
  const inicio = (params.pagina - 1) * params.tamanhoPagina;

  return new Response(JSON.stringify({
    data: mapped.slice(inicio, inicio + params.tamanhoPagina),
    total: mapped.length,
    paginas: Math.max(1, Math.ceil(mapped.length / params.tamanhoPagina)),
    pagina: params.pagina,
    cache: true,
    aviso: 'PNCP temporariamente indisponível — exibindo dados do cache local.',
  }), { headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  let parsedBody: Record<string, unknown> = {};

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
      uasgs,
    } = parsedBody;
    // Códigos UASG para filtro server-side (garante paginação correta)
    const uasgCodes: string[] = Array.isArray(uasgs) ? uasgs.map(String) : [];

    const hoje = new Date();
    const pageSize = Math.max(10, Math.min(Number(tamanhoPagina) || 20, 50));
    const paginaAtual = Math.max(1, Number(pagina) || 1);

    const inicio90 = new Date(hoje);
    inicio90.setDate(inicio90.getDate() - 90);

    const dataInicialFiltro = dataInicial || formatIsoDate(inicio90);
    const dataFinalFiltro = dataFinal || formatIsoDate(hoje);
    const modalidadeFiltro = modalidade ? String(modalidade) : '';
    const esferaFiltro = esfera && esfera !== 'all' ? String(esfera) : '';

    const buscaParams: BuscaParams = {
      termo, uf, pagina: paginaAtual, tamanhoPagina: pageSize,
      dataInicial: dataInicialFiltro, dataFinal: dataFinalFiltro,
      modalidade: modalidadeFiltro, situacao, esfera: esferaFiltro,
    };

    // Quando UASG é fornecido sem UF: descobre o estado da UASG via cache
    // para evitar a busca nacional (que retorna 1000 itens de todo o Brasil
    // e pode deixar de fora editais de UASGs menos recentes).
    let ufEfetiva = uf;
    if (uasgCodes.length > 0 && !uf) {
      try {
        const sc = createServiceClient();
        const { data: uasgRows } = await sc
          .from('pncp_editais_cache')
          .select('uf, cnpj_orgao')
          .in('codigo_unidade', uasgCodes)
          .not('uf', 'is', null)
          .limit(5);
        if (uasgRows && uasgRows.length > 0) {
          const ufs = [...new Set(uasgRows.map((r: any) => r.uf).filter(Boolean))];
          if (ufs.length === 1) {
            // UASG encontrada em um único estado: usa esse UF para busca direcionada
            ufEfetiva = ufs[0] as string;
            console.log(`UASG ${uasgCodes.join(',')} → UF detectada: ${ufEfetiva}`);
          }
        }
      } catch (e: any) {
        console.warn('Falha ao detectar UF da UASG via cache:', e?.message);
      }
    }

    const pncpHeaders = {
      'Accept': 'application/json',
      'User-Agent': 'Praefectus/1.0 (licitacoes@praefectus.com.br)',
    };

    // ── Busca sem modalidade: chama 6 modalidades em paralelo ──
    if (!modalidadeFiltro || modalidadeFiltro === 'all' || modalidadeFiltro === '0') {
      const MODALIDADES_COMUNS = [6, 4, 8, 9, 5, 7];

      const fetchModalidade = async (modId: number) => {
        // PNCP permite até 500 por página. Buscamos página 1 com 500 itens;
        // se vier cheia, buscamos a página 2 em seguida para cobrir mais resultados.
        const buildParams = (pagina: number) => {
          const p = new URLSearchParams({ pagina: String(pagina), tamanhoPagina: '500' });
          if (termo) p.set('q', termo);
          if (ufEfetiva) p.set('uf', ufEfetiva.toUpperCase());
          if (esferaFiltro) p.set('codigoEsfera', esferaFiltro);
          p.set('codigoModalidadeContratacao', String(modId));
          p.set('dataInicial', dataInicialFiltro.replace(/-/g, ''));
          p.set('dataFinal', dataFinalFiltro.replace(/-/g, ''));
          return p;
        };

        const baseUrl = `${PNCP_BASE}/contratacoes/publicacao`;
        const resp1 = await fetch(`${baseUrl}?${buildParams(1)}`, {
          headers: pncpHeaders,
          signal: AbortSignal.timeout(25_000),
        });
        if (!resp1.ok) return { mapped: [], raw: [], ok: false };
        const json1 = await resp1.json();
        const rawItems: Record<string, unknown>[] = json1.data || [];

        // Se a página 1 veio cheia, busca a página 2 também
        if (rawItems.length >= 500) {
          try {
            const resp2 = await fetch(`${baseUrl}?${buildParams(2)}`, {
              headers: pncpHeaders,
              signal: AbortSignal.timeout(25_000),
            });
            if (resp2.ok) {
              const json2 = await resp2.json();
              rawItems.push(...(json2.data || []));
            }
          } catch (_) { /* ignora timeout na página 2 */ }
        }

        return { mapped: rawItems.map(mapearItem), raw: rawItems, ok: true };
      };

      const settled = await Promise.allSettled(MODALIDADES_COMUNS.map(fetchModalidade));
      const allItems: ReturnType<typeof mapearItem>[] = [];
      const allRaw: Record<string, unknown>[] = [];
      let successCount = 0;

      for (const r of settled) {
        if (r.status === 'fulfilled') {
          allItems.push(...r.value.mapped);
          allRaw.push(...r.value.raw);
          if (r.value.ok) successCount++;
        }
      }

      if (allItems.length > 0) {
        // PNCP funcionou — salva no cache e retorna dados ao vivo
        await salvarNoCache(allRaw);
        let filtrados = aplicarFiltroSituacao(allItems, situacao);
        // Aplica filtro de UASG server-side para que paginação reflita contagem correta
        if (uasgCodes.length > 0) {
          filtrados = filtrados.filter(i => uasgCodes.includes(String(i.codigoUnidade || '')));
        }
        filtrados.sort((a, b) => new Date(b.dataPublicacao || '').getTime() - new Date(a.dataPublicacao || '').getTime());
        const inicio = (paginaAtual - 1) * pageSize;
        return new Response(JSON.stringify({
          data: filtrados.slice(inicio, inicio + pageSize),
          total: filtrados.length,
          paginas: Math.max(1, Math.ceil(filtrados.length / pageSize)),
          pagina: paginaAtual,
        }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      if (successCount === 0) {
        // PNCP completamente indisponível — tenta cache
        console.warn('PNCP indisponível (todas as modalidades falharam), tentando cache');
        try {
          return await buscarNoCache(buscaParams, cors);
        } catch (cacheErr) {
          console.error('Cache fallback error:', cacheErr);
          return new Response(JSON.stringify({
            error: 'O PNCP está temporariamente indisponível e o cache ainda não possui dados para este período.',
            data: [], total: 0, paginas: 0,
          }), { headers: { ...cors, 'Content-Type': 'application/json' } });
        }
      }

      // PNCP respondeu mas não há editais no período — retorna vazio legítimo
      return new Response(JSON.stringify({
        data: [], total: 0, paginas: 1, pagina: paginaAtual,
      }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // ── Busca com modalidade específica ──
    const params = new URLSearchParams({
      pagina: String(paginaAtual),
      tamanhoPagina: String(pageSize),
    });
    if (termo) params.set('q', termo);
    if (ufEfetiva) params.set('uf', ufEfetiva.toUpperCase());
    if (esferaFiltro) params.set('codigoEsfera', esferaFiltro);
    params.set('codigoModalidadeContratacao', modalidadeFiltro);
    params.set('dataInicial', dataInicialFiltro.replace(/-/g, ''));
    params.set('dataFinal', dataFinalFiltro.replace(/-/g, ''));

    const resp = await fetch(`${PNCP_BASE}/contratacoes/publicacao?${params}`, {
      headers: pncpHeaders,
      signal: AbortSignal.timeout(45_000),
    });

    if (!resp.ok) {
      console.warn(`PNCP error HTTP ${resp.status}, tentando cache`);
      try {
        return await buscarNoCache(buscaParams, cors);
      } catch (cacheErr) {
        console.error('Cache fallback error:', cacheErr);
        return new Response(JSON.stringify({
          error: 'O PNCP está temporariamente indisponível e o cache ainda não possui dados para este período.',
          data: [], total: 0, paginas: 0,
        }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      }
    }

    const json = await resp.json();
    const items: Record<string, unknown>[] = json.data || [];

    // Salva no cache e retorna ao vivo
    await salvarNoCache(items);
    const mapeados = items.map(mapearItem);
    let resultado = aplicarFiltroSituacao(mapeados, situacao);
    if (uasgCodes.length > 0) {
      resultado = resultado.filter(i => uasgCodes.includes(String(i.codigoUnidade || '')));
    }
    const filteredCount = resultado.length;
    const totalOriginal = json.totalRegistros || items.length;

    return new Response(JSON.stringify({
      data: resultado,
      total: uasgCodes.length > 0 ? filteredCount : (situacao === 'todas' ? totalOriginal : filteredCount),
      paginas: situacao === 'todas'
        ? (json.totalPaginas || Math.ceil(totalOriginal / pageSize))
        : Math.max(1, Math.ceil(filteredCount / pageSize)),
      pagina: paginaAtual,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('busca-licitacoes error:', err);
    // Timeout — tenta cache antes de desistir
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('timed out');
    if (isTimeout) {
      try {
        const hoje = new Date();
        const inicio90 = new Date(hoje);
        inicio90.setDate(inicio90.getDate() - 90);
        return await buscarNoCache({
          termo: String(parsedBody.termo || ''),
          uf: String(parsedBody.uf || ''),
          pagina: Math.max(1, Number(parsedBody.pagina) || 1),
          tamanhoPagina: Math.max(10, Math.min(Number(parsedBody.tamanhoPagina) || 20, 50)),
          dataInicial: String(parsedBody.dataInicial || formatIsoDate(inicio90)),
          dataFinal: String(parsedBody.dataFinal || formatIsoDate(hoje)),
          modalidade: parsedBody.modalidade ? String(parsedBody.modalidade) : '',
          situacao: String(parsedBody.situacao || 'abertas'),
          esfera: String(parsedBody.esfera || ''),
        }, cors);
      } catch (cacheErr) {
        console.error('Cache fallback error:', cacheErr);
      }
    }
    return new Response(JSON.stringify({
      error: isTimeout
        ? 'O PNCP demorou para responder. Tente novamente.'
        : 'O PNCP está temporariamente indisponível. Tente novamente em alguns instantes.',
      data: [], total: 0, paginas: 0,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
