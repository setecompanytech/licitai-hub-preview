import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import {
  Search, ExternalLink,
  MapPin, Building2, Calendar as CalendarIcon, Clock, CheckCircle2, XCircle,
  PauseCircle, ChevronLeft, ChevronRight,
  Bookmark, BookmarkCheck, Info, Loader2, RefreshCw, AlertCircle, FileText,
  Rocket, ArrowRight, CheckCircle, ListChecks, ChevronDown, ChevronUp, X, Eraser
} from 'lucide-react';
import EditalActionsModal, { type EditalSeed } from '@/components/monitoramento/EditalActionsModal';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar } from '@/components/ui/calendar';
import MunicipiosByUFSelect from '@/components/monitoramento/MunicipiosByUFSelect';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Edital {
  id: string;
  numeroCompra: string;
  processo: string;
  objeto: string;
  orgao: string;
  cnpj: string;
  municipio: string;
  uf: string;
  esfera: string;
  modalidadeId: number;
  modalidade: string;
  valorEstimado: number | null;
  valorHomologado: number | null;
  dataPublicacao: string | null;
  dataAbertura: string | null;
  dataEncerramento: string | null;
  situacaoId: number;
  situacaoNome: string;
  situacaoCor: string;
  status: 'aberto' | 'encerrado' | 'suspenso' | 'homologado' | 'aguardando';
  srp: boolean;
  modoDisputa: string;
  tipoEdital: string;
  link: string;
  linkPncp: string;
  informacaoComplementar: string;
  // Coordenadas PNCP para extração automática de itens
  anoCompra: string | null;
  sequencialCompra: string | null;
  numeroControlePncp: string | null;
}

interface ResultadoBusca {
  data: Edital[];
  total: number;
  paginas: number;
  pagina: number;
  aviso?: string;
}

// ─── Constantes do SIASG ─────────────────────────────────────────────────────

const UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS',
  'MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC',
  'SE','SP','TO',
];

// Modalidades conforme Lei 14.133/2021 (Art. 28) — modalidade_id PNCP
type ModalidadeLei14133 =
  | 'pregao'
  | 'concorrencia'
  | 'concurso'
  | 'leilao'
  | 'dialogo'
  | 'dispensa'
  | 'inexigibilidade'
  | 'credenciamento'
  | 'pre_qualificacao'
  | 'manifestacao'
  | 'todas';

const MODALIDADES_LEI14133: { id: ModalidadeLei14133; label: string }[] = [
  { id: 'pregao', label: 'Pregão' },
  { id: 'concorrencia', label: 'Concorrência' },
  { id: 'concurso', label: 'Concurso' },
  { id: 'leilao', label: 'Leilão' },
  { id: 'dialogo', label: 'Diálogo Competitivo' },
  { id: 'todas', label: 'Todas' },
];

// Contratações Diretas (Lei 14.133/2021, Arts. 74–79)
const CONTRATACOES_DIRETAS: { id: ModalidadeLei14133; label: string }[] = [
  { id: 'dispensa', label: 'Dispensa de Licitação' },
  { id: 'inexigibilidade', label: 'Inexigibilidade' },
  { id: 'credenciamento', label: 'Credenciamento' },
  { id: 'pre_qualificacao', label: 'Pré-qualificação' },
  { id: 'manifestacao', label: 'Manifestação de Interesse' },
];

// Sub-tipos de Concorrência (Lei 14.133)
const TIPOS_CONCORRENCIA = [
  { id: 'conc_eletr', label: 'Concorrência Eletrônica', modalidadeId: 4 },
  { id: 'conc_pres', label: 'Concorrência Presencial', modalidadeId: 5 },
  { id: 'todos_conc', label: 'Todos' },
];

// Sub-tipos de Pregão (Lei 14.133)
const TIPOS_PREGAO = [
  { id: 'pregao_eletr', label: 'Pregão Eletrônico', modalidadeId: 6 },
  { id: 'pregao_pres', label: 'Pregão Presencial', modalidadeId: 7 },
  { id: 'todos_pregao', label: 'Todos' },
];

// Sub-tipos de Leilão (Lei 14.133)
const TIPOS_LEILAO = [
  { id: 'leilao_eletr', label: 'Leilão Eletrônico', modalidadeId: 1 },
  { id: 'leilao_pres', label: 'Leilão Presencial', modalidadeId: 13 },
  { id: 'todos_leilao', label: 'Todos' },
];

const ALL_MODALIDADE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

const STATUS_CONFIG = {
  aberto:     { label: 'Aberto',     Icon: CheckCircle2, cls: 'bg-success/15 text-success border-success/30' },
  aguardando: { label: 'Aguardando', Icon: Clock,        cls: 'bg-info/15 text-info border-info/30' },
  suspenso:   { label: 'Suspenso',   Icon: PauseCircle,  cls: 'bg-warning/15 text-warning border-warning/30' },
  homologado: { label: 'Homologado', Icon: CheckCircle2, cls: 'bg-primary/15 text-primary border-primary/30' },
  encerrado:  { label: 'Encerrado',  Icon: XCircle,      cls: 'bg-muted/50 text-muted-foreground border-border' },
};

const ESFERA_LABELS: Record<string, string> = {
  F: 'Federal', E: 'Estadual', M: 'Municipal', D: 'Distrital',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMoeda(valor: number | null): string {
  if (!valor || valor <= 0) return 'Não informado';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(valor);
}

function formatData(iso: string | null): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return iso.slice(0, 10).split('-').reverse().join('/');
  }
}

function calcularDiasRestantes(iso: string | null): number | null {
  if (!iso) return null;
  try {
    const diff = parseISO(iso).getTime() - Date.now();
    return Math.ceil(diff / 86_400_000);
  } catch {
    return null;
  }
}

