import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeUfs } from "@/constants/ufsBrasil";
import {
  ChevronDown, ChevronUp, Download, FileText,
  Search, X, AlertTriangle, ExternalLink,
} from "lucide-react";

// ── CONSTANTES DE MAPEAMENTO ────────────────────────────────
const MAP_ESFERA: Record<string, string> = {
  "Todas": "", "Federal": "F", "Estadual": "E",
  "Municipal": "M", "Distrital": "D",
};
// Modalidades conforme Lei 14.133/2021 (Art. 28)
const MAP_MODALIDADE: Record<string, number> = {
  "Todas": 0, "Pregão Eletrônico": 6, "Concorrência": 4,
  "Concurso": 3, "Leilão": 1, "Diálogo Competitivo": 2,
  "Dispensa de Licitação": 8, "Inexigibilidade": 9,
  "Credenciamento": 12,
};
const UFS_BRASIL = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO",
  "MA","MG","MS","MT","PA","PB","PE","PI","PR",
  "RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];
const ITENS_POR_PAGINA = 10;

// ── TIPOS ───────────────────────────────────────────────────
type Edital = {
  id: string;
  numero_controle_pncp: string;
  modalidade_nome: string;
  numero_compra: string;
  ano_compra: string;
  srp: boolean;
  orgao: string;
  esfera_id: string;
  unidade_orgao: string;
  uf: string;
  municipio: string;
  objeto: string;
  valor_total_estimado: number | null;
  data_publicacao_pncp: string;
  data_abertura_proposta: string;
  data_encerramento_proposta: string;
  url_pncp: string;
  link_sistema_origem: string;
  situacao: string;
  total_count: number;
};

type Filtros = {
  termo: string;
  uf: string;
  municipioNome: string;
  municipioIbge: string;
  esfera: string;
  modalidade: string;
  uasg: string;
  dataInicio: string;
  dataFim: string;
  pagina: number;
};

