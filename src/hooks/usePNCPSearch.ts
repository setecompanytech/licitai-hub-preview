import { useState, useCallback, useRef, useMemo } from "react";
import {
  MODALIDADE_PNCP,
  ESFERA_PNCP,
  INSTRUMENTO_PNCP,
  MUNICIPIO_IBGE,
  PNCP_BASE_URL,
} from "@/constants/pncpMappings";

export type FiltrosPNCP = {
  q: string;
  modalidade: string;
  tipoInstrumento: string;
  uf: string;
  municipio: string;
  esfera: string;
  orgao: string;
  unidade: string;
  portalOrigem: string;
  dataInicio: string;
  dataFim: string;
  pagina: number;
  ordenacao: "publicacao" | "abertura";
  direcao: "desc" | "asc";
};

export type ResultadoPNCP = {
  items: any[];
  total: number;
  pagina: number;
  totalPaginas: number;
};

const ITENS_POR_PAGINA = 20;

const FILTROS_PADRAO: FiltrosPNCP = {
  q: "",
  modalidade: "Todos",
  tipoInstrumento: "Todos",
  uf: "",
  municipio: "",
  esfera: "Todos",
  orgao: "",
  unidade: "",
  portalOrigem: "Todos os portais",
  dataInicio: "",
  dataFim: "",
  pagina: 1,
  ordenacao: "publicacao",
  direcao: "desc",
};