// Formata CNPJ: 14 dígitos → XX.XXX.XXX/XXXX-XX
function formatCnpj(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

// Converte 'dd/mm/aaaa' → 'aaaa-mm-dd' aceito pelo backend
function dmyToIso(dmy: string): string {
  const m = dmy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// Mapeia situação textual do PNCP → status da UI
function statusFromSituacao(situacao: string | null | undefined, dataAbertura: string | null): Edital['status'] {
  const s = (situacao || '').toLowerCase();
  if (s.includes('homolog')) return 'homologado';
  if (s.includes('suspens')) return 'suspenso';
  if (s.includes('encerrad') || s.includes('fechad') || s.includes('cancel') || s.includes('revogad') || s.includes('anulad')) {
    if (dataAbertura) {
      try {
        if (parseISO(dataAbertura).getTime() > Date.now()) return 'aguardando';
      } catch { /* noop */ }
    }
    return 'encerrado';
  }
  if (s.includes('divulgad') || s.includes('publicad') || s.includes('aberta') || s.includes('em andamento')) return 'aberto';
  if (s.includes('aguard')) return 'aguardando';
  return 'aberto';
}

interface FiltrosLei14133 {
  numero: string;
  ano: string;
  dataIni: string;     // dd/mm/aaaa
  dataFim: string;     // dd/mm/aaaa
  objeto: string;
  modalidades: ModalidadeLei14133[];
  tiposConc: string[];
  tiposPregao: string[];
  tiposLeilao: string[];
  ufs: string[];
  municipios: string[];
  cnpjs: string[];
  uasgs: string[];
  // Novos filtros PNCP
  esferas: string[];
  poderes: string[];
  tiposInstrumento: string[];
  statusFiltro: string[];
  orgaoTexto: string;
  unidadeTexto: string;
  conteudoNacional: '' | 'sim' | 'nao';
  emendaParlamentar: '' | 'sim' | 'nao';
  fontesOrcamentarias: string[];
  margensPreferencia: string[];
}

const filtrosVazios: FiltrosLei14133 = {
  numero: '',
  ano: String(new Date().getFullYear()),
  dataIni: '',
  dataFim: '',
  objeto: '',
  modalidades: [],
  tiposConc: [],
  tiposPregao: [],
  tiposLeilao: [],
  ufs: [],
  municipios: [],
  cnpjs: [],
  uasgs: [],
  esferas: [],
  poderes: [],
  tiposInstrumento: [],
  statusFiltro: [],
  orgaoTexto: '',
  unidadeTexto: '',
  conteudoNacional: '',
  emendaParlamentar: '',
  fontesOrcamentarias: [],
  margensPreferencia: [],
};

// Mapeamentos para filtros client-side
const ESFERA_LABEL_TO_CODE: Record<string, string> = { Federal: 'F', Estadual: 'E', Municipal: 'M', Distrital: 'D' };
const PODER_LABEL_TO_CODE: Record<string, string> = { Executivo: 'E', Legislativo: 'L', 'Judiciário': 'J', 'Ministério Público': 'M' };
const STATUS_LABEL_TO_KEY: Record<string, string> = { Aberto: 'aberto', Aguardando: 'aguardando', Suspenso: 'suspenso', Homologado: 'homologado', Encerrado: 'encerrado' };

// ─── Componente principal ────────────────────────────────────────────────────

export default function MonitoramentoEditais() {
  const [filtros, setFiltros] = useState<FiltrosLei14133>(filtrosVazios);
  const [tempCnpj, setTempCnpj] = useState('');
  const [tempUasg, setTempUasg] = useState('');
  const [tempMunicipio, setTempMunicipio] = useState('');

  const [resultado, setResultado] = useState<ResultadoBusca | null>(null);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [buscaRealizada, setBuscaRealizada] = useState(false);

  const [favoritos, setFavoritos] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('praefectus_fav_editais') || '[]'));
    } catch { return new Set(); }
  });

  // Map "numero||orgao" -> licitacao_id (processos já criados pelo usuário)
  const { user } = useAuth();
  const [emGestao, setEmGestao] = useState<Map<string, string>>(new Map());
  const [emCompromissos, setEmCompromissos] = useState<Map<string, string>>(new Map());
  const [modalEdital, setModalEdital] = useState<EditalSeed | null>(null);
  const [modalExistingId, setModalExistingId] = useState<string | null>(null);

  // Valores disponíveis para filtros de fonte orçamentária e margem de preferência
  const [fontesOrcamentariasOpts, setFontesOrcamentariasOpts] = useState<string[]>([]);
  const [margensPreferenciaOpts, setMargensPreferenciaOpts] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from('pncp_editais_cache')
      .select('fonte_orcamentaria')
      .not('fonte_orcamentaria', 'is', null)
      .limit(500)
      .then(({ data }) => {
        const uniq = [...new Set((data || []).map((r: any) => r.fonte_orcamentaria as string).filter(Boolean))].sort();
        setFontesOrcamentariasOpts(uniq);
      });
    supabase
      .from('pncp_editais_cache')
      .select('margem_preferencia')
      .not('margem_preferencia', 'is', null)
      .limit(500)
      .then(({ data }) => {
        const uniq = [...new Set((data || []).map((r: any) => r.margem_preferencia as string).filter(Boolean))].sort();
        setMargensPreferenciaOpts(uniq);
      });
  }, []);

  const carregarEmGestao = useCallback(async () => {
    if (!user) return;
    const [{ data: lics }, { data: comps }] = await Promise.all([
      supabase
        .from('licitacoes')
        .select('id, numero, orgao')
        .eq('user_id', user.id)
        .limit(2000),
      supabase
        .from('processos_interesse')
        .select('id, numero, orgao')
        .eq('user_id', user.id)
        .limit(2000),
    ]);
    const mapL = new Map<string, string>();
    (lics || []).forEach(l => {
      if (l.numero && l.orgao) mapL.set(`${l.numero}||${l.orgao}`, l.id);
    });
    setEmGestao(mapL);
    const mapC = new Map<string, string>();
    (comps || []).forEach(c => {
      if (c.numero && c.orgao) mapC.set(`${c.numero}||${c.orgao}`, c.id);
    });
    setEmCompromissos(mapC);
  }, [user]);

  useEffect(() => { carregarEmGestao(); }, [carregarEmGestao]);

  const abrirModalEdital = useCallback((seed: EditalSeed) => {
    const key = `${seed.numero}||${seed.orgao}`;
    setModalExistingId(emGestao.get(key) || null);
    setModalEdital(seed);
  }, [emGestao]);

  const handleProcessoCriado = useCallback((licitacaoId: string) => {
    if (!modalEdital) return;
    const key = `${modalEdital.numero}||${modalEdital.orgao}`;
    setEmGestao(prev => new Map(prev).set(key, licitacaoId));
  }, [modalEdital]);

  const handleCompromissoCriado = useCallback((compromissoId: string) => {
    if (!modalEdital) return;
    const key = `${modalEdital.numero}||${modalEdital.orgao}`;
    setEmCompromissos(prev => new Map(prev).set(key, compromissoId));
  }, [modalEdital]);

  const abortRef = useRef<AbortController | null>(null);

  // Resolve modalidade_id efetiva conforme Lei 14.133/2021
  const modalidadesEfetivas = useMemo<number[]>(() => {
    const ids = new Set<number>();
    if (filtros.modalidades.includes('todas')) return [];
    if (filtros.modalidades.includes('concurso')) ids.add(3);
    if (filtros.modalidades.includes('dialogo')) ids.add(2);
    if (filtros.modalidades.includes('dispensa')) ids.add(8);
    if (filtros.modalidades.includes('inexigibilidade')) ids.add(9);
    if (filtros.modalidades.includes('credenciamento')) ids.add(12);
    if (filtros.modalidades.includes('pre_qualificacao')) ids.add(11);
    if (filtros.modalidades.includes('manifestacao')) ids.add(10);
    // Concorrência: eletrônica (4) ou presencial (5)
    if (filtros.modalidades.includes('concorrencia')) {
      if (filtros.tiposConc.length === 0 || filtros.tiposConc.includes('todos_conc')) {
        ids.add(4); ids.add(5);
      } else {
        filtros.tiposConc.forEach(t => {
          const cfg = TIPOS_CONCORRENCIA.find(x => x.id === t);
          if (cfg?.modalidadeId) ids.add(cfg.modalidadeId);
        });
      }
    }
    // Pregão: eletrônico (6) ou presencial (7)
    if (filtros.modalidades.includes('pregao')) {
      if (filtros.tiposPregao.length === 0 || filtros.tiposPregao.includes('todos_pregao')) {
        ids.add(6); ids.add(7);
      } else {
        filtros.tiposPregao.forEach(t => {
          const cfg = TIPOS_PREGAO.find(x => x.id === t);
          if (cfg?.modalidadeId) ids.add(cfg.modalidadeId);
        });
      }
    }
    // Leilão: eletrônico (1) ou presencial (13)
    if (filtros.modalidades.includes('leilao')) {
      if (filtros.tiposLeilao.length === 0 || filtros.tiposLeilao.includes('todos_leilao')) {
        ids.add(1); ids.add(13);
      } else {
        filtros.tiposLeilao.forEach(t => {
          const cfg = TIPOS_LEILAO.find(x => x.id === t);
          if (cfg?.modalidadeId) ids.add(cfg.modalidadeId);
        });
      }
    }
    return Array.from(ids);
  }, [filtros.modalidades, filtros.tiposConc, filtros.tiposPregao, filtros.tiposLeilao]);

  const buscar = useCallback(async (pag = 1) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setBuscaRealizada(true);
    setCarregando(true);
    setErro(null);
    setResultado(null);

    const t0 = performance.now();
    const logCtx = (extra: Record<string, unknown> = {}) =>
      console.log('[Mural/buscar]', { pagina: pag, ...extra });

    try {
      // Monta termo de busca: combina objeto + nº licitação
      const termoPartes: string[] = [];
      if (filtros.objeto.trim()) termoPartes.push(filtros.objeto.trim());
      if (filtros.numero.trim()) termoPartes.push(filtros.numero.trim());
      
      const termo = termoPartes.join(' ').trim() || null;

      const dataIni = filtros.dataIni ? dmyToIso(filtros.dataIni) : null;
      const dataFim = filtros.dataFim ? dmyToIso(filtros.dataFim) : null;

      const buscandoPorNumero = !!filtros.numero.trim();

      // Validação de período — ignorada quando há número de licitação informado
      if (!buscandoPorNumero) {
        if ((filtros.dataIni && !filtros.dataFim) || (!filtros.dataIni && filtros.dataFim)) {
          const msg = 'Informe data inicial e final do período.';
          setErro(msg);
          setCarregando(false);
          toast.warning('Filtro de período incompleto', { description: msg });
          return;
        }
      }
      // Validação: data inicial não pode ser maior que final
      if (dataIni && dataFim && dataIni > dataFim) {
        const msg = 'Data inicial não pode ser posterior à data final.';
        setErro(msg);
        setCarregando(false);
        toast.warning('Período inválido', { description: msg });
        return;
      }

      const tamanho = 20;

      logCtx({
        etapa: 'inicio',
        termo,
        dataIni,
        dataFim,
        ufs: filtros.ufs,
        modalidades: modalidadesEfetivas,
        municipios: filtros.municipios,
        cnpjs: filtros.cnpjs,
      });

      // Lookup UASG → CNPJ/UF no cache para direcionar a busca no PNCP
      let uasgCnpjs: string[] = [];
      let uasgUfDesc: string | null = null;
      if (filtros.uasgs.length > 0) {
        try {
          const { data: uasgRows } = await supabase
            .from('pncp_editais_cache' as any)
            .select('cnpj_orgao, uf')
            .in('codigo_unidade' as any, filtros.uasgs)
            .not('cnpj_orgao', 'is', null)
            .limit(10);
          if (uasgRows && uasgRows.length > 0) {
            uasgCnpjs = [...new Set((uasgRows as any[]).map(r => r.cnpj_orgao).filter(Boolean))];
            const ufsFound = [...new Set((uasgRows as any[]).map(r => r.uf).filter(Boolean))];
            if (ufsFound.length === 1 && filtros.ufs.length === 0) uasgUfDesc = ufsFound[0] as string;
            logCtx({ etapa: 'uasg_lookup', uasgs: filtros.uasgs, cnpjs: uasgCnpjs, uf: uasgUfDesc });
          } else {
            logCtx({ etapa: 'uasg_lookup', uasgs: filtros.uasgs, resultado: 'nao_encontrado_no_cache' });
          }
        } catch (e: any) {
          console.warn('[UASG lookup] erro:', e?.message);
        }
      }

      // CNPJs efetivos para o PNCP: filtro manual + descobertos via UASG
      const cnpjsEfetivos = [...new Set([...filtros.cnpjs, ...uasgCnpjs])];

      // Quando há período informado, consulta a fonte oficial em tempo real.
      // Se a fonte não responder, volta para o cache PNCP local.
      const ufsList = filtros.ufs.length > 0 ? filtros.ufs : uasgUfDesc ? [uasgUfDesc] : [null];
      const modList = modalidadesEfetivas.length > 0 ? modalidadesEfetivas : [null];
      // Chave estável para deduplicação cross-fonte: prioriza pncp_id/numero_controle,
      // cai para id, e por último uma assinatura derivada (numero_compra + cnpj + ano)
      const chaveDedup = (r: any): string => {
        const k = r?.pncp_id || r?.numero_controle_pncp || r?.id;
        if (k) return String(k);
        const sig = `${r?.numero_compra || ''}|${r?.cnpj_orgao || ''}|${r?.ano_compra || ''}|${r?.uf || ''}`;
        return sig.length > 4 ? sig : `__sem_chave__${Math.random()}`;
      };

      const consultarCache = async (dIni?: string | null, dFim?: string | null) => {
        const calls: Promise<{ data: any[] | null; error: any }>[] = [];
        for (const uf of ufsList) {
          for (const mod of modList) {
            calls.push(
              Promise.resolve(supabase.rpc('busca_editais_instantanea' as any, {
                p_q: termo,
                p_uf: uf,
                p_municipio_ibge: null,
                p_esfera: null,
                p_modalidade_id: mod,
                p_segmento: null,
                p_data_inicio: dIni ?? dataIni,
                p_data_fim: dFim ?? dataFim,
                p_ordenacao: 'data_publicacao',
                p_direcao: 'desc',
                p_pagina: pag,
                p_tamanho: tamanho,
                p_fonte_orcamentaria: filtros.fontesOrcamentarias.length === 1 ? filtros.fontesOrcamentarias[0] : null,
                p_margem_preferencia: filtros.margensPreferencia.length === 1 ? filtros.margensPreferencia[0] : null,
              }) as any)
            );
          }
        }

        const respostas = await Promise.all(calls);
        const erros = respostas.filter(r => r.error).map(r => r.error?.message);
        const okCount = respostas.length - erros.length;
        logCtx({ etapa: 'cache', total_calls: respostas.length, ok: okCount, erros });
        if (erros.length === respostas.length) {
          throw new Error(erros[0] || 'Falha ao consultar o cache PNCP');
        }
        // Soma total_count de cada chamada (cada UF/modalidade tem seu próprio total).
        // Como o RPC já retorna total_count em cada linha, pegamos só o primeiro de cada chamada.
        let totalSomado = 0;
        const todas: any[] = [];
        for (const r of respostas) {
          const data = r.data || [];
          if (data.length > 0) totalSomado += Number(data[0].total_count) || 0;
          todas.push(...data);
        }
        return { rows: todas, totalSomado };
      };

      let rowsRaw: any[] = [];
      let totalLive = 0;
      let totalCache = 0;
      let liveOk = 0;
      let liveErr = 0;
      let usouCache = false;
      let pncpIndisponivel = false;
      const isUasgSemUf = filtros.cnpjs.length > 0 && filtros.ufs.length === 0;

      // Intervalo padrão quando nenhuma data foi informada:
      // - busca por número → ano inteiro do campo "ano" (01/01/ano a 31/12/ano)
      // - busca geral → últimos 90 dias (era 30 — aumentado para cobrir mais editais)
      const hojeStr = new Date().toISOString().slice(0, 10);
      let dataIniEfetiva: string;
      let dataFimEfetiva: string;
      if (dataIni && dataFim) {
        dataIniEfetiva = dataIni;
        dataFimEfetiva = dataFim;
      } else if (buscandoPorNumero) {
        const anoNum = filtros.ano.trim() ? Number(filtros.ano.trim()) : new Date().getFullYear();
        const anoValido = anoNum >= 2000 && anoNum <= new Date().getFullYear() + 1 ? anoNum : new Date().getFullYear();
        dataIniEfetiva = `${anoValido}-01-01`;
        dataFimEfetiva = `${anoValido}-12-31`;
      } else {
        const noventaDiasStr = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
        dataIniEfetiva = noventaDiasStr;
        dataFimEfetiva = hojeStr;
      }

      {
        // A API pública do PNCP não suporta busca por número de edital (numero_compra).
        // Nesse caso pulamos o live e usamos apenas o cache local que tem busca por número.
        const isNumeroBusca = buscandoPorNumero && /^[\d/\-\.]+$/.test(filtros.numero.trim());

        if (isNumeroBusca) {
          logCtx({ etapa: 'busca_por_numero_direto_cache' });
          const cacheRes = await consultarCache(dataIniEfetiva, dataFimEfetiva);
          rowsRaw = cacheRes.rows;
          totalCache = cacheRes.totalSomado;
          usouCache = true;
          logCtx({ etapa: 'cache_numero_fim', registros: rowsRaw.length });
        } else {

        // Quando nenhuma modalidade é selecionada, enviamos UMA chamada com modalidade vazia.
        // A edge function tem um caminho multi-modal otimizado para esse caso.
        // Quando modalidades específicas são selecionadas, fazemos uma chamada por modalidade.
        const modalidadesList: (number | null)[] = modalidadesEfetivas.length > 0
          ? modalidadesEfetivas
          : [null];

        const esfera = filtros.esferas.length === 1
          ? (ESFERA_LABEL_TO_CODE[filtros.esferas[0]] || '')
          : '';

        const liveCalls = ufsList.flatMap(uf =>
          modalidadesList.map(modalidade =>
            supabase.functions.invoke('busca-licitacoes', {
              body: {
                termo: termo || '',
                uf: uf || '',
                pagina: pag,
                tamanhoPagina: tamanho,
                dataInicial: dataIniEfetiva,
                dataFinal: dataFimEfetiva,
                modalidade: modalidade != null ? String(modalidade) : '',
                situacao: 'todas',
                esfera,
                cnpjs: cnpjsEfetivos.length > 0 ? cnpjsEfetivos : undefined,
              },
            })
          )
        );

        logCtx({ etapa: 'live_inicio', chamadas: liveCalls.length, pageSize: tamanho });
        const liveRespostas = await Promise.allSettled(liveCalls);
        rowsRaw = liveRespostas.flatMap((resp) => {
          if (resp.status !== 'fulfilled' || resp.value.error) {
            liveErr++;
            if (resp.status === 'fulfilled' && resp.value.error) {
              console.warn('[Mural/buscar] live erro:', resp.value.error?.message || resp.value.error);
            } else if (resp.status === 'rejected') {
              console.warn('[Mural/buscar] live rejected:', resp.reason);
            }
            return [];
          }
          const payload = resp.value.data as any;
          // Edge function retorna {error: "..."} no body quando PNCP está indisponível
          if (payload?.error) {
            liveErr++;
            console.warn('[Mural/buscar] pncp erro no body:', payload.error);
            return [];
          }
          liveOk++;
          if (payload?.cache) usouCache = true;
          // Soma o total de cada chamada (cada UF×modalidade é um conjunto independente)
          totalLive += Number(payload?.total) || 0;
          return (payload?.data || []).map((item: any) => ({
            id: item.id,
            pncp_id: item.pncpId || item.numeroControlePncp || item.id,
            numero_controle_pncp: item.numeroControlePncp || null,
            numero_compra: item.numeroCompra,
            ano_compra: item.anoCompra ? String(item.anoCompra) : null,
            sequencial_compra: item.sequencialCompra ? String(item.sequencialCompra) : null,
            objeto: item.objeto,
            orgao: item.orgao,
            cnpj_orgao: item.cnpj,
            municipio: item.municipio,
            uf: item.uf,
            esfera_id: item.esfera,
            poder_id: item.poder,
            unidade: item.unidade,
            unidade_orgao: item.unidade,
            codigo_unidade: item.codigoUnidade || '',
            modalidade_id: item.modalidadeId,
            modalidade_nome: item.modalidade,
            valor_total_estimado: item.valorEstimado,
            data_publicacao_pncp: item.dataPublicacao,
            data_abertura_proposta: item.dataAbertura,
            data_encerramento_proposta: item.dataEncerramento,
            situacao: item.situacaoNome,
            srp: item.srp,
            tipo_instrumento: item.tipoEdital,
            link_sistema_origem: item.link,
            url_pncp: item.linkPncp,
          }));
        });
        logCtx({ etapa: 'live_fim', ok: liveOk, erros: liveErr, registros: rowsRaw.length, totalLive });

        // Se todas as chamadas falharam E não trouxeram nada, tenta o cache RPC diretamente
        // (fallback duplo: a edge function já tenta o cache internamente, mas pode falhar no timeout)
        if (liveOk === 0 && rowsRaw.length === 0) {
          pncpIndisponivel = true;
          logCtx({ etapa: 'cache_fallback_direto' });
          try {
            const cacheRes = await consultarCache(dataIniEfetiva, dataFimEfetiva);
            rowsRaw = cacheRes.rows;
            totalCache = cacheRes.totalSomado;
            usouCache = true;
            logCtx({ etapa: 'cache_fallback_fim', registros: rowsRaw.length });
          } catch (cacheErr) {
            logCtx({ etapa: 'cache_fallback_erro', erro: String(cacheErr) });
          }
        }
      }


        } // fecha else (não é busca por número)

      // Deduplicação global por chave estável (suporta merge live+cache no futuro)
      const seen = new Set<string>();
      const rows: any[] = [];
      for (const r of rowsRaw) {
        const k = chaveDedup(r);
        if (seen.has(k)) continue;
        seen.add(k);
        rows.push(r);
      }
      const removidosDup = rowsRaw.length - rows.length;
      if (removidosDup > 0) logCtx({ etapa: 'dedup', removidos: removidosDup });

      // Filtros locais adicionais (campos sem cobertura na RPC)
      const ufsSet = new Set(filtros.ufs);
      // Municípios chegam no formato "Nome/UF" — extraímos só o nome para comparar
      const muniSet = new Set(
        filtros.municipios.map(m => m.split('/')[0].trim().toLowerCase())
      );
      // CNPJs armazenados só com dígitos para comparação normalizada
      const cnpjSet = new Set(filtros.cnpjs.map(c => c.replace(/\D/g, '')));
      const uasgSet = new Set(filtros.uasgs.map(u => String(u).trim()));

      // Pré-calcula sets para os novos filtros
      const esfSet = filtros.esferas.length > 0
        ? new Set(filtros.esferas.map(e => ESFERA_LABEL_TO_CODE[e] || e))
        : null;
      const poderSet = filtros.poderes.length > 0
        ? new Set(filtros.poderes.map(p => PODER_LABEL_TO_CODE[p] || p))
        : null;
      const statusSet = filtros.statusFiltro.length > 0
        ? new Set(filtros.statusFiltro.map(s => STATUS_LABEL_TO_KEY[s] || s.toLowerCase()))
        : null;
      const orgaoNorm = filtros.orgaoTexto.trim()
        ? filtros.orgaoTexto.trim().toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '')
        : null;
      const unidadeNorm = filtros.unidadeTexto.trim()
        ? filtros.unidadeTexto.trim().toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '')
        : null;

      const filtrados = rows.filter(r => {
        if (ufsSet.size > 0 && !ufsSet.has(r.uf)) return false;
        if (muniSet.size > 0 && !muniSet.has(String(r.municipio || '').toLowerCase())) return false;
        if (cnpjSet.size > 0) {
          const cnpjRow = String(r.cnpj_orgao || '').replace(/\D/g, '');
          if (!cnpjSet.has(cnpjRow)) return false;
        }
        if (uasgSet.size > 0) {
          const codigoUnidade = String(r.codigo_unidade || '').trim();
          const matches = Array.from(uasgSet).some(u => codigoUnidade === u || String(r.unidade_orgao || '').includes(u));
          if (!matches) return false;
        }
        if (filtros.ano && filtros.numero) {
          const numAno = `${filtros.numero}/${filtros.ano}`;
          if (!String(r.numero_compra || '').includes(numAno) && !String(r.numero_compra || '').includes(filtros.numero)) {
            return false;
          }
        }
        // Esferas
        if (esfSet && !esfSet.has(r.esfera_id)) return false;
        // Poderes
        if (poderSet && !poderSet.has(r.poder_id)) return false;
        // Tipos de instrumento
        if (filtros.tiposInstrumento.length > 0) {
          const ti = (r.tipo_instrumento || '').toLowerCase();
          const match = filtros.tiposInstrumento.some(t => ti.startsWith(t.toLowerCase()));
          if (!match) return false;
        }
        // Status/situação
        if (statusSet) {
          const st = statusFromSituacao(r.situacao, r.data_abertura_proposta);
          if (!statusSet.has(st)) return false;
        }
        // Órgão (busca parcial)
        if (orgaoNorm) {
          const nome = (r.orgao || '').toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '');
          if (!nome.includes(orgaoNorm)) return false;
        }
        // Unidade (busca parcial)
        if (unidadeNorm) {
          const nome = (r.unidade || r.unidade_orgao || '').toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '');
          if (!nome.includes(unidadeNorm)) return false;
        }
        // Conteúdo nacional (campo srp/indicador pode não estar disponível — filtra se presente)
        if (filtros.conteudoNacional === 'sim' && r.conteudo_nacional === false) return false;
        if (filtros.conteudoNacional === 'nao' && r.conteudo_nacional === true) return false;
        // Emenda parlamentar
        if (filtros.emendaParlamentar === 'sim' && r.emenda_parlamentar === false) return false;
        if (filtros.emendaParlamentar === 'nao' && r.emenda_parlamentar === true) return false;
        // Garantia final: rejeita itens fora do período efetivo, independente da fonte.
        // 1) Se o edital já encerrou ANTES do início do período selecionado → fora
        if (r.data_encerramento_proposta) {
          const enc = r.data_encerramento_proposta.slice(0, 10);
          if (enc < dataIniEfetiva) return false;
        }
        // 2) Se a data de referência (publicação ou abertura) é posterior ao fim do período → fora
        const dataRef = r.data_publicacao_pncp || r.data_abertura_proposta;
        if (dataRef) {
          const d = dataRef.slice(0, 10);
          if (d > dataFimEfetiva) return false;
        }
        return true;
      });

      const editais: Edital[] = filtrados.map(r => ({
        id: r.id,
        numeroCompra: r.numero_compra ?? '',
        processo: r.numero_compra ?? '',
        objeto: r.objeto ?? '',
        orgao: r.orgao ?? '',
        cnpj: r.cnpj_orgao ?? '',
        municipio: r.municipio ?? '',
        uf: r.uf ?? '',
        esfera: r.esfera_id ?? '',
        modalidadeId: r.modalidade_id ?? 0,
        modalidade: r.modalidade_nome ?? '',
        valorEstimado: r.valor_total_estimado != null ? Number(r.valor_total_estimado) : null,
        valorHomologado: null,
        dataPublicacao: r.data_publicacao_pncp ?? null,
        dataAbertura: r.data_abertura_proposta ?? null,
        dataEncerramento: r.data_encerramento_proposta ?? null,
        situacaoId: 0,
        situacaoNome: r.situacao ?? '',
        situacaoCor: '',
        status: statusFromSituacao(r.situacao, r.data_abertura_proposta),
        srp: !!r.srp,
        modoDisputa: '',
        tipoEdital: r.tipo_instrumento ?? '',
        link: r.link_sistema_origem ?? r.link_comprasnet ?? '',
        linkPncp: r.url_pncp ?? '',
        informacaoComplementar: '',
        anoCompra: r.ano_compra ?? null,
        sequencialCompra: r.sequencial_compra ?? null,
        numeroControlePncp: r.numero_controle_pncp ?? null,
      }));

      // Validação do total reportado pela API (soma UF×modalidade):
      // 1) Não pode ser menor que a quantidade efetivamente recebida (rowsRaw) — indica
      //    que a fonte reportou totais inconsistentes; nesse caso usamos o que veio.
      // 2) Após dedup, o total único nunca pode exceder o reportado; corrigimos divergências.
      // 3) Se filtros client-side reduziram o conjunto, o total passa a refletir o filtrado.
      const totalSomado = usouCache ? totalCache : totalLive;
      const totalRecebido = rowsRaw.length;
      const totalUnico = rows.length;

      let totalReportado = totalSomado;
      const divergencias: Record<string, number> = {};
      if (totalSomado < totalRecebido) {
        divergencias.somado_menor_que_recebido = totalRecebido - totalSomado;
        totalReportado = totalRecebido;
      }
      // Desconta duplicatas detectadas para não inflar o total exibido.
      const duplicatasDetectadas = totalRecebido - totalUnico;
      if (duplicatasDetectadas > 0) {
        divergencias.duplicatas_descontadas = duplicatasDetectadas;
        totalReportado = Math.max(totalUnico, totalReportado - duplicatasDetectadas);
      }

      const reduziu = filtrados.length !== rows.length;
      const total = reduziu ? filtrados.length : Math.max(totalReportado, totalUnico);
      // paginas usa sempre o total do servidor: filtros client-side afetam só a página atual,
      // não o número total de páginas — preserva a navegação entre páginas.
      const totalParaPaginas = Math.max(totalReportado, totalUnico);
      const paginas = Math.max(1, Math.ceil(totalParaPaginas / tamanho));

      if (Object.keys(divergencias).length > 0) {
        logCtx({
          etapa: 'total_validacao',
          totalSomado,
          totalRecebido,
          totalUnico,
          totalFinal: total,
          divergencias,
        });
      }

      setResultado({
        data: editais,
        total,
        paginas,
        pagina: pag,
      });
      setPagina(pag);

      const dt = Math.round(performance.now() - t0);
      logCtx({ etapa: 'fim', registros: editais.length, total, ms: dt });

      // Telemetria de consistência: registra a busca no banco para investigação posterior.
      try {
        const fonteUsada: 'live' | 'cache' | 'misto' | 'nenhuma' =
          totalRecebido === 0 ? 'nenhuma' : usouCache ? 'cache' : 'live';
        const temDivergencia = Object.keys(divergencias).length > 0;
        const severidade: 'info' | 'warning' | 'error' =
          liveErr > 0 && liveOk === 0 ? 'error'
          : temDivergencia || duplicatasDetectadas > 0 ? 'warning'
          : 'info';
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('mural_busca_telemetria' as any).insert({
          user_id: user?.id ?? null,
          pagina: pag,
          fonte: fonteUsada,
          total_somado: totalSomado,
          total_recebido: totalRecebido,
          total_unico: totalUnico,
          total_filtrado: filtrados.length,
          total_final: total,
          duplicatas: duplicatasDetectadas,
          divergencias,
          filtros: {
            ufs: filtros.ufs,
            modalidades: modalidadesEfetivas,
            municipios: filtros.municipios,
            cnpjs: filtros.cnpjs,
            dataIni, dataFim,
            termo: termo ?? null,
          },
          chamadas_total: liveOk + liveErr,
          chamadas_ok: liveOk,
          chamadas_erro: liveErr,
          duracao_ms: dt,
          severidade,
        });
      } catch (telErr) {
        console.warn('[Mural/telemetria] falha ao registrar:', telErr);
      }

      if (editais.length === 0) {
        if (liveErr > 0 && liveOk === 0 && !usouCache) {
          toast.warning('PNCP temporariamente indisponível', {
            description: 'Não foi possível buscar editais agora. Tente novamente em alguns minutos.',
          });
        } else if (uasgSet.size > 0) {
          toast.info('Nenhum edital encontrado para esta UASG', {
            description: 'Verifique se o código está correto ou amplie o período de busca.',
            duration: 5000,
          });
        } else if (cnpjSet.size > 0) {
          toast.info('Nenhum edital encontrado para este CNPJ', {
            description: 'Verifique se o CNPJ está correto ou amplie o período de busca.',
            duration: 5000,
          });
        } else {
          toast.info('Nenhum edital encontrado', {
            description: 'Tente ampliar o período ou remover filtros (UF, modalidade, município).',
          });
        }
      }
      if (usouCache && editais.length > 0) {
        toast.info('Exibindo dados do cache', {
          description: 'O PNCP está com instabilidade. Os resultados são do último acesso ao sistema.',
          duration: 4000,
        });
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      const msg = e instanceof Error ? e.message : 'Erro ao consultar o cache PNCP';
      setErro(msg);
      setResultado(null);
      toast.error('Erro na consulta', { description: msg });
    } finally {
      setCarregando(false);
    }
  }, [filtros, modalidadesEfetivas]);

  const toggleFavorito = (id: string) => {
    setFavoritos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem('praefectus_fav_editais', JSON.stringify([...next]));
      return next;
    });
  };

  const limparFiltros = () => {
    setFiltros(filtrosVazios);
    setTempCnpj('');
    setTempUasg('');
    setTempMunicipio('');
    setResultado(null);
    setBuscaRealizada(false);
    setErro(null);
  };

  // Helpers de toggle multi-select
  const toggleArr = <K extends keyof FiltrosLei14133>(campo: K, valor: any) => {
    setFiltros(prev => {
      const arr = prev[campo] as any[];
      const next = arr.includes(valor) ? arr.filter(v => v !== valor) : [...arr, valor];
      return { ...prev, [campo]: next } as FiltrosLei14133;
    });
  };

  const setMod = (m: ModalidadeLei14133) => {
    if (m === 'todas') {
      setFiltros(prev => ({ ...prev, modalidades: prev.modalidades.includes('todas') ? [] : ['todas'] }));
    } else {
      setFiltros(prev => {
        const semTodas = prev.modalidades.filter(x => x !== 'todas');
        const next = semTodas.includes(m) ? semTodas.filter(x => x !== m) : [...semTodas, m];
        return { ...prev, modalidades: next };
      });
    }
  };

  // Formatadores de input dd/mm/aaaa
  const formatDateInput = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 8);
    if (n.length <= 2) return n;
    if (n.length <= 4) return `${n.slice(0, 2)}/${n.slice(2)}`;
    return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`;
  };

  const filtrosAtivosCount = useMemo(() => {
    let n = 0;
    if (filtros.numero) n++;
    if (filtros.dataIni || filtros.dataFim) n++;
    if (filtros.objeto) n++;
    if (filtros.modalidades.length > 0) n++;
    if (filtros.tiposConc.length > 0) n++;
    if (filtros.tiposPregao.length > 0) n++;
    if (filtros.tiposLeilao.length > 0) n++;
    if (filtros.ufs.length > 0) n++;
    if (filtros.municipios.length > 0) n++;
    if (filtros.cnpjs.length > 0) n++;
    if (filtros.uasgs.length > 0) n++;
    if (filtros.esferas.length > 0) n++;
    if (filtros.poderes.length > 0) n++;
    if (filtros.tiposInstrumento.length > 0) n++;
    if (filtros.statusFiltro.length > 0) n++;
    if (filtros.orgaoTexto) n++;
    if (filtros.unidadeTexto) n++;
    if (filtros.conteudoNacional) n++;
    if (filtros.emendaParlamentar) n++;
    return n;
  }, [filtros]);

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">
              Licitações do Governo Federal
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pesquisa avançada estilo SIASG/Compras.gov.br · Cache PNCP local
            </p>
          </div>
          <div className="flex items-center gap-2">
            {resultado && (
              <span className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">
                  {resultado.total.toLocaleString('pt-BR')}
                </span> editais encontrados
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => buscar(pagina)}
              disabled={carregando || !buscaRealizada}
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${carregando ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Painel de filtros estilo SIASG */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Search className="w-4 h-4 text-accent" />
              <span className="font-semibold text-foreground">Pesquisa de licitações</span>
              {filtrosAtivosCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent text-xs font-medium">
                  {filtrosAtivosCount} filtro(s)
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Caso não seja informado o número da licitação, será obrigatório informar o Período de Publicação e Modalidade.
            </p>
          </div>

          <div className="p-5 space-y-5">
            {/* Linha 1: Número / Período */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
              <Label className="md:col-span-2 text-xs text-muted-foreground pt-2">Número da Licitação</Label>
              <div className="md:col-span-4 flex items-center gap-2">
                <Input
                  placeholder="Ex: 102005"
                  value={filtros.numero}
                  onChange={e => setFiltros(p => ({ ...p, numero: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  className="h-9 max-w-[160px]"
                />
                <span className="text-xs text-muted-foreground">/</span>
                <Input
                  placeholder="aaaa"
                  value={filtros.ano}
                  onChange={e => setFiltros(p => ({ ...p, ano: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                  className="h-9 max-w-[90px]"
                />
                <span className="text-[11px] text-muted-foreground">(número e ano)</span>
              </div>

              <Label className="md:col-span-2 text-xs text-muted-foreground pt-2">Período de Publicação</Label>
              <div className="md:col-span-4 flex items-center gap-2">
                <DateField
                  value={filtros.dataIni}
                  onChange={(v) => setFiltros(p => ({ ...p, dataIni: v }))}
                  placeholder="dd/mm/aaaa"
                />
                <span className="text-xs text-muted-foreground">até</span>
                <DateField
                  value={filtros.dataFim}
                  onChange={(v) => setFiltros(p => ({ ...p, dataFim: v }))}
                  placeholder="dd/mm/aaaa"
                />
              </div>
            </div>

            {/* Linha 2: Objeto */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              <Label className="md:col-span-2 text-xs text-muted-foreground">Objeto</Label>
              <div className="md:col-span-10 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Ex: material de escritório, equipamentos médicos…"
                  value={filtros.objeto}
                  onChange={e => setFiltros(p => ({ ...p, objeto: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') buscar(1); }}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            {/* Linha 3: Modalidades — Lei 14.133/2021 (Art. 28) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <Label className="md:col-span-2 text-xs text-muted-foreground pt-2">
                Modalidades
                <span className="block text-[10px] text-muted-foreground/70 font-normal mt-0.5">
                  Lei 14.133/2021
                </span>
              </Label>
              <div className="md:col-span-10 space-y-4">
                {/* Bloco 1: Modalidades de Licitação (Art. 28) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3">
                  {/* Coluna 1: Modalidades base */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-foreground mb-1">Modalidades de Licitação</p>
                    {MODALIDADES_LEI14133.map(m => (
                      <CheckboxRow
                        key={m.id}
                        checked={
                          filtros.modalidades.includes(m.id) ||
                          (m.id !== 'todas' && filtros.modalidades.includes('todas'))
                        }
                        onChange={() => setMod(m.id)}
                        label={m.label}
                      />
                    ))}
                  </div>

                  {/* Coluna 2: Tipos de Concorrência */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-foreground mb-1">Tipos de Concorrência</p>
                    {TIPOS_CONCORRENCIA.map(t => (
                      <CheckboxRow
                        key={t.id}
                        checked={
                          filtros.tiposConc.includes(t.id) ||
                          filtros.modalidades.includes('todas')
                        }
                        onChange={() => toggleArr('tiposConc', t.id)}
                        label={t.label}
                        disabled={!filtros.modalidades.includes('concorrencia') && !filtros.modalidades.includes('todas')}
                      />
                    ))}
                  </div>

                  {/* Coluna 3: Tipos de Pregão */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-foreground mb-1">Tipos de Pregão</p>
                    {TIPOS_PREGAO.map(t => (
                      <CheckboxRow
                        key={t.id}
                        checked={
                          filtros.tiposPregao.includes(t.id) ||
                          filtros.modalidades.includes('todas')
                        }
                        onChange={() => toggleArr('tiposPregao', t.id)}
                        label={t.label}
                        disabled={!filtros.modalidades.includes('pregao') && !filtros.modalidades.includes('todas')}
                      />
                    ))}
                  </div>

                  {/* Coluna 4: Tipos de Leilão */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-foreground mb-1">Tipos de Leilão</p>
                    {TIPOS_LEILAO.map(t => (
                      <CheckboxRow
                        key={t.id}
                        checked={
                          filtros.tiposLeilao.includes(t.id) ||
                          filtros.modalidades.includes('todas')
                        }
                        onChange={() => toggleArr('tiposLeilao', t.id)}
                        label={t.label}
                        disabled={!filtros.modalidades.includes('leilao') && !filtros.modalidades.includes('todas')}
                      />
                    ))}
                  </div>
                </div>

                {/* Bloco 2: Contratações Diretas (Arts. 74–79) */}
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-xs font-semibold text-foreground mb-2">
                    Contratações Diretas
                    <span className="text-[10px] text-muted-foreground font-normal ml-1.5">
                      (Arts. 74–79 — Lei 14.133/2021)
                    </span>
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-2">
                    {CONTRATACOES_DIRETAS.map(m => (
                      <CheckboxRow
                        key={m.id}
                        checked={
                          filtros.modalidades.includes(m.id) ||
                          filtros.modalidades.includes('todas')
                        }
                        onChange={() => setMod(m.id)}
                        label={m.label}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Linha 4: Unidades da Federação (multi) */}
            <ChipMultiSelect
              label="Unidades da Federação"
              options={UFS}
              valores={filtros.ufs}
              onToggle={uf => toggleArr('ufs', uf)}
              onClear={() => setFiltros(p => ({ ...p, ufs: [] }))}
              placeholder="Selecione um ou mais estados"
            />

            {/* Linha 5: Municípios (filtrados por UF via API IBGE) */}
            <MunicipiosByUFSelect
              label="Municípios"
              ufs={filtros.ufs}
              selecionados={filtros.municipios}
              onToggle={(v) =>
                setFiltros(p => ({
                  ...p,
                  municipios: p.municipios.includes(v)
                    ? p.municipios.filter(x => x !== v)
                    : [...p.municipios, v],
                }))
              }
              onClear={() => setFiltros(p => ({ ...p, municipios: [] }))}
            />

            {/* Linha 6: CNPJ do Órgão */}
            <ChipFreeInput
              label="CNPJ do Órgão"
              valores={filtros.cnpjs.map(formatCnpj)}
              tempValue={tempCnpj}
              onTempChange={(v) => setTempCnpj(formatCnpj(v))}
              onAdd={(v) => {
                const digits = v.replace(/\D/g, '');
                if (digits.length !== 14) {
                  toast.warning('CNPJ inválido', { description: 'Informe os 14 dígitos do CNPJ.' });
                  return;
                }
                if (filtros.cnpjs.length >= 5) {
                  toast.warning('Máximo de 5 CNPJs');
                  return;
                }
                if (!filtros.cnpjs.includes(digits)) {
                  setFiltros(p => ({ ...p, cnpjs: [...p.cnpjs, digits] }));
                }
                setTempCnpj('');
              }}
              onRemove={(idx) => setFiltros(p => ({ ...p, cnpjs: p.cnpjs.filter((_, i) => i !== idx) }))}
              placeholder="Ex: 00.394.460/0232-90"
              hint="(máximo 5 CNPJs)"
            />

            {/* Linha 7: UASG */}
            <ChipFreeInput
              label="Cód. UASG (Unid. de Compra)"
              valores={filtros.uasgs}
              tempValue={tempUasg}
              onTempChange={(v) => setTempUasg(v.replace(/\D/g, '').slice(0, 6))}
              onAdd={(v) => {
                const code = v.replace(/\D/g, '').trim();
                if (!code) return;
                if (filtros.uasgs.length >= 5) {
                  toast.warning('Máximo de 5 UASGs');
                  return;
                }
                if (!filtros.uasgs.includes(code)) {
                  setFiltros(p => ({ ...p, uasgs: [...p.uasgs, code] }));
                }
                setTempUasg('');
              }}
              onRemove={(idx) => setFiltros(p => ({ ...p, uasgs: p.uasgs.filter((_, i) => i !== idx) }))}
              placeholder="Ex: 153021"
              hint="(máximo 5 UASGs)"
            />

            {/* Linha 7: Situação */}
            <ChipMultiSelect
              label="Situação"
              options={['Aberto', 'Aguardando', 'Suspenso', 'Homologado', 'Encerrado']}
              valores={filtros.statusFiltro}
              onToggle={v => toggleArr('statusFiltro', v)}
              onClear={() => setFiltros(p => ({ ...p, statusFiltro: [] }))}
              placeholder="Todos os status"
            />

            {/* Linha 8: Esferas */}
            <ChipMultiSelect
              label="Esferas"
              options={['Federal', 'Estadual', 'Municipal', 'Distrital']}
              valores={filtros.esferas}
              onToggle={v => toggleArr('esferas', v)}
              onClear={() => setFiltros(p => ({ ...p, esferas: [] }))}
              placeholder="Todas as esferas"
            />

            {/* Linha 9: Poderes */}
            <ChipMultiSelect
              label="Poderes"
              options={['Executivo', 'Legislativo', 'Judiciário', 'Ministério Público']}
              valores={filtros.poderes}
              onToggle={v => toggleArr('poderes', v)}
              onClear={() => setFiltros(p => ({ ...p, poderes: [] }))}
              placeholder="Todos os poderes"
            />

            {/* Linha 10: Tipos de Instrumento Convocatório */}
            <ChipMultiSelect
              label="Tipo de Instrumento"
              labelSub="Convocatório"
              options={['Edital', 'Aviso']}
              valores={filtros.tiposInstrumento}
              onToggle={v => toggleArr('tiposInstrumento', v)}
              onClear={() => setFiltros(p => ({ ...p, tiposInstrumento: [] }))}
              placeholder="Todos os tipos"
            />

            {/* Linha 11: Órgão */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              <Label className="md:col-span-2 text-xs text-muted-foreground">Órgão</Label>
              <div className="md:col-span-10 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Busca parcial por nome do órgão…"
                  value={filtros.orgaoTexto}
                  onChange={e => setFiltros(p => ({ ...p, orgaoTexto: e.target.value }))}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            {/* Linha 12: Unidade */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              <Label className="md:col-span-2 text-xs text-muted-foreground">Unidade</Label>
              <div className="md:col-span-10 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Busca parcial por nome da unidade…"
                  value={filtros.unidadeTexto}
                  onChange={e => setFiltros(p => ({ ...p, unidadeTexto: e.target.value }))}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            {/* Linha 13: Conteúdo Nacional / Emenda Parlamentar */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
              <Label className="md:col-span-2 text-xs text-muted-foreground pt-1">Outros filtros</Label>
              <div className="md:col-span-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Conteúdo Nacional */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">Exigência de Conteúdo Nacional</p>
                  <div className="flex items-center gap-4">
                    {(['', 'sim', 'nao'] as const).map(v => (
                      <label key={v} className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
                        <input
                          type="radio"
                          name="conteudoNacional"
                          value={v}
                          checked={filtros.conteudoNacional === v}
                          onChange={() => setFiltros(p => ({ ...p, conteudoNacional: v }))}
                          className="accent-accent w-3.5 h-3.5"
                        />
                        {v === '' ? 'Todos' : v === 'sim' ? 'Sim' : 'Não'}
                      </label>
                    ))}
                  </div>
                </div>
                {/* Emenda Parlamentar */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">Emenda Parlamentar</p>
                  <div className="flex items-center gap-4">
                    {(['', 'sim', 'nao'] as const).map(v => (
                      <label key={v} className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
                        <input
                          type="radio"
                          name="emendaParlamentar"
                          value={v}
                          checked={filtros.emendaParlamentar === v}
                          onChange={() => setFiltros(p => ({ ...p, emendaParlamentar: v }))}
                          className="accent-accent w-3.5 h-3.5"
                        />
                        {v === '' ? 'Todos' : v === 'sim' ? 'Sim' : 'Não'}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Linha 14: Fontes Orçamentárias / Margens de Preferência */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ChipMultiSelect
                label="Fontes Orçamentárias"
                options={fontesOrcamentariasOpts}
                valores={filtros.fontesOrcamentarias}
                onToggle={v => toggleArr('fontesOrcamentarias', v)}
                onClear={() => setFiltros(f => ({ ...f, fontesOrcamentarias: [] }))}
                placeholder={fontesOrcamentariasOpts.length === 0 ? 'Dados ainda não disponíveis' : 'Todas as fontes'}
                info={
                  <div className="space-y-2">
                    <p className="font-semibold text-amber-400">Fonte Orçamentária</p>
                    <p>Indica de onde vêm os recursos da licitação — ex: <span className="font-medium">Tesouro Nacional</span>, <span className="font-medium">Recursos Próprios</span>, <span className="font-medium">Convênio</span>.</p>
                    <div className="border-t border-white/10 pt-2 space-y-1">
                      <p className="font-medium text-amber-400/80 text-[11px] uppercase tracking-wide">Por que está vazio?</p>
                      <p>A API pública do PNCP <span className="font-semibold">não retorna esse campo na listagem</span> de editais — ele só existe no endpoint de detalhe individual de cada edital.</p>
                    </div>
                    <div className="border-t border-white/10 pt-2 space-y-1">
                      <p className="font-medium text-green-400/80 text-[11px] uppercase tracking-wide">Como preencher?</p>
                      <p>Nesta página, faça uma busca e clique em <span className="font-semibold">"Ver detalhes"</span> em qualquer edital dos resultados. O sistema consultará o PNCP e salvará a fonte automaticamente. Repita para alguns editais — as opções começarão a aparecer aqui.</p>
                    </div>
                  </div>
                }
              />
              <ChipMultiSelect
                label="Tipos de Margem de Preferência"
                options={margensPreferenciaOpts}
                valores={filtros.margensPreferencia}
                onToggle={v => toggleArr('margensPreferencia', v)}
                onClear={() => setFiltros(f => ({ ...f, margensPreferencia: [] }))}
                placeholder={margensPreferenciaOpts.length === 0 ? 'Dados ainda não disponíveis' : 'Todas as margens'}
                info={
                  <div className="space-y-2">
                    <p className="font-semibold text-amber-400">Margem de Preferência</p>
                    <p>Indica se a licitação aplica vantagem de preço para produtos ou serviços nacionais — ex: <span className="font-medium">Normal</span>, <span className="font-medium">Ampliada</span>.</p>
                    <div className="border-t border-white/10 pt-2 space-y-1">
                      <p className="font-medium text-amber-400/80 text-[11px] uppercase tracking-wide">Por que está vazio?</p>
                      <p>A API pública do PNCP <span className="font-semibold">não retorna esse campo na listagem</span> de editais. Dependendo da versão da API, ele pode aparecer só no detalhe individual.</p>
                    </div>
                    <div className="border-t border-white/10 pt-2 space-y-1">
                      <p className="font-medium text-green-400/80 text-[11px] uppercase tracking-wide">Como preencher?</p>
                      <p>O sistema tenta extrair esse dado automaticamente a cada coleta periódica do PNCP. As opções aparecerão aqui assim que estiverem disponíveis na próxima atualização.</p>
                    </div>
                  </div>
                }
              />
            </div>

            {/* Aviso Materiais/Serviços */}
            <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
              <p className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-accent" />
                <strong className="text-foreground">Materiais (CATMAT) e Serviços (CATSER):</strong>
                serão integrados via{' '}
                <a href="/preferencias-alertas" className="text-accent hover:underline font-medium">
                  Preferências de Alertas
                </a>
                {' '}— em desenvolvimento.
              </p>
            </div>

            {/* Botões OK / Limpar (estilo SIASG) */}
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Button
                onClick={() => buscar(1)}
                disabled={carregando}
                className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-8"
              >
                {carregando
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Pesquisando…</>
                  : <>OK</>}
              </Button>
              <Button variant="outline" onClick={limparFiltros} className="gap-1.5">
                <Eraser className="w-4 h-4" />
                Limpar
              </Button>
            </div>
          </div>
        </div>

        {/* Erro */}
        {erro && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3.5 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Erro na consulta</p>
              <p className="text-destructive/70 mt-0.5">{erro}</p>
            </div>
          </div>
        )}

        {/* Aviso */}
        {resultado?.aviso && (
          <div className="flex items-start gap-3 rounded-xl border border-warning/20 bg-warning/5 px-4 py-3.5 text-sm text-warning">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <p>{resultado.aviso}</p>
          </div>
        )}

        {/* Loading */}
        {carregando && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
            <p className="text-muted-foreground text-sm">Consultando base de editais…</p>
          </div>
        )}

        {/* Estado inicial */}
        {!buscaRealizada && !carregando && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
              <Search className="w-8 h-8 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Preencha os critérios de seleção e clique em OK</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Caso não informe o número da licitação, é obrigatório selecionar o <strong>Período de Publicação</strong> e a <strong>Modalidade</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Resultados */}
        {buscaRealizada && resultado && !carregando && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm px-1">
              <span className="text-muted-foreground">
                Exibindo <span className="text-foreground font-medium">{resultado.data.length}</span> de{' '}
                <span className="text-foreground font-medium">{resultado.total.toLocaleString('pt-BR')}</span> editais
              </span>
              <span className="text-muted-foreground">
                Página {pagina} de {resultado.paginas}
              </span>
            </div>

            {resultado.data.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                <FileText className="w-10 h-10 opacity-30" />
                <p className="text-sm">Nenhum edital encontrado para os filtros selecionados.</p>
              </div>
            ) : (
              resultado.data.map((edital) => {
                const key = `${edital.numeroCompra}||${edital.orgao}`;
                return (
                  <EditalCard
                    key={edital.id}
                    edital={edital}
                    favoritado={favoritos.has(edital.id)}
                    onFavoritar={() => toggleFavorito(edital.id)}
                    licitacaoId={emGestao.get(key) || null}
                    compromissoId={emCompromissos.get(key) || null}
                    onIniciarProcesso={() => abrirModalEdital({
                      numero: edital.numeroCompra,
                      orgao: edital.orgao,
                      objeto: edital.objeto,
                      modalidade: edital.modalidade,
                      valor_estimado: edital.valorEstimado,
                      uf: edital.uf,
                      municipio: edital.municipio,
                      data_encerramento: edital.dataEncerramento,
                      portal: 'PNCP',
                      url: edital.linkPncp || null,
                      pncpNumero: edital.numeroControlePncp || null,
                      cnpjOrgao: edital.cnpj || null,
                      anoCompra: edital.anoCompra || null,
                      sequencialCompra: edital.sequencialCompra || null,
                    })}
                  />
                );
              })
            )}

            {resultado.paginas > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagina <= 1 || carregando}
                  onClick={() => buscar(pagina - 1)}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />Anterior
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(resultado.paginas, 7) }, (_, i) => {
                    const p = pagina <= 4 ? i + 1
                      : pagina >= resultado.paginas - 3 ? resultado.paginas - 6 + i
                      : pagina - 3 + i;
                    if (p < 1 || p > resultado.paginas) return null;
                    return (
                      <button
                        key={p}
                        onClick={() => buscar(p)}
                        className={`w-8 h-8 rounded-lg text-sm transition-colors ${
                          p === pagina
                            ? 'bg-accent text-accent-foreground font-semibold'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagina >= resultado.paginas || carregando}
                  onClick={() => buscar(pagina + 1)}
                >
                  Próxima<ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <EditalActionsModal
        open={!!modalEdital}
        onOpenChange={(v) => { if (!v) { setModalEdital(null); setModalExistingId(null); } }}
        edital={modalEdital}
        existingId={modalExistingId}
        onCreated={handleProcessoCriado}
        onCompromissoCreated={handleCompromissoCriado}
      />
    </AppLayout>
  );
}

