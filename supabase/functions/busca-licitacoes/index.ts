// @ts-nocheck
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

function aplicarFiltroSituacao<T extends { status: string }>(items: T[], situacao: string): T[] {
  if (situacao === 'abertas') {
    return items.filter((item) => item.status === 'aberto' || item.status === 'aguardando');
  }
  if (situacao === 'encerradas') {
    return items.filter((item) => item.status === 'encerrado');
  }
  return items;
}

function formatIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const ERRO_PNCP = JSON.stringify({
  error: 'O PNCP está temporariamente indisponível. Tente novamente em alguns instantes.',
  data: [],
  total: 0,
  paginas: 0,
});

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  try {
    const parsedBody = await req.json();
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

    const inicio30 = new Date(hoje);
    inicio30.setDate(inicio30.getDate() - 30);

    const dataInicialFiltro = dataInicial || formatIsoDate(inicio30);
    const dataFinalFiltro = dataFinal || formatIsoDate(hoje);
    const modalidadeFiltro = modalidade ? String(modalidade) : '';
    const esferaFiltro = esfera && esfera !== 'all' ? String(esfera) : '';

    const pncpHeaders = {
      'Accept': 'application/json',
      'User-Agent': 'Praefectus/1.0 (licitacoes@praefectus.com.br)',
    };

    // Busca sem modalidade específica: chama as 6 modalidades mais comuns em paralelo
    if (!modalidadeFiltro || modalidadeFiltro === 'all' || modalidadeFiltro === '0') {
      const MODALIDADES_COMUNS = [6, 4, 8, 9, 5, 7];

      const fetchModalidade = async (modId: number): Promise<{
        mapped: ReturnType<typeof mapearItem>[];
        success: boolean;
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
          headers: pncpHeaders,
          signal: AbortSignal.timeout(25_000),
        });
        if (!resp.ok) return { mapped: [], success: false };
        const json = await resp.json();
        return {
          mapped: ((json.data || []) as Record<string, unknown>[]).map(mapearItem),
          success: true,
        };
      };

      const settled = await Promise.allSettled(MODALIDADES_COMUNS.map(fetchModalidade));
      const allItems: ReturnType<typeof mapearItem>[] = [];
      let successCount = 0;

      for (const r of settled) {
        if (r.status === 'fulfilled') {
          allItems.push(...r.value.mapped);
          if (r.value.success) successCount++;
        }
      }

      // Se todas as modalidades falharam, PNCP está indisponível
      if (successCount === 0) {
        return new Response(ERRO_PNCP, {
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      const filtrados = aplicarFiltroSituacao(allItems, situacao);
      filtrados.sort((a, b) =>
        new Date(b.dataPublicacao || '').getTime() - new Date(a.dataPublicacao || '').getTime()
      );
      const inicio = (paginaAtual - 1) * pageSize;

      return new Response(JSON.stringify({
        data: filtrados.slice(inicio, inicio + pageSize),
        total: filtrados.length,
        paginas: Math.max(1, Math.ceil(filtrados.length / pageSize)),
        pagina: paginaAtual,
      }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Busca com modalidade específica: chama PNCP diretamente
    const params = new URLSearchParams({
      pagina: String(paginaAtual),
      tamanhoPagina: String(pageSize),
    });
    if (termo) params.set('q', termo);
    if (uf) params.set('uf', uf.toUpperCase());
    if (esferaFiltro) params.set('codigoEsfera', esferaFiltro);
    params.set('codigoModalidadeContratacao', modalidadeFiltro);
    params.set('dataInicial', dataInicialFiltro.replace(/-/g, ''));
    params.set('dataFinal', dataFinalFiltro.replace(/-/g, ''));

    const resp = await fetch(`${PNCP_BASE}/contratacoes/publicacao?${params}`, {
      headers: pncpHeaders,
      signal: AbortSignal.timeout(45_000),
    });

    if (!resp.ok) {
      console.error(`PNCP error ${resp.status}`);
      return new Response(ERRO_PNCP, {
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
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('busca-licitacoes error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('timed out');
    return new Response(JSON.stringify({
      error: isTimeout
        ? 'O PNCP demorou para responder. Tente novamente.'
        : 'O PNCP está temporariamente indisponível. Tente novamente em alguns instantes.',
      data: [],
      total: 0,
      paginas: 0,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