export const usePNCPSearch = () => {
  const [filtros, setFiltros] = useState<FiltrosPNCP>({ ...FILTROS_PADRAO });
  const [resultado, setResultado] = useState<ResultadoPNCP>({
    items: [],
    total: 0,
    pagina: 1,
    totalPaginas: 0,
  });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Contagem de filtros ativos ──
  const filtrosAtivos = useMemo(() => {
    return [
      filtros.q.trim() !== "",
      filtros.modalidade !== "Todos",
      filtros.tipoInstrumento !== "Todos",
      filtros.uf !== "",
      filtros.municipio !== "",
      filtros.esfera !== "Todos",
      filtros.orgao.trim() !== "",
      filtros.unidade.trim() !== "",
      filtros.portalOrigem !== "Todos os portais",
      filtros.dataInicio !== "",
      filtros.dataFim !== "",
    ].filter(Boolean).length;
  }, [filtros]);

  // ── Builder da URL PNCP (chamada direta à API pública) ──
  const buildPNCPUrl = useCallback((f: FiltrosPNCP): string => {
    const endpoint = `${PNCP_BASE_URL}/contratacoes/publicacao`;
    const params = new URLSearchParams();

    // Datas (obrigatório pelo PNCP — padrão: últimos 30 dias)
    const hoje = new Date();
    const dataFimDefault = hoje.toISOString().split("T")[0].replace(/-/g, "");
    const dataInicioDefault = new Date(hoje.getTime() - 30 * 86400000)
      .toISOString()
      .split("T")[0]
      .replace(/-/g, "");

    params.set(
      "dataInicial",
      f.dataInicio ? f.dataInicio.replace(/-/g, "") : dataInicioDefault
    );
    params.set(
      "dataFinal",
      f.dataFim ? f.dataFim.replace(/-/g, "") : dataFimDefault
    );

    // Paginação
    params.set("pagina", String(f.pagina));
    params.set("tamanhoPagina", String(ITENS_POR_PAGINA));

    // UF
    if (f.uf && f.uf !== "" && f.uf !== "Todos") {
      params.set("uf", f.uf.toUpperCase());
    }

    // Modalidade (código numérico)
    const codigoModalidade = MODALIDADE_PNCP[f.modalidade];
    if (codigoModalidade && codigoModalidade > 0) {
      params.set("codigoModalidadeContratacao", String(codigoModalidade));
    }

    // Município (código IBGE)
    if (f.municipio && f.municipio !== "") {
      const codigoIBGE = MUNICIPIO_IBGE[f.municipio];
      if (codigoIBGE) {
        params.set("codigoMunicipio", codigoIBGE);
      }
    }

    // Tipo de instrumento
    const codigoInstrumento = INSTRUMENTO_PNCP[f.tipoInstrumento];
    if (codigoInstrumento && codigoInstrumento > 0) {
      params.set("codigoTipoInstrumentoConvocatorio", String(codigoInstrumento));
    }

    // Ordenação
    if (f.ordenacao === "abertura") {
      params.set("ordenacao", "dataAberturaLances");
    }

    return `${endpoint}?${params.toString()}`;
  }, []);

  // ── Filtro client-side (pós-API) ──
  // PNCP não suporta filtro de esfera, orgao e texto livre na query principal.
  const filtrarClientSide = useCallback(
    (items: any[], f: FiltrosPNCP): any[] => {
      let resultado = [...items];

      // Filtro de esfera (F/E/M/D)
      const esferaCodigo = ESFERA_PNCP[f.esfera];
      if (esferaCodigo) {
        resultado = resultado.filter(
          (item) =>
            item.orgaoEntidade?.esferaId === esferaCodigo ||
            item.unidadeOrgao?.esferaId === esferaCodigo ||
            item.esfera_id === esferaCodigo ||
            item.esferaNome?.toLowerCase() === f.esfera.toLowerCase()
        );
      }

      // Filtro de órgão (busca parcial no nome)
      if (f.orgao.trim()) {
        const orgaoNorm = f.orgao
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{Mn}/gu, "");
        resultado = resultado.filter((item) => {
          const orgaoNome = (
            item.orgaoEntidade?.razaoSocial ||
            item.orgao ||
            ""
          )
            .toLowerCase()
            .normalize("NFD")
            .replace(/\p{Mn}/gu, "");
          return orgaoNome.includes(orgaoNorm);
        });
      }

      // Filtro de unidade
      if (f.unidade.trim()) {
        const unidadeNorm = f.unidade
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{Mn}/gu, "");
        resultado = resultado.filter((item) => {
          const unidadeNome = (
            item.unidadeOrgao?.nomeUnidade ||
            item.unidadeOrgao ||
            ""
          )
            .toLowerCase()
            .normalize("NFD")
            .replace(/\p{Mn}/gu, "");
          return unidadeNome.includes(unidadeNorm);
        });
      }

      // Filtro de texto livre no objeto
      if (f.q.trim()) {
        const qNorm = f.q
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{Mn}/gu, "");
        resultado = resultado.filter((item) => {
          const objeto = (item.objetoCompra || item.objeto || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/\p{Mn}/gu, "");
          const orgao = (
            item.orgaoEntidade?.razaoSocial ||
            item.orgao ||
            ""
          )
            .toLowerCase()
            .normalize("NFD")
            .replace(/\p{Mn}/gu, "");
          return objeto.includes(qNorm) || orgao.includes(qNorm);
        });
      }

      return resultado;
    },
    []
  );

  // ── Executar busca direta na API PNCP ──
  const buscar = useCallback(
    async (filtrosOverride?: Partial<FiltrosPNCP>) => {
      const f = filtrosOverride
        ? { ...filtros, ...filtrosOverride, pagina: 1 }
        : filtros;

      // Cancelar requisição anterior
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();

      setLoading(true);
      setErro(null);

      try {
        const url = buildPNCPUrl(f);
        console.log("[PRAEFECTUS/PNCP] Buscando:", url);

        const resp = await fetch(url, {
          signal: abortRef.current.signal,
          headers: { Accept: "application/json" },
        });

        if (!resp.ok) {
          throw new Error(`PNCP API retornou HTTP ${resp.status}`);
        }

        const data = await resp.json();
        const items = data?.data ?? [];
        const total = data?.totalRegistros ?? items.length;

        // Aplicar filtros client-side
        const itensFiltrados = filtrarClientSide(items, f);

        setResultado({
          items: itensFiltrados,
          total:
            itensFiltrados.length < items.length
              ? itensFiltrados.length
              : total,
          pagina: f.pagina,
          totalPaginas: Math.ceil(
            (itensFiltrados.length < items.length
              ? itensFiltrados.length
              : total) / ITENS_POR_PAGINA
          ),
        });
        setUltimaAtualizacao(new Date());
      } catch (e: any) {
        if (e.name === "AbortError") return;
        console.error("[PRAEFECTUS/PNCP] Erro:", e);
        setErro(
          e.message?.includes("403") || e.message?.includes("429")
            ? "O portal PNCP está temporariamente bloqueando requisições. Aguarde alguns segundos e tente novamente."
            : e.message?.includes("404")
              ? "Nenhum resultado encontrado para os filtros selecionados."
              : "Falha ao conectar com a API PNCP. Verifique sua conexão."
        );
        setResultado({ items: [], total: 0, pagina: 1, totalPaginas: 0 });
      } finally {
        setLoading(false);
      }
    },
    [filtros, buildPNCPUrl, filtrarClientSide]
  );

  // ── Atualizar filtros ──
  const atualizarFiltros = useCallback(
    (novosFiltros: Partial<FiltrosPNCP>) => {
      setFiltros((prev) => ({ ...prev, ...novosFiltros, pagina: 1 }));
    },
    []
  );

  const limparFiltros = useCallback(() => {
    setFiltros({ ...FILTROS_PADRAO });
  }, []);

  const irParaPagina = useCallback((pagina: number) => {
    setFiltros((prev) => ({ ...prev, pagina }));
  }, []);

  return {
    filtros,
    resultado,
    loading,
    erro,
    filtrosAtivos,
    ultimaAtualizacao,
    buscar,
    atualizarFiltros,
    limparFiltros,
    irParaPagina,
    filtrarClientSide,
    buildPNCPUrl,
    ITENS_POR_PAGINA,
  };
};