// ─── Sub-componentes do formulário SIASG ─────────────────────────────────────

function CheckboxRow({
  checked, onChange, label, disabled,
}: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-2 text-xs ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:text-foreground'} text-muted-foreground transition-colors`}>
      <Checkbox checked={checked} onCheckedChange={() => !disabled && onChange()} disabled={disabled} className="h-3.5 w-3.5" />
      <span>{label}</span>
    </label>
  );
}

function ChipMultiSelect({
  label, labelSub, options, valores, onToggle, onClear, placeholder, info,
}: {
  label: string;
  labelSub?: string;
  options: string[];
  valores: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
  placeholder: string;
  info?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
      <Label className="md:col-span-2 text-xs text-muted-foreground pt-2">
        {label}
        {labelSub && (
          <span className="block text-[10px] text-muted-foreground/70 font-normal mt-0.5">{labelSub}</span>
        )}
      </Label>
      <div className="md:col-span-10 space-y-2">
        <div
          className="rounded-md border border-border bg-background min-h-[40px] px-2 py-1.5 flex flex-wrap gap-1.5 items-center cursor-pointer"
          onClick={() => setOpen(o => !o)}
        >
          {valores.length === 0 ? (
            <span className="text-xs text-muted-foreground px-1.5 flex items-center gap-1.5">
              {info && options.length === 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/15 text-amber-600 text-[10px] font-bold cursor-help shrink-0"
                        onClick={e => e.stopPropagation()}
                      >
                        !
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-sm text-xs leading-relaxed p-3">
                      {info}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {placeholder}
            </span>
          ) : (
            valores.map(v => (
              <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-accent/15 text-accent text-xs font-medium">
                {v}
                <button onClick={(e) => { e.stopPropagation(); onToggle(v); }} className="hover:text-accent-foreground">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
          <div className="ml-auto flex items-center gap-1">
            {valores.length > 0 && (
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onClear(); }} className="h-6 text-[11px] px-2 text-muted-foreground hover:text-destructive">
                Excluir
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }} className="h-6 text-[11px] px-2">
              {open ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
              Selecionar
            </Button>
          </div>
        </div>
        {open && options.length === 0 && info && (
          <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-2.5 text-xs text-amber-900 dark:text-amber-200 leading-relaxed [&_p]:mb-1 [&_.border-t]:border-amber-200 [&_.dark\:border-white\/10]:border-amber-200 [&_p.font-medium]:text-amber-700 dark:[&_p.font-medium]:text-amber-400">
            {info}
          </div>
        )}
        {open && options.length > 0 && (
          <div className="rounded-md border border-border bg-card p-3 grid grid-cols-6 sm:grid-cols-9 lg:grid-cols-14 gap-1.5">
            {options.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => onToggle(opt)}
                className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                  valores.includes(opt)
                    ? 'bg-accent text-accent-foreground border-accent'
                    : 'bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/50'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChipFreeInput({
  label, valores, tempValue, onTempChange, onAdd, onRemove, placeholder, hint, numericOnly,
}: {
  label: string;
  valores: string[];
  tempValue: string;
  onTempChange: (v: string) => void;
  onAdd: (v: string) => void;
  onRemove: (idx: number) => void;
  placeholder: string;
  hint?: string;
  numericOnly?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
      <Label className="md:col-span-2 text-xs text-muted-foreground pt-2">{label}</Label>
      <div className="md:col-span-10 space-y-2">
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        <div className="flex items-center gap-2">
          <Input
            value={tempValue}
            onChange={e => onTempChange(numericOnly ? e.target.value.replace(/\D/g, '') : e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onAdd(tempValue);
              }
            }}
            placeholder={placeholder}
            className="h-9 max-w-md"
          />
          <Button variant="outline" size="sm" onClick={() => onAdd(tempValue)} className="h-9">
            Selecionar
          </Button>
        </div>
        {valores.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {valores.map((v, i) => (
              <span key={`${v}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-accent/15 text-accent text-xs font-medium">
                {v}
                <button onClick={() => onRemove(i)} className="hover:text-accent-foreground">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Card do Edital (preservado do código original) ──────────────────────────

interface EditalCardProps {
  edital: Edital;
  favoritado: boolean;
  onFavoritar: () => void;
  licitacaoId: string | null;
  compromissoId: string | null;
  onIniciarProcesso: () => void;
}

const PNCP_API = 'https://pncp.gov.br/api/consulta/v1';

type AbaDetalhe = 'itens' | 'arquivos' | 'atas' | 'contratos' | 'historico';

function EditalCard({ edital, favoritado, onFavoritar, licitacaoId, compromissoId, onIniciarProcesso }: EditalCardProps) {
  const emGestao = !!licitacaoId;
  const emCompromisso = !!compromissoId;
  const [expandido, setExpandido] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<AbaDetalhe>('itens');
  const [detalhe, setDetalhe] = useState<any>(null);
  const [itens, setItens] = useState<any[]>([]);
  const [arquivos, setArquivos] = useState<any[]>([]);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const detalhesCarregadosRef = useRef(false);

  const statusCfg = STATUS_CONFIG[edital.status] || STATUS_CONFIG.encerrado;
  const { Icon: StatusIcon } = statusCfg;

  const diasRestantes = edital.status === 'aberto'
    ? calcularDiasRestantes(edital.dataEncerramento)
    : null;

  // Extrai CNPJ / ano / sequencial do linkPncp
  const pncpCoords = useMemo(() => {
    const m = (edital.linkPncp || '').match(/editais\/(\d{14})\/(\d{4})\/(\d+)/);
    if (!m) return null;
    return { cnpj: m[1], ano: m[2], seq: m[3] };
  }, [edital.linkPncp]);

  const carregarDetalhes = useCallback(async () => {
    if (detalhesCarregadosRef.current || !pncpCoords) return;
    detalhesCarregadosRef.current = true;
    setCarregandoDetalhe(true);
    try {
      const { cnpj, ano, seq } = pncpCoords;
      const base = `${PNCP_API}/orgaos/${cnpj}/compras/${ano}/${seq}`;
      const hdrs = { Accept: 'application/json' };
      const [rDet, rItens, rArqs] = await Promise.allSettled([
        fetch(base, { headers: hdrs }),
        fetch(`${base}/itens?pagina=1&tamanhoPagina=500`, { headers: hdrs }),
        fetch(`${base}/arquivos?pagina=1&tamanhoPagina=100`, { headers: hdrs }),
      ]);
      if (rDet.status === 'fulfilled' && rDet.value.ok) {
        const det = await rDet.value.json();
        setDetalhe(det);
        // Salva fonte_orcamentaria no cache para habilitar filtro
        const fontes: unknown[] = det.fontesOrcamentarias || (det.fonteOrcamentaria ? [det.fonteOrcamentaria] : []);
        if (Array.isArray(fontes) && fontes.length > 0 && pncpCoords) {
          const formatado = fontes
            .map((f: any) => {
              if (!f) return null;
              if (typeof f === 'string') return f;
              const parts = [f.codigoFonte, f.descricao, f.nome, f.fonte].filter(Boolean).map(String);
              return parts.length > 0 ? parts.join(' - ') : null;
            })
            .filter(Boolean)
            .join(' • ');
          if (formatado) {
            const pncpId = `${pncpCoords.cnpj}-${pncpCoords.ano}-${pncpCoords.seq}`;
            supabase.from('pncp_editais_cache')
              .update({ fonte_orcamentaria: formatado })
              .eq('pncp_id', pncpId)
              .is('fonte_orcamentaria', null)
              .then(() => {});
          }
        }
      }
      if (rItens.status === 'fulfilled' && rItens.value.ok) {
        const j = await rItens.value.json();
        setItens(Array.isArray(j) ? j : (j?.data ?? []));
      }
      if (rArqs.status === 'fulfilled' && rArqs.value.ok) {
        const j = await rArqs.value.json();
        setArquivos(Array.isArray(j) ? j : (j?.data ?? []));
      }
    } catch {
      // falha silenciosa — fallback será o link PNCP
    } finally {
      setCarregandoDetalhe(false);
    }
  }, [pncpCoords]);

  useEffect(() => {
    if (expandido) carregarDetalhes();
  }, [expandido, carregarDetalhes]);

  return (
    <div className={`rounded-xl border transition-colors ${
      expandido
        ? 'border-accent/30 bg-card'
        : 'border-border bg-card hover:border-border/80'
    }`}>
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium ${statusCfg.cls}`}>
            <StatusIcon className="w-3 h-3" />
            {statusCfg.label}
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-2 mb-1">
                  <span className="text-xs text-muted-foreground font-mono">{edital.numeroCompra}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                    {edital.modalidade}
                  </span>
                  {edital.srp && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20">
                      SRP
                    </span>
                  )}
                  {edital.esfera && (
                    <span className="text-xs text-muted-foreground">
                      {ESFERA_LABELS[edital.esfera] || edital.esfera}
                    </span>
                  )}
                  {emGestao && (
                    <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-success/15 text-success border border-success/30">
                      <CheckCircle className="w-3 h-3" />
                      Em gestão
                    </span>
                  )}
                  {emCompromisso && (
                    <a
                      href="/meus-compromissos"
                      className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-info/15 text-info border border-info/30 hover:bg-info/25 transition-colors"
                      title="Abrir em Meus Compromissos"
                    >
                      <ListChecks className="w-3 h-3" />
                      Em compromissos
                    </a>
                  )}
                </div>

                <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
                  {edital.objeto}
                </p>

                <div className="flex items-center flex-wrap gap-3 mt-1.5">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="w-3 h-3" />
                    {edital.orgao}
                  </span>
                  {(edital.municipio || edital.uf) && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      {[edital.municipio, edital.uf].filter(Boolean).join(' — ')}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0 ml-2">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Valor estimado</p>
                  <p className={`text-sm font-semibold ${
                    edital.valorEstimado ? 'text-success' : 'text-muted-foreground/50'
                  }`}>
                    {formatMoeda(edital.valorEstimado)}
                  </p>
                </div>

                {diasRestantes !== null && diasRestantes >= 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    diasRestantes <= 1
                      ? 'bg-destructive/15 text-destructive'
                      : diasRestantes <= 3
                        ? 'bg-warning/15 text-warning'
                        : 'bg-success/10 text-success'
                  }`}>
                    {diasRestantes === 0 ? 'Encerra hoje' : `${diasRestantes}d restantes`}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-4 mt-2">
              {edital.dataAbertura && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarIcon className="w-3 h-3" />
                  Abertura: <span className="text-foreground/70">{formatData(edital.dataAbertura)}</span>
                </span>
              )}
              {edital.dataEncerramento && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  Encerramento: <span className={`${
                    edital.status === 'aberto' && (calcularDiasRestantes(edital.dataEncerramento) ?? 99) <= 3
                      ? 'text-warning font-medium'
                      : 'text-foreground/70'
                  }`}>{formatData(edital.dataEncerramento)}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setExpandido(!expandido)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {expandido ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {expandido ? 'Menos detalhes' : 'Ver detalhes'}
            </button>
            <button
              onClick={onFavoritar}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                favoritado
                  ? 'text-accent hover:bg-accent/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {favoritado
                ? <BookmarkCheck className="w-3.5 h-3.5" />
                : <Bookmark className="w-3.5 h-3.5" />}
              {favoritado ? 'Salvo' : 'Salvar'}
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            {edital.link && (
              <a
                href={edital.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Sistema origem
              </a>
            )}
            {edital.linkPncp && (
              <a
                href={edital.linkPncp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                PNCP
              </a>
            )}
            <button
              onClick={onIniciarProcesso}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                emGestao
                  ? 'bg-success/10 text-success border-success/30 hover:bg-success/20'
                  : 'bg-accent text-accent-foreground border-accent hover:bg-accent/90'
              }`}
            >
              {emGestao ? <ArrowRight className="w-3.5 h-3.5" /> : <Rocket className="w-3.5 h-3.5" />}
              {emGestao ? 'Abrir processo' : 'Iniciar processo'}
            </button>
          </div>
        </div>
      </div>

      {expandido && (
        <div className="border-t border-border">
          {carregandoDetalhe ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-xs">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando detalhes completos do PNCP…
            </div>
          ) : (
            <div className="px-4 pb-4 pt-4 space-y-4">

              {/* ── Grade de metadados ── */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
                <DetalheItem label="Número do processo" valor={detalhe?.numeroControlePncp || edital.processo || '—'} mono />
                <DetalheItem label="Situação PNCP" valor={detalhe?.situacaoCompraNome || edital.situacaoNome || '—'} />
                <DetalheItem label="CNPJ do órgão" valor={edital.cnpj || detalhe?.cnpjOrgao || '—'} mono />
                <DetalheItem
                  label="Unidade compradora"
                  valor={
                    detalhe?.codigoUnidadeOrgao
                      ? `${detalhe.codigoUnidadeOrgao} — ${detalhe.nomeUnidadeOrgao || ''}`
                      : '—'
                  }
                />
                <DetalheItem label="Tipo de instrumento" valor={detalhe?.tipoInstrumentoConvocatorioNome || edital.tipoEdital || '—'} />
                <DetalheItem label="Modo de disputa" valor={detalhe?.modoDisputaNome || edital.modoDisputa || '—'} />
                <DetalheItem label="Registro de preços" valor={edital.srp ? 'Sim' : 'Não'} />
                <DetalheItem label="Esfera" valor={detalhe?.esferaNome || ESFERA_LABELS[edital.esfera] || edital.esfera || '—'} />
                <DetalheItem label="Poder" valor={detalhe?.poderNome || '—'} />
                <DetalheItem
                  label="Amparo legal"
                  valor={
                    detalhe?.amparoLegal?.descricao ||
                    detalhe?.amparoLegalDescricao ||
                    '—'
                  }
                />
                <DetalheItem
                  label="Fonte orçamentária"
                  valor={
                    detalhe?.fonteOrcamentaria ||
                    detalhe?.fonteOrcamentariaNome ||
                    'Não informada'
                  }
                />
                <DetalheItem label="Sistema de origem" valor={detalhe?.sistemaOrigem || '—'} />
                {edital.dataPublicacao && (
                  <DetalheItem label="Data de publicação" valor={formatData(edital.dataPublicacao)} />
                )}
                {(detalhe?.dataAberturaProposta || edital.dataAbertura) && (
                  <DetalheItem
                    label="Início de recebimento"
                    valor={formatData(detalhe?.dataAberturaProposta || edital.dataAbertura)}
                  />
                )}
                {(detalhe?.dataEncerramentoProposta || edital.dataEncerramento) && (
                  <DetalheItem
                    label="Fim de recebimento"
                    valor={formatData(detalhe?.dataEncerramentoProposta || edital.dataEncerramento)}
                  />
                )}
                {detalhe?.dataAtualizacao && (
                  <DetalheItem label="Última atualização" valor={formatData(detalhe.dataAtualizacao)} />
                )}
                {(edital.valorEstimado || detalhe?.valorTotalEstimado) && (
                  <DetalheItem
                    label="Valor total estimado"
                    valor={formatMoeda(detalhe?.valorTotalEstimado ?? edital.valorEstimado)}
                    destaque
                  />
                )}
                {(detalhe?.valorTotalHomologado) && (
                  <DetalheItem
                    label="Valor total homologado"
                    valor={formatMoeda(detalhe.valorTotalHomologado)}
                    destaque
                  />
                )}
              </div>

              {/* ── Objeto ── */}
              {(detalhe?.objetoCompra || edital.objeto) && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Objeto</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {detalhe?.objetoCompra || edital.objeto}
                  </p>
                </div>
              )}

              {/* ── Informação complementar ── */}
              {(detalhe?.informacaoComplementar || edital.informacaoComplementar) && (
                <div className="rounded-lg bg-muted/50 border border-border p-3">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Informação complementar
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {detalhe?.informacaoComplementar || edital.informacaoComplementar}
                  </p>
                </div>
              )}

              {/* ── Abas: Itens / Arquivos / Atas / Contratos / Histórico ── */}
              <div className="border-t border-border pt-3">
                <div className="flex gap-0 border-b border-border mb-3 overflow-x-auto">
                  {(
                    [
                      { key: 'itens' as const,     label: 'Itens',                  count: itens.length },
                      { key: 'arquivos' as const,   label: 'Arquivos',               count: arquivos.length },
                      { key: 'atas' as const,       label: 'Atas de Reg. de Preço',  count: 0 },
                      { key: 'contratos' as const,  label: 'Contratos/Empenhos',     count: 0 },
                      { key: 'historico' as const,  label: 'Histórico',              count: 0 },
                    ]
                  ).map(({ key, label, count }) => (
                    <button
                      key={key}
                      onClick={() => setAbaAtiva(key)}
                      className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                        abaAtiva === key
                          ? 'border-accent text-accent'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {label}
                      {count > 0 && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-muted text-[10px] font-normal">
                          {count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Itens */}
                {abaAtiva === 'itens' && (
                  itens.length === 0 ? (
                    <div className="py-6 text-center space-y-2">
                      <p className="text-xs text-muted-foreground">Nenhum item retornado pela API.</p>
                      {edital.linkPncp && (
                        <a href={edital.linkPncp} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                          <ExternalLink className="w-3 h-3" />Ver itens no portal PNCP
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded border border-border/60">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/40 border-b border-border text-muted-foreground">
                            <th className="text-left px-3 py-2 font-medium w-10">Nº</th>
                            <th className="text-left px-3 py-2 font-medium">Descrição</th>
                            <th className="text-right px-3 py-2 font-medium w-24">Quantidade</th>
                            <th className="text-right px-3 py-2 font-medium w-32">Vlr. unit. est.</th>
                            <th className="text-right px-3 py-2 font-medium w-32">Vlr. total est.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {itens.map((item: any, i: number) => {
                            const qtd = item.quantidade ?? item.quantidadeItens;
                            const vUnit = item.valorUnitarioEstimado ?? item.valorUnitario;
                            const vTotal = item.valorTotal ?? item.valorTotalEstimado
                              ?? (vUnit != null && qtd != null ? vUnit * qtd : null);
                            return (
                              <tr key={item.numeroItem ?? i} className="hover:bg-muted/20 transition-colors">
                                <td className="px-3 py-2 text-muted-foreground">{item.numeroItem ?? i + 1}</td>
                                <td className="px-3 py-2 text-foreground/80">
                                  {item.descricao || item.descricaoItem || '—'}
                                  {item.unidadeMedida && (
                                    <span className="ml-1.5 text-[10px] text-muted-foreground border border-border/60 px-1 rounded">
                                      {item.unidadeMedida}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right">{qtd?.toLocaleString('pt-BR') ?? '—'}</td>
                                <td className="px-3 py-2 text-right text-foreground/70">
                                  {vUnit != null ? formatMoeda(vUnit) : '—'}
                                </td>
                                <td className="px-3 py-2 text-right font-medium text-success">
                                  {vTotal != null ? formatMoeda(vTotal) : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                )}

                {/* Arquivos */}
                {abaAtiva === 'arquivos' && (
                  arquivos.length === 0 ? (
                    <div className="py-6 text-center space-y-2">
                      <p className="text-xs text-muted-foreground">Nenhum arquivo retornado pela API.</p>
                      {edital.linkPncp && (
                        <a href={edital.linkPncp} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                          <ExternalLink className="w-3 h-3" />Ver arquivos no portal PNCP
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {arquivos.map((arq: any, i: number) => (
                        <div key={arq.sequencialDocumento ?? i}
                          className="flex items-center justify-between p-2.5 rounded border border-border bg-muted/20 hover:bg-muted/40 transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-accent shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground/80 truncate">
                                {arq.titulo || arq.nomeArquivo || `Arquivo ${i + 1}`}
                              </p>
                              {arq.dataPublicacao && (
                                <p className="text-[10px] text-muted-foreground">{formatData(arq.dataPublicacao)}</p>
                              )}
                            </div>
                          </div>
                          {arq.url && (
                            <a href={arq.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 shrink-0 ml-3 px-2 py-1 rounded border border-accent/30 hover:bg-accent/10 transition-colors">
                              <ExternalLink className="w-3 h-3" />
                              Abrir
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* Atas / Contratos / Histórico — link direto ao PNCP */}
                {(abaAtiva === 'atas' || abaAtiva === 'contratos' || abaAtiva === 'historico') && (
                  <div className="py-6 text-center space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {abaAtiva === 'atas' && 'Atas de Registro de Preço disponíveis no portal PNCP.'}
                      {abaAtiva === 'contratos' && 'Contratos e empenhos disponíveis no portal PNCP.'}
                      {abaAtiva === 'historico' && 'Histórico de alterações disponível no portal PNCP.'}
                    </p>
                    {edital.linkPncp && (
                      <a href={edital.linkPncp} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                        <ExternalLink className="w-3.5 h-3.5" />
                        Abrir no portal PNCP
                      </a>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Detalhe auxiliar ────────────────────────────────────────────────────────

function DetalheItem({
  label, valor, mono = false, destaque = false,
}: { label: string; valor: string; mono?: boolean; destaque?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-sm ${mono ? 'font-mono' : ''} ${destaque ? 'text-success font-semibold' : 'text-foreground/80'}`}>
        {valor}
      </p>
    </div>
  );
}

// ─── Campo de Data com Calendário (Popover) ─────────────────────────────────

function formatDateInputBR(v: string) {
  const n = v.replace(/\D/g, '').slice(0, 8);
  if (n.length <= 2) return n;
  if (n.length <= 4) return `${n.slice(0, 2)}/${n.slice(2)}`;
  return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`;
}

function dmyToDate(dmy: string): Date | undefined {
  const m = dmy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return undefined;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) ? undefined : d;
}

function dateToDmy(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function DateField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = dmyToDate(value);
  return (
    <div className="flex items-center gap-1">
      <Input
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(formatDateInputBR(e.target.value))}
        className="h-9 max-w-[140px]"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label="Abrir calendário"
          >
            <CalendarIcon className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(d) => {
              if (d) {
                onChange(dateToDmy(d));
                setOpen(false);
              }
            }}
            locale={ptBR}
            initialFocus
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