// ── COMPONENTE CARD DE EDITAL (padrão ComprasNet) ───────────
const CardEdital = ({
  numero, edital, onVerItens
}: {
  numero: number;
  edital: Edital;
  onVerItens: (edital: Edital) => void;
}) => {
  const dataAbertura = edital.data_abertura_proposta
    ? new Date(edital.data_abertura_proposta)
    : null;

  const dataEncerramento = edital.data_encerramento_proposta
    ? new Date(edital.data_encerramento_proposta)
    : null;

  const agora = new Date();

  // Urgente: faltam menos de 24h para o ENCERRAMENTO das propostas
  const horasAteEncerramento = dataEncerramento
    ? (dataEncerramento.getTime() - agora.getTime()) / 3600000
    : null;

  const urgente = horasAteEncerramento !== null
    && horasAteEncerramento > 0
    && horasAteEncerramento <= 24;

  // Encerrado: prazo de recebimento de propostas já passou
  const encerrado = dataEncerramento !== null
    ? horasAteEncerramento! <= 0
    : (dataAbertura !== null && (dataAbertura.getTime() - agora.getTime()) / 3600000 <= 0 && edital.situacao?.toLowerCase() !== 'publicado');

  const fmtData = (iso: string) =>
    iso ? new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
    }) : "—";

  const fmtValor = (v: number | null) =>
    v ? new Intl.NumberFormat("pt-BR", {
      style: "currency", currency: "BRL"
    }).format(v) : "Não informado";

  const linkEdital = edital.url_pncp
    || edital.link_sistema_origem
    || (edital.numero_controle_pncp
        ? `https://pncp.gov.br/app/editais/${edital.numero_controle_pncp}`
        : null);

  return (
    <div className="border border-border rounded-md mb-2 overflow-hidden bg-card">
      {/* Cabeçalho com número e município */}
      <div
        className={`flex items-center px-3.5 py-1.5 gap-4 ${
          urgente ? "bg-destructive" : encerrado ? "bg-muted-foreground" : "bg-[hsl(var(--sidebar-background))]"
        }`}
      >
        <span className="bg-white/15 text-white w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0">
          {numero}
        </span>
        <span className="text-white text-[13px] font-semibold flex-1">
          {edital.municipio
            ? `${edital.municipio} — ${edital.uf}`
            : edital.uf || "Brasil"}
        </span>
        {urgente && (
          <span className="bg-destructive text-white text-xs font-bold px-2.5 py-0.5 rounded tracking-wide">
            ⚡ MENOS DE 24H
          </span>
        )}
        {edital.srp && (
          <span className="bg-info text-info-foreground text-xs font-bold px-2.5 py-0.5 rounded">
            SRP
          </span>
        )}
        {encerrado && (
          <span className="bg-muted-foreground text-white text-xs px-2.5 py-0.5 rounded">
            ENCERRADO
          </span>
        )}
      </div>

      {/* Corpo do card */}
      <div className="p-3.5 pt-3">
        {/* Hierarquia do órgão */}
        <div className="mb-2.5">
          <div className="text-sm font-bold text-foreground mb-0.5">
            {edital.orgao || "Órgão não informado"}
          </div>
          {edital.unidade_orgao && edital.unidade_orgao !== edital.orgao && (
            <div className="text-xs text-muted-foreground">
              {edital.unidade_orgao}
            </div>
          )}
          {edital.numero_controle_pncp && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Código de Controle PNCP: {edital.numero_controle_pncp}
            </div>
          )}
        </div>

        {/* Número do processo e modalidade */}
        <div className="mb-2">
          <span
            className="text-[13px] font-bold text-primary underline cursor-pointer"
            onClick={() => linkEdital && window.open(linkEdital, "_blank")}
          >
            {edital.modalidade_nome || "Licitação"} Nº{" "}
            {edital.numero_compra}/{edital.ano_compra}
          </span>
          {edital.url_pncp && (
            <span className="text-xs text-muted-foreground ml-2">
              (Lei nº 14.133/2021)
            </span>
          )}
        </div>

        {/* Objeto */}
        <div className="mb-2.5">
          <span className="text-[13px] text-foreground font-bold">Objeto: </span>
          <span className="text-[13px] text-foreground leading-relaxed">
            {edital.objeto || "—"}
          </span>
        </div>

        {/* Campos estruturados */}
        <table className="w-full text-xs mb-3 border-collapse">
          <tbody>
            <tr>
              <td className="py-0.5 text-foreground font-bold w-[30%] align-top">
                Edital a partir de:
              </td>
              <td className="py-0.5 text-foreground">
                {fmtData(edital.data_publicacao_pncp)}
              </td>
              <td className="py-0.5 pl-6 text-foreground font-bold w-[30%] align-top">
                Valor Estimado:
              </td>
              <td className="py-0.5 text-foreground">
                {fmtValor(edital.valor_total_estimado)}
              </td>
            </tr>
            <tr>
              <td className="py-0.5 text-foreground font-bold">Entrega da Proposta:</td>
              <td className="py-0.5 text-foreground">
                {edital.data_abertura_proposta
                  ? `a partir de ${fmtData(edital.data_abertura_proposta)}`
                  : "—"}
              </td>
              <td className="py-0.5 pl-6 text-foreground font-bold">Situação:</td>
              <td className="py-0.5 text-foreground">
                {encerrado
                  ? "Encerrado"
                  : edital.situacao || "Divulgada no PNCP"}
              </td>
            </tr>
            <tr>
              <td className="py-0.5 text-foreground font-bold">Abertura da Proposta:</td>
              <td colSpan={3} className="py-0.5 text-primary font-semibold">
                {dataAbertura
                  ? `em ${fmtData(edital.data_abertura_proposta)}, no endereço: `
                  : "—"}
                {linkEdital && dataAbertura && (
                  <a
                    href={linkEdital}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline text-xs"
                  >
                    {edital.link_sistema_origem || linkEdital}
                  </a>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Linha de ações */}
        <div className="flex gap-2 items-center">
          <button
            onClick={() => onVerItens(edital)}
            className="bg-[hsl(var(--sidebar-background))] text-white border-none px-3.5 py-1.5 rounded text-xs font-bold cursor-pointer flex items-center gap-1.5"
          >
            <Download size={13} />
            Itens e Download
          </button>

          {linkEdital && (
            <a
              href={linkEdital}
              target="_blank"
              rel="noreferrer"
              className="bg-primary text-primary-foreground px-3.5 py-1.5 rounded text-xs font-bold cursor-pointer no-underline flex items-center gap-1.5"
            >
              <ExternalLink size={13} />
              Acessar Edital
            </a>
          )}

          <span className="text-xs text-muted-foreground ml-1">
            Histórico de eventos publicados...
          </span>
        </div>
      </div>
    </div>
  );
};

