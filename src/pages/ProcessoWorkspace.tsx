import { SkeletonCorpo } from '@/components/shared/SkeletonPagina';
import { cn } from '@/lib/utils';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import TelaGestao, { SecaoGestao } from '@/components/gestao/TelaGestao';
import AbasGestao from '@/components/gestao/AbasGestao';
import SeloSituacao, { type TomSituacao } from '@/components/gestao/SeloSituacao';
import TextoExpansivel from '@/components/gestao/TextoExpansivel';
import DesfechoDaDisputa from '@/components/workspace/DesfechoDaDisputa';
import PropostaEnviadaCard from '@/components/workspace/PropostaEnviadaCard';
import ContratoDoProcesso from '@/components/workspace/ContratoDoProcesso';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  FolderOpen, FileText, Calculator, Sparkles, Scale, Briefcase,
  ClipboardList, ExternalLink, Building2, Calendar, DollarSign, MapPin, Loader2, Archive,
  TrendingUp, Clock, Package, AlertTriangle, RefreshCw, Crosshair, Globe, ChevronRight, UserRound,
} from 'lucide-react';
import HistoricoProcesso from '@/components/workspace/HistoricoProcesso';
import ItensEditalPrecificacao from '@/components/workspace/ItensEditalPrecificacao';
import PropostaTecnica from '@/pages/PropostaTecnica';
import HabilitacaoChecklist from '@/components/workspace/HabilitacaoChecklist';
import AnexosManager from '@/components/workspace/AnexosManager';
import DocumentosManager from '@/components/workspace/DocumentosManager';
import EditalOriginalCard from '@/components/workspace/EditalOriginalCard';
import EditalViewer from '@/components/workspace/EditalViewer';
import AbaRoboDoProcesso from '@/components/workspace/robo/AbaRoboDoProcesso';
// Aprovação dos limites — a frente da precificação versionada (migration
// 20260914000002). É dela que o robô tira o "limite autorizado".
import AprovacaoDePrecificacao from '@/components/workspace/precificacao/AprovacaoDePrecificacao';
import { useProcessoWorkspace } from '@/hooks/useProcessoWorkspace';
import { exportarPastaZip } from '@/components/workspace/exportarPasta';
import AureliaPrecificacaoChat from '@/components/precificacao/AureliaPrecificacaoChat';
import { normalizarStatus } from '@/lib/licitacao/status';
import { identidadeDoProcesso, objetoLegivel } from '@/lib/licitacao/identidade-do-processo';
import { trilhaDaRota } from '@/lib/navegacao/paginas';
import { useAbaNaUrl } from '@/lib/navegacao/aba-na-url';

interface Licitacao {
  id: string; numero: string | null; orgao: string | null; objeto: string | null;
  modalidade: string | null; status: string | null; valor_estimado: number | null;
  data_encerramento: string | null; uf: string | null; municipio: string | null;
  data_abertura: string | null; portal: string | null; url_edital: string | null;
  observacoes: string | null; resultado: string | null; valor_adjudicado: number | null;
  data_homologacao: string | null; vencedor: boolean | null;
  numero_controle_pncp: string | null; cnpj_orgao: string | null;
  ano_compra: string | null; sequencial_compra: string | null;
  /** O robô opera por empresa: sem ela, a aba do robô não tem o que mostrar. */
  empresa_id: string | null;
  /** Responsável pelo processo — o nome vem de `profiles`, à parte. */
  operador_id: string | null;
  /** Fora da mesa de trabalho: a aba Proposta não oferece registrar envio. */
  arquivado_em: string | null;
  /** Carimbo do gatilho `comercial_marcar_proposta_enviada` — o que a aba Proposta mostra. */
  data_proposta_enviada: string | null;
}

/**
 * Um atalho leva a um MÓDULO fora do prontuário (`path`, que abre já apontado
 * para o processo com `?lid=`) ou a uma ABA do próprio prontuário (`aba`).
 *
 * A segunda forma existe por causa do "Edital / Itens": ele mandava para a
 * aba de extração da Precificação — destino de antes de o prontuário ter a
 * aba Documentos, onde o edital e os anexos moram hoje. Quem clica em
 * "Edital" quer o edital, não uma planilha (17/09).
 */
type Atalho = {
  label: string;
  icon: typeof FileText;
  descricao: string;
} & (
  | { path: string; aba?: undefined }
  | { aba: string; path?: undefined }
);

const ATALHOS: Atalho[] = [
  { label: 'Edital e anexos', aba: 'documentos', icon: FileText, descricao: 'Edital original, anexos e documentos do processo' },
  { label: 'Precificação', path: '/precificacao', icon: Calculator, descricao: 'Calcular preços e composição de custos' },
  { label: 'Proposta Comercial', path: '/proposta-tecnica', icon: FileText, descricao: 'Editar proposta técnica e gerar PDF' },
  { label: 'AURÉLIA (IA)', path: '/aurelia', icon: Sparkles, descricao: 'Análise jurídica/contábil com IA' },
  { label: 'Apoio Jurídico', path: '/apoio-juridico', icon: Scale, descricao: 'Recursos, impugnações, esclarecimentos' },
  { label: 'Documentos', path: '/documentos', icon: Briefcase, descricao: 'Documentos de habilitação' },
  { label: 'Robô de Lances', path: '/robo-lances', icon: Crosshair, descricao: 'Disputar a sessão com o agente de lances' },
  { label: 'Gestão Kanban', path: '/kanban', icon: ClipboardList, descricao: 'Status do processo no funil' },
];

type PrecificacaoItem = {
  id: string; descricao: string; quantidade: number | null; unidade: string | null;
  custo_unitario: number | null; preco_unitario: number | null; preco_total: number | null;
  margem_lucro: number | null; created_at: string;
};

type RascunhoPlanilha = {
  id: string; updated_at: string;
  dados: { itens: Array<{ descricao: string; quantidade: number; unidade: string; valorUnitario: number | null; valorTotal: number | null }> };
};

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

/** Um item da lista de itens da contratação. A forma varia porque o PNCP
 *  responde `numeroItem`/`descricaoItem` ao vivo e `numero`/`descricao` quando
 *  o item vem materializado em `licitacao_itens` — as duas grafias convivem
 *  aqui em vez de num `any` que engoliria um campo renomeado em silêncio. */
type ItemPncpLive = {
  numero?: number; numeroItem?: number;
  descricao?: string; descricaoItem?: string;
  quantidade?: number; quantidadeItens?: number;
  unidade_medida?: string; unidadeMedida?: string;
  valor_unitario_estimado?: number; valorUnitarioEstimado?: number; valorUnitario?: number;
  valor_total?: number; valorTotal?: number; valorTotalEstimado?: number;
  marca?: string | null; marcaFabricante?: string | null;
};

/** As sete abas do dossiê, na ordem de 14/09.
 *
 *  Anexos entrou em Documentos — era a mesma pasta de arquivos vista em dois
 *  lugares —, o checklist de habilitação ganhou aba própria, os atalhos de
 *  Módulos desceram para a Visão geral e o Robô de Lances passou a morar na
 *  pasta: a participação do robô é deste processo, não de uma tela à parte. */
