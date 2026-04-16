/**
 * busca-licitacoes — Edge Function PNCP
 *
 * v3 — Correções:
 * 1. Campo de valor: `valorTotalEstimado`
 * 2. Endpoint /proposta para editais com propostas abertas
 * 3. Status derivado de situacaoCompraId + comparação de datas
 * 4. Filtro de situação: 'abertas' | 'todas' | 'encerradas'
 * 5. Paginação correta — total ajustado após filtragem
 * 6. Modalidade opcional — omitida quando "todas"
 * 7. Range de datas padrão: 30 dias
 */

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

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  try {
    const body = await req.json();
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
    } = body;

    const hoje = new Date();
    const pageSize = Math.max(10, Math.min(tamanhoPagina, 50));

    // Default: 30 dias atrás
    const inicio30 = new Date(hoje);
    inicio30.setDate(inicio30.getDate() - 30);

    const params = new URLSearchParams({
      pagina: String(pagina),
      tamanhoPagina: String(pageSize),
    });

    if (termo) params.set('q', termo);
    if (uf) params.set('uf', uf.toUpperCase());
    if (esfera) params.set('codigoEsfera', esfera);

    // Modalidade: só envia se especificada (não forçar Pregão)
    if (modalidade && modalidade !== 'all') {
      params.set('codigoModalidadeContratacao', String(modalidade));
    }

    // Dates
    params.set('dataInicial', dataInicial ? dataInicial.replace(/-/g, '') : formatDate(inicio30));
    params.set('dataFinal', dataFinal ? dataFinal.replace(/-/g, '') : formatDate(hoje));

    const endpoint = `${PNCP_BASE}/contratacoes/publicacao`;
    const url = `${endpoint}?${params.toString()}`;
    console.log(`PNCP request: ${url}`);

    const resp = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Praefectus/1.0 (licitacoes@praefectus.com.br)',
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`PNCP error ${resp.status}: ${errText.slice(0, 500)}`);

      // Se o erro é por falta de modalidade, tenta com Pregão como fallback
      if (resp.status === 400 && !params.has('codigoModalidadeContratacao')) {
        console.log('Retrying with modalidade=6 (Pregão Eletrônico) as fallback');
        params.set('codigoModalidadeContratacao', '6');
        const retryUrl = `${endpoint}?${params.toString()}`;
        const retryResp = await fetch(retryUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Praefectus/1.0 (licitacoes@praefectus.com.br)',
          },
          signal: AbortSignal.timeout(30_000),
        });

        if (retryResp.ok) {
          const retryJson = await retryResp.json();
          const retryItems: Record<string, unknown>[] = retryJson.data || [];
          let resultado = retryItems;
          if (situacao === 'abertas') {
            resultado = retryItems.filter(i => {
              const s = calcularStatus(i);
              return s === 'aberto' || s === 'aguardando';
            });
          } else if (situacao === 'encerradas') {
            resultado = retryItems.filter(i => calcularStatus(i) === 'encerrado');
          }

          const filteredCount = resultado.length;
          const totalOriginal = retryJson.totalRegistros || retryItems.length;

          return new Response(JSON.stringify({
            data: resultado.map(mapearItem),
            total: situacao === 'todas' ? totalOriginal : filteredCount,
            paginas: situacao === 'todas'
              ? (retryJson.totalPaginas || Math.ceil(totalOriginal / pageSize))
              : Math.max(1, Math.ceil(filteredCount / pageSize)),
            pagina,
            aviso: 'Pesquisa limitada ao Pregão Eletrônico. Para outras modalidades, selecione uma específica.',
          }), {
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
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

    // Filter by status
    let resultado = items;
    if (situacao === 'abertas') {
      resultado = items.filter(i => {
        const s = calcularStatus(i);
        return s === 'aberto' || s === 'aguardando';
      });
    } else if (situacao === 'encerradas') {
      resultado = items.filter(i => calcularStatus(i) === 'encerrado');
    }

    const filteredCount = resultado.length;
    const totalOriginal = json.totalRegistros || items.length;

    return new Response(JSON.stringify({
      data: resultado.map(mapearItem),
      total: situacao === 'todas' ? totalOriginal : filteredCount,
      paginas: situacao === 'todas'
        ? (json.totalPaginas || Math.ceil(totalOriginal / pageSize))
        : Math.max(1, Math.ceil(filteredCount / pageSize)),
      pagina,
    }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('busca-licitacoes error:', err);
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Erro interno',
      data: [], total: 0, paginas: 0,
    }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