// ── MODAL ITENS E DOWNLOAD ──────────────────────────────────
const ModalItensDownload = ({
  edital,
  onClose,
}: {
  edital: Edital;
  onClose: () => void;
}) => {
  const linkEdital = edital.url_pncp
    || edital.link_sistema_origem
    || (edital.numero_controle_pncp
        ? `https://pncp.gov.br/app/editais/${edital.numero_controle_pncp}`
        : null);

  const linkArquivos = edital.numero_controle_pncp
    ? `https://pncp.gov.br/app/editais/${edital.numero_controle_pncp}/arquivos`
    : null;

  const fmtValor = (v: number | null) =>
    v ? new Intl.NumberFormat("pt-BR", {
      style: "currency", currency: "BRL"
    }).format(v) : "Não informado";

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-6"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-card rounded-lg w-full max-w-[720px] max-h-[85vh] overflow-auto shadow-2xl"
      >
        {/* Header do modal */}
        <div className="bg-[hsl(var(--sidebar-background))] p-3.5 px-5 flex items-center justify-between rounded-t-lg">
          <div>
            <div className="text-white text-sm font-bold tracking-wide">
              ITENS E DOWNLOAD — {edital.modalidade_nome?.toUpperCase()} Nº{" "}
              {edital.numero_compra}/{edital.ano_compra}
            </div>
            <div className="text-accent text-xs mt-0.5">
              {edital.orgao}
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-white/15 border-none rounded-full w-8 h-8 text-white cursor-pointer flex items-center justify-center text-lg"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {/* Dados do processo */}
          <table className="w-full text-[13px] mb-5 border border-border rounded-md border-collapse">
            <thead>
              <tr className="bg-muted">
                <th colSpan={2} className="px-3 py-2 text-left text-xs font-bold text-foreground border-b border-border">
                  DADOS DO PROCESSO LICITATÓRIO
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Órgão", edital.orgao],
                ["Unidade", edital.unidade_orgao || "—"],
                ["Processo", `${edital.modalidade_nome} Nº ${edital.numero_compra}/${edital.ano_compra}`],
                ["Objeto", edital.objeto],
                ["UF / Município", `${edital.uf}${edital.municipio ? " / " + edital.municipio : ""}`],
                ["Valor Estimado", fmtValor(edital.valor_total_estimado)],
                ["Abertura da Proposta", edital.data_abertura_proposta
                  ? new Date(edital.data_abertura_proposta).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
                  : "—"],
                ["Situação", edital.situacao || "Divulgada no PNCP"],
                ["Nº Controle PNCP", edital.numero_controle_pncp || "—"],
              ].map(([label, value], i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-muted/30" : "bg-card"}>
                  <td className="px-3 py-1.5 font-bold text-foreground w-[32%] border-b border-border/30 text-xs align-top">
                    {label}
                  </td>
                  <td className="px-3 py-1.5 text-foreground border-b border-border/30 text-xs leading-relaxed">
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Seção de downloads */}
          <div className="bg-accent/10 border border-accent/30 rounded-md p-4 mb-4">
            <div className="text-[13px] font-bold text-accent mb-3">
              DOCUMENTOS E ARQUIVOS DO EDITAL
            </div>

            <div className="flex flex-col gap-2">
              {linkEdital && (
                <a
                  href={linkEdital}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3.5 py-2.5 bg-primary text-primary-foreground rounded no-underline text-[13px] font-semibold"
                >
                  <FileText size={15} />
                  Edital Completo e Anexos — PNCP
                  <ExternalLink size={12} className="ml-auto" />
                </a>
              )}

              {linkArquivos && (
                <a
                  href={linkArquivos}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3.5 py-2.5 bg-[hsl(var(--sidebar-background))] text-white rounded no-underline text-[13px] font-semibold"
                >
                  <Download size={15} />
                  Todos os Arquivos do Processo
                  <ExternalLink size={12} className="ml-auto" />
                </a>
              )}

              {edital.link_sistema_origem && edital.link_sistema_origem !== linkEdital && (
                <a
                  href={edital.link_sistema_origem}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3.5 py-2.5 bg-accent text-accent-foreground rounded no-underline text-[13px] font-semibold"
                >
                  <ExternalLink size={15} />
                  Acessar Portal de Origem
                  <ExternalLink size={12} className="ml-auto" />
                </a>
              )}
            </div>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            Os arquivos do edital estão disponíveis no portal oficial.
            Clique nos botões acima para acessar diretamente.
          </div>
        </div>
      </div>
    </div>
  );
};