const ABAS_DO_DOSSIE = [
  { valor: 'visao', rotulo: 'Visão geral' },
  { valor: 'documentos', rotulo: 'Documentos' },
  { valor: 'habilitacao', rotulo: 'Habilitação' },
  { valor: 'precificacao', rotulo: 'Precificação' },
  { valor: 'proposta', rotulo: 'Proposta' },
  { valor: 'robo', rotulo: 'Robô de Lances' },
  { valor: 'historico', rotulo: 'Histórico' },
] as const;

/** Abas que saíram, e para onde os endereços antigos levam. Há links gravados
 *  em outras telas (`?aba=anexos` em Contratos e na Proposta, o "Ir para
 *  Módulos" das pastas vazias, o atalho do desfecho) — eles continuam caindo
 *  no conteúdo que procuravam. */
const ABA_ANTIGA: Record<string, string> = { anexos: 'documentos', modulos: 'visao' };

/** Trilha da pasta: /processo/:id não é item de menu, então o caminho até ela
 *  é montado aqui — mas os degraus vêm do registro da tela que a contém
 *  (/kanban), e não escritos à mão: renomear o módulo em `paginas.ts` renomeia
 *  a trilha da pasta junto. O último degrau é a identidade do processo, e por
 *  isso "Gestão de licitações" ganha o link que o registro não dá a ele.
 *
 *  `slice(1)` derruba o "Painel": na faixa superior ele é redundante com a
 *  marca da coluna, que já leva ao painel — a mesma regra que `TrilhaDoTopo`
 *  aplica aos degraus vindos do registro. */
const TRILHA_BASE = trilhaDaRota('/kanban')
  .map((item, i, todos) => (i === todos.length - 1 ? { ...item, para: '/kanban' } : item))
  .slice(1);

/** Campo da ficha do processo: rótulo em cima, valor embaixo. Substitui as
 *  linhas separadas por "|" — que não embrulhavam em tela estreita e pintavam
 *  o separador com a cor da borda. */
function Campo({ rotulo, children, largo }: { rotulo: string; children: ReactNode; largo?: boolean }) {
  // Valor em texto puro passa pelo expansível: duas linhas, e o clique em cima
  // abre. Valor já montado (link, selo, número tabular) entra como veio.
  const valor = typeof children === 'string'
    ? <TextoExpansivel texto={children} linhas={2} modo="texto" limiarPorLinha={40} />
    : children;
  return (
    <div className={cn('flex min-w-[7rem] flex-col', largo ? 'max-w-[36rem]' : 'max-w-[22rem]')}>
      <dt className="g-meta text-muted-foreground">{rotulo}</dt>
      <dd className="g-corpo mt-0.5 min-w-0 break-words text-foreground">{valor}</dd>
    </div>
  );
}

/**
 * A ficha do Resumo: os campos correm em fluxo, cada um com a largura do
 * próprio conteúdo (até um teto), com 32 px entre eles.
 *
 * Duas versões anteriores no mesmo dia (17/09): três colunas iguais deixavam
 * 500 px para valores de 150; seis colunas iguais deixavam faixas vazias ao
 * lado de "Sim" e "Edital". Colunas iguais servem a tabela, não a ficha — na
 * ficha o que se lê é rótulo + valor, e a distância entre eles é que precisa
 * ser constante. Campo longo (órgão, unidade compradora, amparo legal) tem
 * teto maior; texto que passa de duas linhas abre ao clicar.
 */
const GRADE_DA_FICHA = 'flex flex-wrap gap-x-8 gap-y-3';

/** Tom do selo de situação no cabeçalho — só apresentação; o texto continua o
 *  status bruto do processo, e a cor é reforço (SeloSituacao leva ícone junto). */
const tomDoStatus = (status: string): TomSituacao => {
  const n = normalizarStatus(status);
  if (n === 'Vencida' || n === 'Homologada') return 'sucesso';
  if (n === 'Perdida') return 'critico';
  if (n === 'Arquivada') return 'neutro';
  return 'ativo';
};