// ── COMPONENTE PRINCIPAL DA PÁGINA ──────────────────────────
export default function EditaisLicitacoes() {
  const { user } = useAuth();
  const [filtros, setFiltros] = useState<Filtros>({
    termo: "", uf: "", municipioNome: "", municipioIbge: "",
    esfera: "Todas", modalidade: "Todas", uasg: "",
    dataInicio: "", dataFim: "", pagina: 1,
  });
  const [editais, setEditais] = useState<Edital[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [filtrosAbertos, setFiltrosAbertos] = useState(true);
  const [modalEdital, setModalEdital] = useState<Edital | null>(null);
  const [municipios, setMunicipios] = useState<{ id: number; nome: string }[]>([]);
  const [ufsPreferidas, setUfsPreferidas] = useState<string[]>([]);
  const [preferenciasCarregadas, setPreferenciasCarregadas] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const totalPaginas = Math.ceil(total / ITENS_POR_PAGINA);
  const inicioPagina = (filtros.pagina - 1) * ITENS_POR_PAGINA + 1;
  const fimPagina = Math.min(filtros.pagina * ITENS_POR_PAGINA, total);

  useEffect(() => {
    if (!user?.id) {
      setUfsPreferidas([]);
      setPreferenciasCarregadas(true);
      return;
    }

    let ativo = true;

    const carregarPreferencias = async () => {
      const [configResp, alertasResp] = await Promise.all([
        supabase.from('configuracoes').select('ufs_interesse').eq('user_id', user.id).maybeSingle(),
        supabase.from('preferencias_alertas' as any).select('ufs').eq('user_id', user.id).maybeSingle(),
      ]);

      if (!ativo) return;

      const ufs = normalizeUfs([
        ...(configResp.data?.ufs_interesse || []),
        ...(((alertasResp.data as { ufs?: string[] } | null)?.ufs) || []),
      ]);

      setUfsPreferidas(ufs);
      setPreferenciasCarregadas(true);
    };

    carregarPreferencias();

    return () => {
      ativo = false;
    };
  }, [user?.id]);

  // Carregar municípios ao mudar UF
  useEffect(() => {
    if (!filtros.uf) { setMunicipios([]); return; }
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${filtros.uf}/municipios?orderBy=nome`)
      .then(r => r.json())
      .then(data => setMunicipios(data.map((m: any) => ({ id: m.id, nome: m.nome }))))
      .catch(() => setMunicipios([]));
  }, [filtros.uf]);

  // Busca com debounce no termo
  const buscar = useCallback(async (f: Filtros, ufsPreferenciais: string[]) => {
    setLoading(true);
    setErro(null);
    try {
      const ufsAtivas = f.uf ? [f.uf] : ufsPreferenciais;
      const paramsBase = {
        p_q: f.termo.trim() || null,
        p_municipio_ibge: f.municipioIbge || null,
        p_esfera: MAP_ESFERA[f.esfera] || null,
        p_modalidade_id: MAP_MODALIDADE[f.modalidade] || null,
        p_data_inicio: f.dataInicio || null,
        p_data_fim: f.dataFim || null,
      };

      if (!f.uf && ufsAtivas.length > 1) {
        const tamanhoPorUf = Math.max(ITENS_POR_PAGINA, f.pagina * ITENS_POR_PAGINA);
        const respostas = await Promise.all(
          ufsAtivas.map((uf) =>
            supabase.rpc("busca_editais_instantanea", {
              ...paramsBase,
              p_uf: uf,
              p_pagina: 1,
              p_tamanho: tamanhoPorUf,
            })
          )
        );

        const falha = respostas.find((resposta) => resposta.error);
        if (falha?.error) throw falha.error;

        const rowsUnicos = new Map<string, any>();
        let totalAgrupado = 0;

        for (const resposta of respostas) {
          const rows = (resposta.data ?? []) as any[];
          totalAgrupado += Number(rows[0]?.total_count ?? 0);
          rows.forEach((row) => {
            rowsUnicos.set(row.id || row.numero_controle_pncp, row);
          });
        }

        const rowsOrdenados = Array.from(rowsUnicos.values()).sort((a, b) => {
          if (f.termo.trim()) {
            return Number(b.rank_busca ?? 0) - Number(a.rank_busca ?? 0);
          }
          return new Date(b.data_publicacao_pncp || 0).getTime() - new Date(a.data_publicacao_pncp || 0).getTime();
        });

        const inicio = (f.pagina - 1) * ITENS_POR_PAGINA;
        const paginados = rowsOrdenados.slice(inicio, inicio + ITENS_POR_PAGINA);
        setEditais(paginados as Edital[]);
        setTotal(totalAgrupado);
      } else {
        const { data, error } = await supabase.rpc("busca_editais_instantanea", {
          ...paramsBase,
          p_uf: ufsAtivas[0] || null,
          p_pagina: f.pagina,
          p_tamanho: ITENS_POR_PAGINA,
        });
        if (error) throw error;
        const rows = (data ?? []) as any[];
        setEditais(rows as Edital[]);
        setTotal(Number(rows[0]?.total_count ?? 0));
      }
    } catch (e: any) {
      setErro(e.message ?? "Erro na busca");
      setEditais([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!preferenciasCarregadas) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => buscar(filtros, ufsPreferidas),
      filtros.termo ? 400 : 0
    );
    return () => clearTimeout(debounceRef.current);
  }, [filtros, buscar, preferenciasCarregadas, ufsPreferidas]);

  const atualizar = (novos: Partial<Filtros>) =>
    setFiltros(prev => ({ ...prev, ...novos, pagina: 1 }));

  const limpar = () =>
    setFiltros({
      termo: "", uf: "", municipioNome: "", municipioIbge: "",
      esfera: "Todas", modalidade: "Todas", uasg: "",
      dataInicio: "", dataFim: "", pagina: 1,
    });

  const chipsFiltros = [
    filtros.uf && { label: `UF: ${filtros.uf}`, clear: () => atualizar({ uf: "", municipioNome: "", municipioIbge: "" }) },
    filtros.municipioNome && { label: `Município: ${filtros.municipioNome}`, clear: () => atualizar({ municipioNome: "", municipioIbge: "" }) },
    filtros.esfera !== "Todas" && { label: filtros.esfera, clear: () => atualizar({ esfera: "Todas" }) },
    filtros.modalidade !== "Todas" && { label: filtros.modalidade, clear: () => atualizar({ modalidade: "Todas" }) },
    filtros.dataInicio && { label: `De: ${filtros.dataInicio}`, clear: () => atualizar({ dataInicio: "" }) },
    filtros.dataFim && { label: `Até: ${filtros.dataFim}`, clear: () => atualizar({ dataFim: "" }) },
    filtros.uasg && { label: `UASG: ${filtros.uasg}`, clear: () => atualizar({ uasg: "" }) },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  return (
    <div className="py-5 px-6 max-w-[1100px] mx-auto">
      {/* Título da seção */}
      <div className="bg-[hsl(var(--sidebar-background))] text-white px-4 py-2.5 rounded-t-md flex items-center justify-between">
        <span className="text-sm font-bold tracking-wide">
          LICITAÇÕES — BUSCA E MONITORAMENTO
        </span>
        <span className="text-xs text-accent">
          Portal Nacional de Contratações Públicas — PNCP Oficial
        </span>
      </div>

      {/* Painel de Filtros */}
      <div className="border border-border border-t-0 rounded-b-md mb-4 bg-muted/30">
        <button
          onClick={() => setFiltrosAbertos(p => !p)}
          className="w-full px-4 py-2.5 bg-transparent border-none flex items-center justify-between cursor-pointer text-[13px] text-foreground font-semibold"
          style={{ borderBottom: filtrosAbertos ? "1px solid hsl(var(--border))" : "none" }}
        >
          <span className="flex items-center gap-2">
            <Search size={14} />
            FILTROS DE PESQUISA
            {chipsFiltros.length > 0 && (
              <span className="bg-[hsl(var(--sidebar-background))] text-white rounded-full px-2 py-px text-xs">
                {chipsFiltros.length} ativo{chipsFiltros.length > 1 ? "s" : ""}
              </span>
            )}
          </span>
          {filtrosAbertos ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {filtrosAbertos && (
          <div className="p-4">
            {/* Linha 1: Termo + UASG */}
            {!filtros.uf && ufsPreferidas.length > 0 && (
              <div className="mb-3 rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-accent">
                Prioridade automática ativa para as UFs: <strong>{ufsPreferidas.join(', ')}</strong>.
                Selecione uma UF abaixo para sobrescrever esse filtro.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Objeto / Termo de Pesquisa</label>
                <input
                  className="w-full px-2.5 py-1.5 border border-border rounded text-[13px] text-foreground bg-background outline-none"
                  placeholder="Ex: café em pó, informática, limpeza..."
                  value={filtros.termo}
                  onChange={e => atualizar({ termo: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">UASG / CNPJ do Órgão</label>
                <input
                  className="w-full px-2.5 py-1.5 border border-border rounded text-[13px] text-foreground bg-background outline-none"
                  placeholder="Ex: 160160"
                  value={filtros.uasg}
                  onChange={e => atualizar({ uasg: e.target.value })}
                />
              </div>
            </div>

            {/* Linha 2: UF + Município + Esfera + Modalidade */}
            <div className="grid grid-cols-[1fr_2fr_1fr_2fr] gap-3 mb-3">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">UF</label>
                <select
                  className="w-full px-2.5 py-1.5 border border-border rounded text-[13px] text-foreground bg-background outline-none"
                  value={filtros.uf}
                  onChange={e => atualizar({ uf: e.target.value, municipioNome: "", municipioIbge: "" })}
                >
                  <option value="">Todas</option>
                  {UFS_BRASIL.map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Município</label>
                <select
                  className={`w-full px-2.5 py-1.5 border border-border rounded text-[13px] text-foreground bg-background outline-none ${!filtros.uf ? "opacity-50" : ""}`}
                  value={filtros.municipioNome}
                  disabled={!filtros.uf}
                  onChange={e => {
                    const m = municipios.find(m => m.nome === e.target.value);
                    atualizar({
                      municipioNome: e.target.value,
                      municipioIbge: m ? String(m.id) : "",
                    });
                  }}
                >
                  <option value="">Todos</option>
                  {municipios.map(m => (
                    <option key={m.id} value={m.nome}>{m.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Esfera</label>
                <select
                  className="w-full px-2.5 py-1.5 border border-border rounded text-[13px] text-foreground bg-background outline-none"
                  value={filtros.esfera}
                  onChange={e => atualizar({ esfera: e.target.value })}
                >
                  {Object.keys(MAP_ESFERA).map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Modalidade</label>
                <select
                  className="w-full px-2.5 py-1.5 border border-border rounded text-[13px] text-foreground bg-background outline-none"
                  value={filtros.modalidade}
                  onChange={e => atualizar({ modalidade: e.target.value })}
                >
                  {Object.keys(MAP_MODALIDADE).map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Linha 3: Datas */}
            <div className="grid grid-cols-3 gap-3 mb-4 items-end">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Data início de recebimento de propostas</label>
                <input
                  type="date"
                  className="w-full px-2.5 py-1.5 border border-border rounded text-[13px] text-foreground bg-background outline-none"
                  value={filtros.dataInicio}
                  onChange={e => atualizar({ dataInicio: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Data fim de recebimento de propostas</label>
                <input
                  type="date"
                  className="w-full px-2.5 py-1.5 border border-border rounded text-[13px] text-foreground bg-background outline-none"
                  value={filtros.dataFim}
                  onChange={e => atualizar({ dataFim: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => buscar(filtros, ufsPreferidas)}
                  className="flex-1 py-2 bg-[hsl(var(--sidebar-background))] text-white border-none rounded text-[13px] font-bold cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Search size={13} />
                  Pesquisar
                </button>
                {chipsFiltros.length > 0 && (
                  <button
                    onClick={limpar}
                    className="px-3 py-2 bg-transparent text-destructive border border-destructive rounded text-xs cursor-pointer flex items-center gap-1"
                  >
                    <X size={12} /> Limpar
                  </button>
                )}
              </div>
            </div>

            {/* Chips de filtros ativos */}
            {chipsFiltros.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {chipsFiltros.map((chip, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-accent/15 text-accent border border-accent/30 rounded-full px-2.5 py-0.5 text-xs font-medium">
                    {chip.label}
                    <button
                      onClick={chip.clear}
                      className="bg-transparent border-none cursor-pointer text-accent p-0 text-sm leading-none"
                    >×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Barra de resultado */}
      <div className={`flex items-center justify-between px-3.5 py-2 border rounded-md mb-3 ${
        total > 0 ? "bg-accent/10 border-accent/30" : "bg-muted/30 border-border"
      }`}>
        <span className={`text-[13px] ${total > 0 ? "text-accent font-bold" : "text-muted-foreground"}`}>
          {loading
            ? "Buscando licitações..."
            : total > 0
            ? `(Licitações ${inicioPagina}-${fimPagina} de ${total.toLocaleString("pt-BR")})`
            : "Nenhuma licitação encontrada para os filtros selecionados."}
        </span>
        {total > 0 && !loading && (
          <span className="text-xs text-muted-foreground">
            Página {filtros.pagina} de {totalPaginas}
          </span>
        )}
      </div>

      {/* Erro */}
      {erro && (
        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-md px-4 py-3 text-destructive text-[13px] mb-3">
          <AlertTriangle size={15} />
          {erro}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[140px] rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {/* Lista de editais numerada */}
      {!loading && editais.length > 0 && (
        <div>
          {editais.map((edital, idx) => (
            <CardEdital
              key={edital.id || edital.numero_controle_pncp}
              numero={inicioPagina + idx}
              edital={edital}
              onVerItens={setModalEdital}
            />
          ))}
        </div>
      )}

      {/* Estado vazio */}
      {!loading && editais.length === 0 && !erro && (
        <div className="text-center py-12 px-6 bg-muted/30 border border-border rounded-md">
          <FileText size={40} className="text-muted-foreground/40 mx-auto mb-3" />
          <div className="text-sm text-muted-foreground mb-2">
            Nenhuma licitação encontrada para os filtros selecionados.
          </div>
          <div className="text-xs text-muted-foreground">
            Tente ajustar a UF, modalidade ou termo de pesquisa.
          </div>
          {chipsFiltros.length > 0 && (
            <button
              onClick={limpar}
              className="mt-4 px-5 py-2 bg-[hsl(var(--sidebar-background))] text-white border-none rounded text-[13px] font-semibold cursor-pointer"
            >
              Limpar todos os filtros
            </button>
          )}
        </div>
      )}

      {/* Paginação — padrão ComprasNet */}
      {totalPaginas > 1 && !loading && (
        <div className="flex items-center justify-center py-4 gap-2 border-t border-border mt-3">
          <button
            disabled={filtros.pagina <= 1}
            onClick={() => setFiltros(p => ({ ...p, pagina: 1 }))}
            className={`px-2.5 py-1 border border-border rounded text-xs cursor-pointer ${
              filtros.pagina <= 1 ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-[hsl(var(--sidebar-background))] text-white"
            }`}
          >
            « Primeira
          </button>
          <button
            disabled={filtros.pagina <= 1}
            onClick={() => setFiltros(p => ({ ...p, pagina: p.pagina - 1 }))}
            className={`px-3 py-1 border border-border rounded text-xs cursor-pointer ${
              filtros.pagina <= 1 ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-foreground/80 text-background"
            }`}
          >
            ‹ Anterior
          </button>

          {Array.from({ length: Math.min(7, totalPaginas) }, (_, i) => {
            const start = Math.max(1, Math.min(filtros.pagina - 3, totalPaginas - 6));
            const page = start + i;
            if (page > totalPaginas) return null;
            return (
              <button
                key={page}
                onClick={() => setFiltros(p => ({ ...p, pagina: page }))}
                className={`px-2.5 py-1 border rounded text-xs cursor-pointer ${
                  page === filtros.pagina
                    ? "bg-[hsl(var(--sidebar-background))] text-white border-[hsl(var(--sidebar-background))] font-bold"
                    : "bg-card text-foreground border-border"
                }`}
              >
                {page}
              </button>
            );
          })}

          <button
            disabled={filtros.pagina >= totalPaginas}
            onClick={() => setFiltros(p => ({ ...p, pagina: p.pagina + 1 }))}
            className={`px-3 py-1 border border-border rounded text-xs cursor-pointer ${
              filtros.pagina >= totalPaginas ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-foreground/80 text-background"
            }`}
          >
            Avançar ›
          </button>
          <button
            disabled={filtros.pagina >= totalPaginas}
            onClick={() => setFiltros(p => ({ ...p, pagina: totalPaginas }))}
            className={`px-2.5 py-1 border border-border rounded text-xs cursor-pointer ${
              filtros.pagina >= totalPaginas ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-[hsl(var(--sidebar-background))] text-white"
            }`}
          >
            Última »
          </button>
        </div>
      )}

      {/* Modal Itens e Download */}
      {modalEdital && (
        <ModalItensDownload
          edital={modalEdital}
          onClose={() => setModalEdital(null)}
        />
      )}
    </div>
  );
}