export default function ProcessoWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  /* A aba mora em `?aba=` — antes ela era LIDA da URL mas nunca ESCRITA nela:
     clicar numa aba não mudava o endereço, o voltar do navegador não devolvia
     a aba e o F5 jogava todo mundo de volta na Visão Geral. O hook fecha o
     ciclo de leitura e escrita, e é o mesmo que o Kanban usa. */
  const [abaDaUrl, definirAba] = useAbaNaUrl('visao');
  /* Endereço antigo é lido já no destino — a primeira pintura não mostra uma
     aba vazia — e reescrito pelo próprio hook, que usa `replace`: corrigir o
     endereço não é navegar, então não entra no histórico e o Voltar não
     devolve a pessoa a `?aba=anexos`. */
  const aba = ABA_ANTIGA[abaDaUrl] ?? abaDaUrl;
  useEffect(() => {
    const destino = ABA_ANTIGA[abaDaUrl];
    if (destino) definirAba(destino);
  }, [abaDaUrl, definirAba]);
  // Contagem dos arquivos do PNCP (Edital em tela) — soma no chip da pasta Edital
  const [pncpArquivosCount, setPncpArquivosCount] = useState<number | null>(null);
  // O processo tem coordenadas PNCP? Decide quem materializa os itens: o
  // espelho (fonte boa) ou o pipeline do servidor (fallback p/ fora do PNCP).
  const [temFontePncp, setTemFontePncp] = useState(false);
  const materializouRef = useRef(false);
  const [lic, setLic] = useState<Licitacao | null>(null);
  const [loading, setLoading] = useState(true);
  /* Falhar ao carregar e não existir são coisas diferentes: antes o `error` da
     consulta era descartado e a queda do banco caía no mesmo "Processo não
     encontrado", mandando a pessoa procurar no Kanban um processo que está lá.
     Guardado aqui, o erro vira uma tela própria, com "Tentar novamente". */
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [cargaNonce, setCargaNonce] = useState(0);
  const [exportando, setExportando] = useState(false);
  const { anexos, documentos } = useProcessoWorkspace(id || null);
  const [precItems, setPrecItems] = useState<PrecificacaoItem[]>([]);
  const [rascunhoPlanilha, setRascunhoPlanilha] = useState<RascunhoPlanilha | null>(null);
  const [loadingPrec, setLoadingPrec] = useState(false);

  // Dados complementares do PNCP. O detalhe é JSON de terceiro — a forma muda
  // por versão da API e por campo opcional do órgão —, então o mapa de chaves
  // fica aberto de propósito: o que este arquivo promete é o objeto `espelho`
  // logo abaixo, montado campo a campo, e não a resposta crua do portal.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pncpDetalhe, setPncpDetalhe] = useState<Record<string, any> | null>(null);
  const [pncpItens, setPncpItens] = useState<ItemPncpLive[]>([]);
  // Fallback do espelho de itens: licitacao_itens são os MESMOS itens do PNCP,
  // materializados pela preparação automática — camada cache do padrão nº 4
  // (consulta ao vivo como complemento). Sem eles a tabela sumia sempre que o
  // portal oscilava.
  const [itensMaterializados, setItensMaterializados] = useState<Array<{
    numero: number; descricao: string; quantidade: number; unidade: string; valor_unitario: number;
  }>>([]);
  const [pncpCarregando, setPncpCarregando] = useState(false);
  // Falha no espelho PNCP era invisível: o card simplesmente não aparecia.
  const [pncpErro, setPncpErro] = useState(false);
  // Cache local do PNCP (pncp_editais_cache): a fonte OFFLINE dos campos do
  // espelho. O detalhe ao vivo só complementa/atualiza — com o PNCP fora do
  // ar, a Visão Geral continua completa a partir do nosso próprio banco.
  const [pncpCache, setPncpCache] = useState<Record<string, unknown> | null>(null);
  const [pncpNonce, setPncpNonce] = useState(0);
  const pncpFetchedRef = useRef(false);

  const handleExportarZip = async () => {
    if (!lic) return;
    setExportando(true);
    try {
      await exportarPastaZip(lic.id, anexos, documentos, {
        numeroProcesso: lic.numero,
        orgao: lic.orgao,
      });
    } finally {
      setExportando(false);
    }
  };

  useEffect(() => {
    if (!id || !user) return;
    setLoading(true);
    setErroCarga(null);
    supabase.from('licitacoes')
      .select('id, numero, orgao, objeto, modalidade, status, valor_estimado, data_encerramento, uf, municipio, data_abertura, portal, url_edital, observacoes, resultado, valor_adjudicado, data_homologacao, vencedor, numero_controle_pncp, cnpj_orgao, ano_compra, sequencial_compra, empresa_id, operador_id, arquivado_em, data_proposta_enviada')
      .eq('id', id).maybeSingle()  // sem user_id: a linha do painel abre processos de colegas (RLS protege)
      .then(({ data, error }) => {
        // `error` aqui é falha de transporte/permissão — não "linha ausente",
        // que o maybeSingle devolve como data null e error null.
        if (error) setErroCarga(error.message || 'Falha ao consultar o processo');
        else setLic(data as Licitacao);
        setLoading(false);
      });
  }, [id, user, cargaNonce]);

  /* Nome do responsável, para a linha de identificação do cabeçalho. Consulta
     à parte porque `licitacoes` não tem FK declarada para `profiles` — o mesmo
     motivo do Kanban. Falhar aqui só omite o nome; não inventa um. */
  const [responsavel, setResponsavel] = useState<string | null>(null);
  const operadorId = lic?.operador_id ?? null;
  useEffect(() => {
    if (!operadorId) {
      setResponsavel(null);
      return;
    }
    let cancelado = false;
    supabase.from('profiles')
      .select('user_id, nome_completo, username')
      .eq('user_id', operadorId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelado) return;
        if (error) {
          console.warn('[processo] nome do responsável', error.message);
          setResponsavel(null);
          return;
        }
        setResponsavel(data ? (data.nome_completo || data.username || null) : null);
      });
    return () => { cancelado = true; };
  }, [operadorId]);

  useEffect(() => {
    if (!lic) return;
    const COLS = 'situacao, tipo_instrumento, srp, lei_base, unidade_orgao, codigo_unidade, data_publicacao_pncp, data_abertura_proposta, data_encerramento_proposta, link_sistema_origem, numero_controle_pncp';
    let q = null;
    if (lic.numero_controle_pncp) {
      q = supabase.from('pncp_editais_cache').select(COLS).eq('numero_controle_pncp', lic.numero_controle_pncp);
    } else {
      // Fallback por coordenadas: processos antigos (ou de portais parceiros)
      // podem não ter o número de controle gravado — sem isto, o cache existia
      // e a Visão Geral ficava vazia mesmo assim (caso Rondon do Pará).
      const m = (lic.url_edital || '').match(/editais\/(\d{14})\/(\d{4})\/(\d+)/);
      const cnpj = m?.[1] || lic.cnpj_orgao;
      const ano = m?.[2] || lic.ano_compra;
      const seq = m?.[3] || lic.sequencial_compra;
      if (cnpj && ano && seq) {
        q = supabase.from('pncp_editais_cache').select(COLS)
          .eq('cnpj_orgao', cnpj).eq('ano_compra', String(ano)).eq('sequencial_compra', String(Number(seq)));
      }
    }
    if (!q) return;
    q.limit(1).maybeSingle().then(({ data }) => setPncpCache(data as Record<string, unknown> | null));
  }, [lic]);

  // Carrega detalhes completos do PNCP quando o processo tem url_edital do portal
  useEffect(() => {
    if (pncpFetchedRef.current || !lic) return;
    // Coordenadas da contratação: URL do PNCP, colunas gravadas no processo,
    // ou o número de controle — sem isso o espelho PNCP não tinha como abrir
    // para editais vindos de portais parceiros (url_edital fora do padrão).
    let cnpj: string | undefined, ano: string | undefined, seq: string | undefined;
    const m = (lic.url_edital || '').match(/editais\/(\d{14})\/(\d{4})\/(\d+)/);
    if (m) { cnpj = m[1]; ano = m[2]; seq = m[3]; }
    else if (lic.cnpj_orgao && lic.ano_compra && lic.sequencial_compra) {
      cnpj = lic.cnpj_orgao; ano = lic.ano_compra; seq = lic.sequencial_compra;
    } else {
      const n = (lic.numero_controle_pncp || '').match(/(\d{14})-\d+-(\d+)\/(\d{4})/);
      if (n) { cnpj = n[1]; seq = String(Number(n[2])); ano = n[3]; }
    }
    if (!cnpj || !ano || !seq) return;
    setTemFontePncp(true);
    pncpFetchedRef.current = true;
    setPncpErro(false);
    setPncpCarregando(true);
    // Via edge function detalhe-licitacao-pncp: o fetch direto do navegador ao
    // PNCP falhava SEMPRE por CORS — por isso Amparo/Modo de disputa/Fonte
    // nunca apareciam e o card dizia "Indisponível" com o portal no ar.
    // Teto de 15s do lado do cliente: sem ele, uma resposta presa no gateway
    // segurava o spinner por até 2,5 minutos. Estourou → erro com retry.
    Promise.race([
      supabase.functions.invoke('detalhe-licitacao-pncp', {
        body: { cnpjOrgao: cnpj, anoCompra: ano, sequencialCompra: seq },
      }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 15_000)),
    ])
      .then(({ data, error }: { data?: Record<string, unknown> | null; error?: unknown }) => {
        if (error || !data?.success) { setPncpErro(true); return; }
        setPncpDetalhe(data);
        setPncpItens(Array.isArray(data.itens) ? (data.itens as ItemPncpLive[]) : []);
      })
      .catch(() => setPncpErro(true))
      .finally(() => setPncpCarregando(false));
  }, [lic, pncpNonce]);

  useEffect(() => {
    if (!lic?.id) return;
    supabase
      .from('licitacao_itens')
      .select('numero, descricao, quantidade, unidade, valor_unitario')
      .eq('licitacao_id', lic.id)
      .order('numero')
      .then(({ data }) => setItensMaterializados((data as typeof itensMaterializados) || []));
  }, [lic?.id]);

  // A INVERSÃO da preparação automática: quando o espelho traz os itens ao
  // vivo do PNCP e licitacao_itens está vazia, materializa DAQUI — dado já
  // fiel, sem IA, sem repetir do servidor a rota sujeita a rate-limit. O
  // pipeline edital-auto-ingest vira fallback para processos fora do PNCP.
  useEffect(() => {
    if (materializouRef.current || !user || !lic?.id) return;
    if (!pncpItens.length || itensMaterializados.length > 0) return;
    materializouRef.current = true;
    const rows = pncpItens
      .map((item, i) => {
        const qtd = Number(item.quantidade ?? item.quantidadeItens ?? 1) || 1;
        const vUnit = Number(item.valor_unitario_estimado ?? item.valorUnitarioEstimado ?? item.valorUnitario ?? 0) || 0;
        return {
          licitacao_id: lic.id,
          user_id: user.id,
          numero: Number(item.numero ?? item.numeroItem ?? i + 1),
          descricao: String(item.descricao ?? item.descricaoItem ?? '').trim().slice(0, 4000),
          quantidade: qtd,
          unidade: String(item.unidade_medida ?? item.unidadeMedida ?? 'UN').slice(0, 20),
          valor_unitario: vUnit,
          valor_total: (Number(item.valor_total ?? item.valorTotal ?? 0) || qtd * vUnit),
          lote: 'Único',
          marca: item.marca ?? item.marcaFabricante ?? null,
          origem: 'espelho:PNCP_ITENS',
        };
      })
      .filter((r) => r.descricao && r.numero > 0);
    if (!rows.length) return;
    supabase
      .from('licitacao_itens')
      .insert(rows)
      .then(({ error }) => {
        if (error) { console.error('[materializar-itens]', error.message); return; }
        setItensMaterializados(rows.map((r) => ({
          numero: r.numero, descricao: r.descricao, quantidade: r.quantidade,
          unidade: r.unidade, valor_unitario: r.valor_unitario,
        })));
      });
  }, [pncpItens, itensMaterializados.length, user, lic?.id]);

  const loadPrecificacao = useCallback(async () => {
    if (!id || !user) return;
    setLoadingPrec(true);
    const [catRes, rascRes] = await Promise.all([
      supabase.from('catalogo_itens_precificados')
        .select('id, descricao, quantidade, unidade, custo_unitario, preco_unitario, preco_total, margem_lucro, created_at')
        .eq('licitacao_id', id).eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('rascunhos')
        .select('id, updated_at, dados')
        .eq('licitacao_id', id).eq('user_id', user.id).eq('modulo', 'precificacao_planilha')
        .maybeSingle(),
    ]);
    setPrecItems((catRes.data as PrecificacaoItem[]) || []);
    setRascunhoPlanilha(rascRes.data as RascunhoPlanilha | null);
    setLoadingPrec(false);
  }, [id, user]);

  /* O efeito acoplado: virar para Precificação dispara a carga. Agora ele
     observa a ABA e não só a aba inicial — com a aba morando na URL, os quatro
     caminhos que levam a ela (clique na fila, link `?aba=precificacao`, o
     "Ver na Precificação" do desfecho e o "Consultar preparação" da aba do robô)
     passam pelo mesmo ponto. Antes, o clique carregava e o link não. */
  useEffect(() => {
    if (aba === 'precificacao') loadPrecificacao();
  }, [aba, loadPrecificacao]);

  // Espelho de ITENS — mesma prioridade do espelho de campos: ao vivo > materializado.
  const itensEspelho: ItemPncpLive[] = pncpItens.length > 0
    ? pncpItens
    : itensMaterializados.map((r) => ({
        numero: r.numero,
        descricao: r.descricao,
        quantidade: r.quantidade,
        unidade_medida: r.unidade,
        valor_unitario_estimado: r.valor_unitario,
      }));

  // Espelho PNCP mesclado — prioridade: consulta ao vivo > cache local > processo.
  const det = pncpDetalhe;
  const cc = pncpCache;
  // "Hora de parede": o PNCP envia horário de Brasília SEM fuso; o banco
  // armazena como UTC e o new Date() desconta 3h de novo — todo horário de
  // edital aparecia errado (PNCP: 10:00 → tela: 07:00). Lê direto da string.
  const dataHora = (v: unknown) => {
    const m = String(v ?? '').match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}, ${m[4]}:${m[5]}` : null;
  };
  const dataSo = (v: unknown) => {
    const m = String(v ?? '').match(/(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
  };
  // Amparo do cache legado pode conter a descrição didática longa (o sync
  // antigo gravava descricao); só exibe do cache o que parece citação legal.
  const pareceCitacao = (t: string | null) => !!t && /^(lei|lc|decreto|mp|emenda|art)\b/i.test(t.trim()) && t.length <= 90;
  const espelho = {
    unidadeCompradora: det?.unidade_orgao
      || [cc?.codigo_unidade, cc?.unidade_orgao].filter(Boolean).join(' — ') || null,
    amparoLegal: det?.amparo_legal || (pareceCitacao(cc?.lei_base as string | null) ? (cc?.lei_base as string) : null),
    tipo: det?.tipo_instrumento_convocatorio || (cc?.tipo_instrumento as string | null),
    modoDisputa: det?.modo_disputa || null,
    srp: (det?.srp ?? cc?.srp) as boolean | null | undefined,
    fonteOrcamentaria: det?.fonte_orcamentaria || null,
    divulgacaoPncp: det?.data_publicacao_pncp || (cc?.data_publicacao_pncp as string | null),
    situacao: det?.situacao || (cc?.situacao as string | null),
    inicioPropostas: det?.data_abertura_proposta || (cc?.data_abertura_proposta as string | null),
    fimPropostas: det?.data_encerramento_proposta || (cc?.data_encerramento_proposta as string | null),
    idPncp: det?.numero_controle_pncp || lic?.numero_controle_pncp || (cc?.numero_controle_pncp as string | null) || null,
    fonte: det?.fonte_sistema || null,
  };
  const temEspelho = Object.values(espelho).some((v) => v !== null && v !== undefined && v !== '');

  /* A tela passou a usar o AppLayout (13/09): a moldura, a trilha e o respiro
     vêm de lá, e o esqueleto da espera é só o CORPO — repetir a barra aqui
     dentro daria duas barras. */
  if (loading) {
    return (
      <AppLayout trilhaExtra={TRILHA_BASE}>
        <SkeletonCorpo />
      </AppLayout>
    );
  }

  /* Não conseguimos carregar ≠ não existe. O primeiro é nosso problema e se
     resolve tentando de novo; o segundo é endereço morto e se resolve voltando
     à lista. Mandar quem caiu no primeiro procurar na lista é mandar procurar
     um processo que está lá. */
  if (erroCarga) {
    return (
      <AppLayout trilhaExtra={TRILHA_BASE}>
        <TelaGestao titulo="Não conseguimos carregar este processo">
          <EstadoVazio
            icone={<AlertTriangle />}
            titulo="Falha ao carregar o processo"
            descricao={`O processo pode existir — foi a consulta que não voltou. ${erroCarga}`}
            acao={
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => setCargaNonce((n) => n + 1)}>
                  <RefreshCw className="w-4 h-4" aria-hidden="true" /> Tentar novamente
                </Button>
                <Button variant="outline" onClick={() => navigate('/kanban')}>
                  Voltar à Gestão de licitações
                </Button>
              </div>
            }
          />
        </TelaGestao>
      </AppLayout>
    );
  }

  if (!lic) return (
    <AppLayout trilhaExtra={TRILHA_BASE}>
      <TelaGestao
        titulo="Processo não encontrado"
        descricao="O processo pode ter sido excluído ou o endereço está incompleto"
      >
        <EstadoVazio
          icone={<FolderOpen />}
          titulo="Nada para abrir neste endereço"
          descricao="Volte à gestão de licitações e escolha o processo na coluna em que ele está."
          acao={<Button onClick={() => navigate('/kanban')}>Voltar à Gestão de licitações</Button>}
        />
      </TelaGestao>
    </AppLayout>
  );

  const identidade = identidadeDoProcesso({ numero: lic.numero, modalidade: lic.modalidade });
  const temContexto = !!(lic.orgao || lic.modalidade || responsavel || lic.uf || lic.data_encerramento || lic.valor_estimado != null || lic.portal);

  return (
    <AppLayout trilhaExtra={[...TRILHA_BASE, { rotulo: identidade }]}>
      {/* Cabeçalho COMPACTO: identificador, situação e origem. O objeto não
          entra aqui — ele tem sete linhas em edital de serviço e empurrava as
          abas para fora da primeira tela; mora no Resumo, com expansão. */}
      <TelaGestao
        titulo={identidade}
        selos={
          <>
            {lic.status && (
              <SeloSituacao tom={tomDoStatus(lic.status)}>{lic.status}</SeloSituacao>
            )}
            {/* SRP é o que diz se o desfecho vira ATA ou contrato direto —
                identidade do processo, por isso fica ao lado da situação. */}
            {espelho.srp === true && (
              <SeloSituacao tom="neutro" icone={Archive} explicacao="Sistema de Registro de Preços — o resultado vira ATA.">
                SRP · registro de preços
              </SeloSituacao>
            )}
            {lic.vencedor && <SeloSituacao tom="sucesso">Empresa vencedora</SeloSituacao>}
          </>
        }
        contexto={
          temContexto ? (
            <>
              {lic.orgao && (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <Building2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{lic.orgao}</span>
                </span>
              )}
              {lic.modalidade && <span className="truncate">{lic.modalidade}</span>}
              {/* Quem responde pelo processo — só quando se sabe quem. */}
              {responsavel && (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <UserRound className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">Responsável: {responsavel}</span>
                </span>
              )}
              {(lic.municipio || lic.uf) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {lic.municipio && lic.uf ? `${lic.municipio}/${lic.uf}` : lic.municipio || lic.uf}
                </span>
              )}
              {lic.data_encerramento && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-4 h-4 shrink-0" aria-hidden="true" /> Encerra {dataSo(lic.data_encerramento)}
                </span>
              )}
              {lic.valor_estimado != null && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <DollarSign className="w-4 h-4 shrink-0" aria-hidden="true" /> {fmt(lic.valor_estimado)}
                </span>
              )}
              {/* A ORIGEM do processo: de onde o edital veio. Com link quando o
                  portal deu endereço — o caminho de volta à fonte oficial. */}
              {lic.portal && (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <Globe className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {lic.url_edital ? (
                    <a
                      href={lic.url_edital}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-primary hover:underline"
                    >
                      {lic.portal}
                    </a>
                  ) : (
                    <span className="truncate">{lic.portal}</span>
                  )}
                </span>
              )}
            </>
          ) : undefined
        }
        acoesSecundarias={
          <Button variant="outline" className="g-controle" onClick={handleExportarZip} disabled={exportando}>
            {exportando
              ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              : <Archive className="w-4 h-4" aria-hidden="true" />}
            {exportando ? 'Compactando...' : 'Exportar ZIP'}
          </Button>
        }
        abas={
          /* A contagem é o dado real das duas coleções já carregadas — não um
             número decorativo. Documentos soma as duas porque, desde 14/09,
             documentos editáveis e anexos moram na mesma aba. */
          <AbasGestao
            abas={ABAS_DO_DOSSIE.map((a) =>
              a.valor === 'documentos'
                ? { ...a, contagem: documentos.length + anexos.length }
                : { ...a },
            )}
            valor={aba}
            aoMudar={definirAba}
          />
        }
      >
        {/* Visão Geral */}
        {aba === 'visao' && (
          <div className="flex flex-col gap-4">
            {/* O desfecho abre a Visão Geral: encerrada a disputa, é a primeira
                coisa que a pessoa precisa resolver. Só aparece quando há
                desfecho — antes disso não há o que tratar. */}
            <DesfechoDaDisputa
              licitacaoId={lic.id}
              numero={lic.numero}
              orgao={lic.orgao}
              modalidade={lic.modalidade ?? null}
              valorEstimado={lic.valor_estimado ?? null}
              status={lic.status}
              irParaAba={definirAba}
              aoMudarStatus={(novo) => setLic(atual => (atual ? { ...atual, status: novo } : atual))}
            />
            {/* O contrato que nasceu daqui — só aparece quando existe elo. */}
            <ContratoDoProcesso licitacaoId={lic.id} />

            <SecaoGestao titulo="Resumo">
              <Card className="p-5 space-y-5">
                {/* O objeto, que saiu do cabeçalho, chega aqui inteiro — em
                    três linhas, com botão real de expansão. */}
                <div>
                  <h3 className="g-meta mb-1 uppercase tracking-wide text-muted-foreground">Objeto</h3>
                  {lic.objeto
                    ? <TextoExpansivel texto={objetoLegivel(lic.objeto)} linhas={2} modo="texto" />
                    : <p className="g-corpo text-muted-foreground">—</p>}
                </div>

                <dl className={cn(GRADE_DA_FICHA, 'border-t border-border pt-5')}>
                  <Campo rotulo="Órgão" largo>{lic.orgao || '—'}</Campo>
                  <Campo rotulo="Local">
                    {lic.municipio && lic.uf ? `${lic.municipio}/${lic.uf}` : lic.municipio || lic.uf || '—'}
                  </Campo>
                  <Campo rotulo="Status">{lic.status || '—'}</Campo>
                  <Campo rotulo="Modalidade">{lic.modalidade || '—'}</Campo>
                  <Campo rotulo="Valor estimado">
                    <span className="tabular-nums">{lic.valor_estimado != null ? fmt(lic.valor_estimado) : '—'}</span>
                  </Campo>
                  {lic.data_abertura && <Campo rotulo="Abertura">{dataHora(lic.data_abertura)}</Campo>}
                  {lic.data_encerramento && <Campo rotulo="Encerramento">{dataHora(lic.data_encerramento)}</Campo>}
                  {lic.portal && (
                    <Campo rotulo="Portal">
                      {lic.url_edital ? (
                        <a href={lic.url_edital} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          {lic.portal} <ExternalLink className="w-4 h-4" aria-hidden="true" />
                        </a>
                      ) : (
                        lic.portal
                      )}
                    </Campo>
                  )}
                  {lic.resultado && (
                    <Campo rotulo="Resultado" largo>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={lic.vencedor ? 'font-semibold text-success-ink' : undefined}>{lic.resultado}</span>
                        {/* O ponto verde dizia "vencemos" só pela cor, com o texto
                            escondido no title. Selo com texto: a cor é reforço. */}
                        {lic.vencedor && <Badge variant="success">Empresa vencedora</Badge>}
                      </div>
                    </Campo>
                  )}
                  {lic.valor_adjudicado != null && (
                    <Campo rotulo="Valor adjudicado">
                      <span className="tabular-nums">{fmt(lic.valor_adjudicado)}</span>
                    </Campo>
                  )}
                  {lic.data_homologacao && (
                    <Campo rotulo="Homologação">{new Date(lic.data_homologacao).toLocaleDateString('pt-BR')}</Campo>
                  )}
                </dl>

                {temEspelho && (
                  <div className="border-t border-border pt-5">
                    <h3 className="g-titulo-secao mb-3">Espelho do PNCP</h3>
                    <dl className={GRADE_DA_FICHA}>
                      {espelho.unidadeCompradora && (
                        <Campo rotulo="Unidade compradora" largo>{espelho.unidadeCompradora}</Campo>
                      )}
                      {espelho.amparoLegal && <Campo rotulo="Amparo legal" largo>{espelho.amparoLegal}</Campo>}
                      {espelho.tipo && <Campo rotulo="Tipo">{espelho.tipo}</Campo>}
                      {espelho.modoDisputa && <Campo rotulo="Modo de disputa">{espelho.modoDisputa}</Campo>}
                      {espelho.srp != null && (
                        <Campo rotulo="Registro de preço">{espelho.srp ? 'Sim' : 'Não'}</Campo>
                      )}
                      <Campo rotulo="Fonte orçamentária">{espelho.fonteOrcamentaria || 'Não informada'}</Campo>
                      {espelho.divulgacaoPncp && (
                        <Campo rotulo="Divulgação no PNCP">{dataSo(espelho.divulgacaoPncp)}</Campo>
                      )}
                      {espelho.situacao && <Campo rotulo="Situação">{espelho.situacao}</Campo>}
                      {espelho.inicioPropostas && (
                        <Campo rotulo="Início das propostas">{dataHora(espelho.inicioPropostas)}</Campo>
                      )}
                      {espelho.fimPropostas && (
                        <Campo rotulo="Fim das propostas">{dataHora(espelho.fimPropostas)}</Campo>
                      )}
                      {espelho.idPncp && (
                        <Campo rotulo="Id contratação PNCP" largo>
                          <span className="tabular-nums">{espelho.idPncp}</span>
                        </Campo>
                      )}
                      {espelho.fonte && <Campo rotulo="Fonte">{espelho.fonte}</Campo>}
                    </dl>
                  </div>
                )}

                {lic.observacoes && (
                  <div className="border-t border-border pt-5">
                    <h3 className="g-meta mb-1 uppercase tracking-wide text-muted-foreground">Observações</h3>
                    <TextoExpansivel
                      texto={lic.observacoes}
                      linhas={3}
                      className="text-muted-foreground"
                      rotuloAbrir="Ver observações completas"
                      rotuloFechar="Recolher observações"
                    />
                  </div>
                )}
              </Card>
            </SecaoGestao>

            {/* ── Dados completos do PNCP ── */}
            {pncpErro && !pncpDetalhe && !pncpCarregando && !temEspelho && (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <AlertTitle>Espelho PNCP — indisponível no momento</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center gap-3">
                  <span>O PNCP não respondeu — costuma ser instabilidade passageira do portal.</span>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => { pncpFetchedRef.current = false; setPncpNonce((n) => n + 1); }}
                  >
                    <RefreshCw className="w-4 h-4" aria-hidden="true" /> Tentar novamente
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* A condição perdeu `pncpArquivos.length > 0`: aquele estado nunca
                era preenchido (o setter não tinha chamador), então a parcela
                era sempre falsa e o bloco "Arquivos (N)" que dependia dela
                nunca chegou à tela. Os arquivos do PNCP vivem no EditalViewer,
                na aba Documentos → pasta Edital, que é onde a Fase 1 os colocou. */}
            {((pncpCarregando && !temEspelho) || pncpDetalhe || itensEspelho.length > 0) && (
              <SecaoGestao titulo="Complementos do PNCP — itens">
                <Card className="p-6">
                  {pncpCarregando && !itensEspelho.length ? (
                    <div role="status" aria-busy="true" className="space-y-3">
                      <span className="sr-only">Carregando dados completos do PNCP…</span>
                      <Skeleton className="h-5 w-64" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Informação complementar */}
                      {pncpDetalhe?.informacao_complementar && (
                        <div>
                          <h3 className="g-titulo-secao mb-1">Informação complementar</h3>
                          <TextoExpansivel texto={String(pncpDetalhe.informacao_complementar)} linhas={4} />
                        </div>
                      )}

                      {/* Ausência não pode ser silêncio: sem este bloco, a seção
                          de itens simplesmente não existia e ninguém sabia se era
                          instabilidade, contratação sem itens ou extração pendente. */}
                      {!pncpCarregando && itensEspelho.length === 0 && (
                        <div className="border-t border-border pt-3 first:border-0 first:pt-0">
                          <h3 className="g-titulo-secao mb-1">Itens</h3>
                          <p className="g-corpo text-muted-foreground">
                            Nenhum item veio do PNCP nesta consulta — pode ser instabilidade do portal
                            ou contratação sem itens publicados.{' '}
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-sm"
                              onClick={() => { pncpFetchedRef.current = false; setPncpNonce((n) => n + 1); }}
                            >
                              Consultar novamente
                            </Button>
                          </p>
                        </div>
                      )}

                      {/* Itens da contratação — espelho fiel da aba Itens do PNCP:
                          mesmos rótulos de coluna, descrição integral, cabeçalho em
                          negrito como no portal. Aqui a descrição NÃO é truncada de
                          propósito: é a cópia do que o portal publicou. */}
                      {itensEspelho.length > 0 && (
                        <div className="border-t border-border pt-3 first:border-0 first:pt-0">
                          <h3 className="g-titulo-secao mb-2">
                            Itens ({itensEspelho.length})
                          </h3>
                          <div className="overflow-x-auto rounded-[var(--g-raio)] border border-border">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-border bg-muted">
                                  {/* 96 px, sem quebra: o PNCP numera itens como 10001, 10002
                                      (há item de sete dígitos na base) e, com 64 px, o número
                                      saía "1000/1" e o título "Númer/o" (print de 17/09). */}
                                  <th className="g-meta w-24 whitespace-nowrap px-3 py-2 text-left font-semibold">Número</th>
                                  <th className="g-meta px-3 py-2 text-left font-semibold">Descrição</th>
                                  {/* Unidade em coluna própria, como o PNCP a publica — antes era
                                      um selo colado ao fim da descrição, e caía em linha nova. */}
                                  <th className="g-meta w-24 whitespace-nowrap px-3 py-2 text-left font-semibold" title="Unidade de medida">Und</th>
                                  <th className="g-meta w-28 px-3 py-2 text-right font-semibold">Quantidade</th>
                                  <th className="g-meta w-36 px-3 py-2 text-right font-semibold">Valor unitário estimado</th>
                                  <th className="g-meta w-36 px-3 py-2 text-right font-semibold">Valor total estimado</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {itensEspelho.map((item, i) => {
                                  const qtd = item.quantidade ?? item.quantidadeItens;
                                  const vUnit = item.valor_unitario_estimado ?? item.valorUnitarioEstimado ?? item.valorUnitario;
                                  const vTotal = item.valor_total ?? item.valorTotal ?? item.valorTotalEstimado
                                    ?? (vUnit != null && qtd != null ? vUnit * qtd : null);
                                  return (
                                    <tr key={item.numero ?? item.numeroItem ?? i} className="transition-colors hover:bg-muted/50">
                                      <td className="g-corpo whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">{item.numero ?? item.numeroItem ?? i + 1}</td>
                                      <td className="g-corpo px-3 py-2 text-foreground">
                                        {item.descricao || item.descricaoItem || '—'}
                                      </td>
                                      <td className="g-corpo whitespace-nowrap px-3 py-2 text-muted-foreground">
                                        {item.unidade_medida || item.unidadeMedida || '—'}
                                      </td>
                                      <td className="g-corpo whitespace-nowrap px-3 py-2 text-right tabular-nums">{qtd?.toLocaleString('pt-BR') ?? '—'}</td>
                                      <td className="g-corpo whitespace-nowrap px-3 py-2 text-right tabular-nums text-muted-foreground">{vUnit != null ? fmt(vUnit) : '—'}</td>
                                      <td className="g-corpo whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums text-success-ink">{vTotal != null ? fmt(vTotal) : '—'}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              </SecaoGestao>
            )}

            {/* Os atalhos da antiga aba Módulos, como lista compacta no pé da
                ficha: é para onde se vai DEPOIS de ler o processo, e uma aba
                inteira para oito links escondia a ficha atrás de um clique. */}
            <SecaoGestao titulo="Abrir nos módulos">
              <ul className="g-cartao divide-y divide-border">
                {ATALHOS.map((a) => {
                  const classe = 'flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';
                  const conteudo = (
                    <>
                      <a.icon className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-2">
                        <span className="g-corpo shrink-0 font-medium text-foreground">{a.label}</span>
                        <span className="g-meta min-w-0 text-muted-foreground sm:truncate">{a.descricao}</span>
                      </span>
                      <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </>
                  );
                  return (
                    <li key={a.label}>
                      {a.aba !== undefined ? (
                        /* Aba do próprio prontuário: troca a aba e volta ao topo,
                           onde ela está — a lista fica no pé da ficha. */
                        <button
                          type="button"
                          className={classe}
                          onClick={() => {
                            definirAba(a.aba);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          {conteudo}
                        </button>
                      ) : (
                        /* `?lid=` leva o processo junto: o módulo abre já
                           apontado para ele, em vez de numa tela em branco. */
                        <Link to={`${a.path}${a.path.includes('?') ? '&' : '?'}lid=${lic.id}`} className={classe}>
                          {conteudo}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </SecaoGestao>
          </div>
        )}

        {/* Documentos — a pasta inteira do processo: o edital original, os
            documentos editáveis e os anexos (que eram aba própria até 14/09).
            O Edital em tela mora em Anexos → pasta Edital (Fase 1 do
            prontuário integrado), com os arquivos oficiais do PNCP. */}
        {aba === 'documentos' && (
          <div className="flex flex-col gap-4">
            <EditalOriginalCard
              licitacaoId={lic.id}
              urlEdital={lic.url_edital ?? null}
              onVerItens={() => definirAba('precificacao')}
              itensProntos={itensMaterializados.length}
              pncpDisponivel={temFontePncp}
            />
            <DocumentosManager
              licitacaoId={lic.id}
              numeroProcesso={lic.numero}
              orgao={lic.orgao}
              objeto={lic.objeto}
              cidade={lic.municipio}
            />
            <AnexosManager
              pncpEditalCount={pncpArquivosCount ?? undefined}
              licitacaoId={lic.id}
              editalViewer={<EditalViewer licitacaoId={lic.id} urlEdital={lic.url_edital ?? undefined} onArquivosPncp={setPncpArquivosCount} />}
            />
          </div>
        )}

        {/* Habilitação — Fase 3: exigências do edital casadas com o cofre da
            empresa, com validade e aceite. A distinção IA × conferido vive
            dentro do checklist e não muda aqui. */}
        {aba === 'habilitacao' && <HabilitacaoChecklist licitacaoId={lic.id} />}

        {/* Precificação */}
        {aba === 'precificacao' && (
          /* Fragmento de propósito: a moldura já empilha os filhos com o
             respiro padrão. A aprovação dos limites abre a aba — é dela que a
             aba do robô lê "versão N aprovada em …" —, e as sub-abas de
             trabalho seguem abaixo, como estavam. */
          <>
          <AprovacaoDePrecificacao licitacaoId={lic.id} empresaId={lic.empresa_id} />
          <Tabs defaultValue="prec-historico" className="space-y-4">
            <TabsList>
              <TabsTrigger value="prec-historico" className="gap-2">
                <Calculator className="w-4 h-4" aria-hidden="true" /> Precificação
              </TabsTrigger>
              <TabsTrigger value="prec-aurelia" className="gap-2">
                <Sparkles className="w-4 h-4" aria-hidden="true" /> Nova Precificação
              </TabsTrigger>
            </TabsList>

            {/* sub-aba: conteúdo original */}
            <TabsContent value="prec-historico" className="space-y-4">
              {/* Fase 2: precificação in-context — os itens do edital ganham
                  preço aqui e vão para o catálogo, de onde a Proposta importa.
                  As cotações, as fontes e a aplicação EXPLÍCITA do preço
                  ("Usar mediana PNCP", "Usar menor", "Usar médio") são deste
                  componente: sugestão nunca entra sozinha na planilha. */}
              <ItensEditalPrecificacao
                licitacaoId={lic.id}
                onSaved={loadPrecificacao}
                onIrParaProposta={() => definirAba('proposta')}
                objetoProcesso={lic.objeto ?? ''}
                pncpCoords={(() => {
                  const m = (lic.url_edital || '').match(/editais\/(\d{14})\/(\d{4})\/(\d+)/);
                  if (m) return { cnpj: m[1], ano: m[2], seq: m[3] };
                  if (lic.cnpj_orgao && lic.ano_compra && lic.sequencial_compra)
                    return { cnpj: lic.cnpj_orgao, ano: lic.ano_compra, seq: lic.sequencial_compra };
                  const n = (lic.numero_controle_pncp || '').match(/(\d{14})-\d+-(\d+)\/(\d{4})/);
                  if (n) return { cnpj: n[1], ano: n[3], seq: String(Number(n[2])) };
                  return null;
                })()}
              />

              <SecaoGestao
                titulo="Histórico de Precificação"
                acoes={
                  <Button asChild className="g-controle">
                    <Link to={`/precificacao?lid=${lic.id}`}>
                      <Calculator className="w-4 h-4" aria-hidden="true" /> Abrir Precificação
                    </Link>
                  </Button>
                }
              >
                <p className="g-corpo -mt-1 text-muted-foreground">
                  Planilha de custos e itens precificados para este processo
                </p>

                {loadingPrec ? (
                  <div role="status" aria-busy="true" className="space-y-3">
                    <span className="sr-only">Carregando precificação…</span>
                    <Skeleton className="h-24 w-full rounded-lg" />
                    <Skeleton className="h-40 w-full rounded-lg" />
                  </div>
                ) : (
                  <>
                    {/* Rascunho da planilha de custos */}
                    {rascunhoPlanilha ? (() => {
                      const itens = rascunhoPlanilha.dados?.itens?.filter(i => i.valorUnitario && i.valorUnitario > 0) || [];
                      const total = itens.reduce((s, i) => s + ((i.valorTotal ?? 0) || (i.valorUnitario ?? 0) * (i.quantidade ?? 1)), 0);
                      const updated = new Date(rascunhoPlanilha.updated_at);
                      return (
                        <Card className="p-6">
                          <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--g-raio)] bg-primary-tint text-primary">
                              <TrendingUp className="w-5 h-5" aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="g-titulo-secao">Planilha de Custos</h3>
                              <div className="g-meta mt-1 flex flex-wrap gap-3 text-muted-foreground">
                                <span className="inline-flex items-center gap-1"><Package className="w-4 h-4" aria-hidden="true" /> {itens.length} {itens.length === 1 ? 'item' : 'itens'} preenchidos</span>
                                {total > 0 && <span className="inline-flex items-center gap-1"><DollarSign className="w-4 h-4" aria-hidden="true" /> Total: <strong className="text-foreground tabular-nums">{fmt(total)}</strong></span>}
                                <span className="inline-flex items-center gap-1"><Clock className="w-4 h-4" aria-hidden="true" /> Atualizado em {updated.toLocaleDateString('pt-BR')} às {updated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              {itens.length > 0 && (
                                <div className="mt-3 overflow-x-auto rounded-[var(--g-raio)] border border-border">
                                  <table className="w-full">
                                    <thead className="bg-muted">
                                      <tr>
                                        <th className="g-meta px-3 py-2 text-left font-semibold">Descrição</th>
                                        <th className="g-meta w-16 px-3 py-2 text-right font-semibold">Qtde</th>
                                        <th className="g-meta w-28 whitespace-nowrap px-3 py-2 text-right font-semibold">Vl. Unit.</th>
                                        <th className="g-meta w-28 whitespace-nowrap px-3 py-2 text-right font-semibold">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                      {itens.slice(0, 10).map((it, i) => (
                                        <tr key={i} className="hover:bg-muted/50">
                                          {/* `truncate` escondia a descrição do
                                              item sem dizer que havia mais — e
                                              item de edital é distinguido justo
                                              pelo fim do texto ("..., 500ml").
                                              Expansão com botão de verdade. */}
                                          <td className="max-w-[320px] px-3 py-2 align-top">
                                            <TextoExpansivel texto={it.descricao} linhas={2} />
                                          </td>
                                          <td className="g-corpo px-3 py-2 text-right align-top tabular-nums">{it.quantidade}</td>
                                          <td className="g-corpo whitespace-nowrap px-3 py-2 text-right align-top tabular-nums">{it.valorUnitario ? fmt(it.valorUnitario) : '—'}</td>
                                          <td className="g-corpo whitespace-nowrap px-3 py-2 text-right align-top font-medium tabular-nums">{it.valorTotal ? fmt(it.valorTotal) : '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  {itens.length > 10 && (
                                    <p className="g-meta border-t border-border px-3 py-2 text-muted-foreground">
                                      + {itens.length - 10} itens adicionais — abra a Precificação para ver todos
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })() : (
                      <Card className="p-6">
                        <EstadoVazio
                          icone={<TrendingUp />}
                          titulo="Nenhuma planilha de custos salva ainda"
                          descricao="Acesse a Precificação e preencha os valores para que apareçam aqui."
                          acao={
                            <Button asChild variant="outline">
                              <Link to={`/precificacao?lid=${lic.id}`}>
                                <Calculator className="w-4 h-4" aria-hidden="true" /> Abrir Precificação
                              </Link>
                            </Button>
                          }
                        />
                      </Card>
                    )}

                    {/* Itens do catálogo */}
                    {precItems.length > 0 && (
                      <div>
                        <h3 className="g-titulo-secao mb-2">Itens precificados no catálogo ({precItems.length})</h3>
                        <div className="overflow-x-auto rounded-[var(--g-raio)] border border-border">
                          <table className="w-full">
                            <thead className="bg-muted">
                              <tr>
                                <th className="g-meta px-3 py-2 text-left font-semibold">Descrição</th>
                                <th className="g-meta w-28 whitespace-nowrap px-3 py-2 text-right font-semibold">Custo</th>
                                <th className="g-meta w-28 whitespace-nowrap px-3 py-2 text-right font-semibold">Preço</th>
                                <th className="g-meta w-20 whitespace-nowrap px-3 py-2 text-right font-semibold">Margem</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {precItems.slice(0, 15).map(it => (
                                <tr key={it.id} className="hover:bg-muted/50">
                                  <td className="max-w-[360px] px-3 py-2 align-top">
                                    <TextoExpansivel texto={it.descricao} linhas={2} />
                                  </td>
                                  <td className="g-corpo whitespace-nowrap px-3 py-2 text-right align-top tabular-nums text-muted-foreground">{it.custo_unitario ? fmt(it.custo_unitario) : '—'}</td>
                                  <td className="g-corpo whitespace-nowrap px-3 py-2 text-right align-top font-medium tabular-nums">{it.preco_unitario ? fmt(it.preco_unitario) : '—'}</td>
                                  <td className="g-corpo whitespace-nowrap px-3 py-2 text-right align-top tabular-nums">{it.margem_lucro != null ? `${it.margem_lucro}%` : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {precItems.length > 15 && (
                            <p className="g-meta border-t border-border px-3 py-2 text-muted-foreground">
                              + {precItems.length - 15} itens adicionais
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </SecaoGestao>
            </TabsContent>

            {/* sub-aba: AURÉLIA conversacional */}
            <TabsContent value="prec-aurelia">
              <div className="overflow-hidden rounded-[var(--g-raio)] border border-border bg-card shadow-sm" style={{ height: 'calc(100vh - 280px)', minHeight: 480 }}>
                <AureliaPrecificacaoChat />
              </div>
            </TabsContent>
          </Tabs>
          </>
        )}

        {/* Proposta — Fase 2: trabalhada dentro do processo */}
        {aba === 'proposta' && (
          /* O MESMO formato do módulo Proposta Comercial, embutido no
             prontuário (wizard completo de 8 passos: edital, empresa,
             representante, planilha, declarações, layout, preview) — mesmo
             rascunho, sem sair do processo. A identidade do documento gerado é
             a da empresa PROPONENTE, e isso é regra de negócio do gerador:
             não se decide aqui. */
          <div className="space-y-4">
            {/* O envio acontece no portal; aqui a pessoa registra que aconteceu
                e o processo sai do radar sem passar pelo Kanban (19/09). */}
            <PropostaEnviadaCard
              licitacaoId={lic.id}
              status={lic.status}
              arquivadoEm={lic.arquivado_em}
              dataPropostaEnviada={lic.data_proposta_enviada}
              aoRegistrar={(novo, quando) => setLic((atual) => (
                atual ? { ...atual, status: novo, data_proposta_enviada: atual.data_proposta_enviada ?? quando } : atual
              ))}
            />
            <PropostaTecnica embedded licitacaoIdEmbed={lic.id} />
          </div>
        )}

        {/* Robô de Lances — só a participação deste processo, desta empresa.
            O painel com todas as disputas continua em /robo-lances. */}
        {aba === 'robo' && <AbaRoboDoProcesso licitacaoId={lic.id} empresaId={lic.empresa_id} />}

        {/* Histórico */}
        {aba === 'historico' && <HistoricoProcesso licitacaoId={lic.id} />}
      </TelaGestao>
    </AppLayout>
  );
}
