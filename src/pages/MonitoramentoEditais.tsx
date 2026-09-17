import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { cn } from '@/lib/utils';
import {
  Search, ExternalLink,
  MapPin, Building2, Calendar as CalendarIcon, Clock, CheckCircle2, XCircle,
  PauseCircle, ChevronLeft, ChevronRight,
  Bookmark, BookmarkCheck, Info, Loader2, RefreshCw, AlertCircle, FileText,
  Rocket, ArrowRight, CheckCircle, ListChecks, ChevronDown, ChevronUp, X, Eraser, Globe
} from 'lucide-react';
import EditalActionsModal, { type EditalSeed } from '@/components/monitoramento/EditalActionsModal';
import { identidadeDoEdital } from '@/lib/licitacao/identidade-edital';
import { fetchMunicipiosUF } from '@/lib/ibge-municipios';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
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

/** Famílias semânticas do Badge (identidade 12/09) — situação sempre com texto. */
type VarianteBadge = 'success' | 'warning' | 'danger' | 'info' | 'muted';

const STATUS_CONFIG: Record<string, { label: string; Icon: typeof CheckCircle2; variante: VarianteBadge }> = {
  aberto:     { label: 'Aberto',     Icon: CheckCircle2, variante: 'success' },
  aguardando: { label: 'Aguardando', Icon: Clock,        variante: 'info' },
  suspenso:   { label: 'Suspenso',   Icon: PauseCircle,  variante: 'warning' },
  homologado: { label: 'Homologado', Icon: CheckCircle2, variante: 'success' },
  encerrado:  { label: 'Encerrado',  Icon: XCircle,      variante: 'muted' },
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
  /* REBRAND — o painel SIASG tem 19 linhas de filtro e ocupava a tela inteira
     PARA SEMPRE. Depois de pesquisar, o resultado nascia abaixo de tudo isso:
     a pessoa buscava e precisava rolar o formulário inteiro para ver o que
     achou. Agora ele recolhe sozinho quando a busca volta, e o que estava
     marcado vira uma fileira de etiquetas legíveis no cabeçalho. Nada do
     formulário mudou — nem campo, nem validação, nem consulta. */
  const [painelAberto, setPainelAberto] = useState(true);

  const [favoritos, setFavoritos] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('praefectus_fav_editais') || '[]'));
    } catch { return new Set(); }
  });

  // Map "numero||orgao" -> licitacao_id (processos já criados pelo usuário)
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
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
      // Por empresa: se um colega ja puxou o edital, ele conta como "em gestao"
      (empresaAtiva
        ? supabase.from('licitacoes').select('id, numero, orgao').eq('empresa_id', empresaAtiva.id)
        : supabase.from('licitacoes').select('id, numero, orgao'))
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
  }, [user, empresaAtiva]);

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
            .from('pncp_editais_cache')
            .select('cnpj_orgao, uf')
            .in('codigo_unidade', filtros.uasgs)
            .not('cnpj_orgao', 'is', null)
            .limit(10);
          if (uasgRows && uasgRows.length > 0) {
            uasgCnpjs = [...new Set(uasgRows.map(r => r.cnpj_orgao).filter(Boolean))];
            const ufsFound = [...new Set(uasgRows.map(r => r.uf).filter(Boolean))];
            if (ufsFound.length === 1 && filtros.ufs.length === 0) uasgUfDesc = ufsFound[0];
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

      // Municípios → código IBGE (tudo-ou-nada): resolvidos, o corte acontece
      // no SERVIDOR (RPC e PNCP aceitam codigoMunicipioIbge) e o total de
      // páginas volta a ser VERDADEIRO — antes o corte era só local, página a
      // página, e o sistema anunciava 15 páginas com as últimas vazias
      // (12/09). Nome que não resolver mantém o corte local, sem perder nada.
      let muniIbgeList: (string | null)[] = [null];
      if (filtros.municipios.length > 0) {
        const codigos: string[] = [];
        const porUf = new Map<string, string[]>();
        for (const m of filtros.municipios) {
          const [nomeM, ufM] = m.split('/').map(x => x.trim());
          if (nomeM && ufM) porUf.set(ufM, [...(porUf.get(ufM) || []), nomeM]);
        }
        for (const [ufM, nomes] of porUf) {
          try {
            const lista = await fetchMunicipiosUF(ufM);
            for (const nomeM of nomes) {
              const hit = lista.find(x => x.nome.toLowerCase() === nomeM.toLowerCase());
              if (hit) codigos.push(String(hit.id));
            }
          } catch { /* IBGE fora do ar: cai no corte local desta busca */ }
        }
        if (codigos.length === filtros.municipios.length) muniIbgeList = codigos;
        logCtx({ etapa: 'municipios_ibge', pedidos: filtros.municipios.length, resolvidos: codigos.length });
      }

      const consultarCache = async (dIni?: string | null, dFim?: string | null) => {
        const calls: Promise<{ data: any[] | null; error: any }>[] = [];
        for (const uf of ufsList) {
          for (const mod of modList) {
           for (const muni of muniIbgeList) {
            calls.push(
              Promise.resolve(supabase.rpc('busca_editais_instantanea' as any, {
                p_q: termo,
                p_uf: uf,
                p_municipio_ibge: muni,
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
          modalidadesList.flatMap(modalidade =>
            muniIbgeList.map(muni =>
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
                  municipioIbge: muni || undefined,
                },
              })
            )
          )
        );

        logCtx({ etapa: 'live_inicio', chamadas: liveCalls.length, pageSize: tamanho });
        // O acervo local corre em PARALELO com o live e entra SEMPRE na união.
        // O PNCP pagina por publicação: edital visto ontem sai da página de
        // hoje — mas ele já está no cache (a edge function grava cada busca).
        // Sem a união, recarregar a página "apagava" editais da lista.
        const cachePromise = consultarCache(dataIniEfetiva, dataFimEfetiva)
          .catch((e) => { logCtx({ etapa: 'merge_cache_erro', erro: String(e) }); return { rows: [] as any[], totalSomado: 0 }; });
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

        // União com o acervo: só ACRESCENTA o que o live desta página não
        // trouxe; nunca remove. O dedup adiante mantém a linha do live, que
        // carrega a situação mais fresca.
        if (liveOk > 0) {
          const acervo = await cachePromise;
          if (acervo.rows.length > 0) {
            totalCache = acervo.totalSomado;
            logCtx({ etapa: 'merge_cache', do_acervo: acervo.rows.length, do_live: rowsRaw.length });
            rowsRaw = rowsRaw.concat(acervo.rows);
          }
        }

        // Se todas as chamadas falharam E não trouxeram nada, tenta o cache RPC diretamente
        // (fallback duplo: a edge function já tenta o cache internamente, mas pode falhar no timeout)
        if (liveOk === 0 && rowsRaw.length === 0) {
          pncpIndisponivel = true;
          logCtx({ etapa: 'cache_fallback_direto' });
          try {
            const cacheRes = await cachePromise;
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

      // A união chega em blocos (live primeiro, acervo depois); reordenada por
      // data, a lista lê como uma linha do tempo única.
      filtrados.sort((a, b) => String(b.data_publicacao_pncp || b.data_abertura_proposta || '')
        .localeCompare(String(a.data_publicacao_pncp || a.data_abertura_proposta || '')));

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
      const totalSomado = usouCache ? totalCache : Math.max(totalLive, totalCache);
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

      // Honestidade na paginação: quando um filtro fino SÓ local (órgão,
      // unidade, status…) cortou itens desta página, o número de páginas —
      // que vem do servidor, sem esse filtro — pode incluir páginas vazias.
      // O aviso declara isso em vez de deixar o usuário achar que é defeito.
      const aviso = reduziu
        ? `Filtros finos são aplicados página a página — das ${paginas} páginas, algumas podem vir vazias.`
        : undefined;

      setResultado({
        data: editais,
        total,
        paginas,
        pagina: pag,
        aviso,
      });
      setPagina(pag);

      const dt = Math.round(performance.now() - t0);
      logCtx({ etapa: 'fim', registros: editais.length, total, ms: dt });

      // Telemetria de consistência: registra a busca no banco para investigação posterior.
      try {
        const fonteUsada: 'live' | 'cache' | 'misto' | 'nenhuma' =
          totalRecebido === 0 ? 'nenhuma' : usouCache ? 'cache' : totalCache > 0 ? 'misto' : 'live';
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

  /**
   * Sub-tipos com "Todos": o pseudo-item todos_X vale pelo grupo inteiro no
   * motor de busca, então as caixinhas dos filhos preenchem junto. Desmarcar
   * um filho com "Todos" ativo degrada para "os outros filhos" — checkbox
   * marcada que não desmarca é botão mentiroso.
   */
  const toggleTipo = (
    campo: 'tiposConc' | 'tiposPregao' | 'tiposLeilao',
    todosId: string,
    id: string,
  ) => {
    setFiltros(prev => {
      const arr = prev[campo] as string[];
      if (id === todosId) {
        return { ...prev, [campo]: arr.includes(todosId) ? [] : [todosId] };
      }
      if (arr.includes(todosId)) {
        const grupo = (campo === 'tiposConc' ? TIPOS_CONCORRENCIA : campo === 'tiposPregao' ? TIPOS_PREGAO : TIPOS_LEILAO)
          .map(t => t.id)
          .filter(t => t !== todosId && t !== id);
        return { ...prev, [campo]: grupo };
      }
      const next = arr.includes(id) ? arr.filter(v => v !== id) : [...arr, id];
      return { ...prev, [campo]: next };
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

  /* As etiquetas do painel recolhido. Só entra o que a pessoa realmente
     escolheu — filtro vazio não vira etiqueta "todos", que seria ruído. */
  const resumoFiltros = useMemo(() => {
    const t: string[] = [];
    if (filtros.numero) t.push(`Nº ${filtros.numero}${filtros.ano ? `/${filtros.ano}` : ''}`);
    if (filtros.dataIni || filtros.dataFim) {
      t.push(`Publicação ${filtros.dataIni || '…'} – ${filtros.dataFim || '…'}`);
    }
    if (filtros.objeto) t.push(`Objeto: ${filtros.objeto}`);
    if (filtros.modalidades.length) t.push(`${filtros.modalidades.length} modalidade(s)`);
    if (filtros.ufs.length) t.push(filtros.ufs.length <= 4 ? filtros.ufs.join(' · ') : `${filtros.ufs.length} UFs`);
    if (filtros.municipios.length) t.push(`${filtros.municipios.length} município(s)`);
    if (filtros.cnpjs.length) t.push(`${filtros.cnpjs.length} CNPJ(s)`);
    if (filtros.uasgs.length) t.push(`${filtros.uasgs.length} UASG(s)`);
    if (filtros.esferas.length) t.push(filtros.esferas.join(' · '));
    if (filtros.poderes.length) t.push(filtros.poderes.join(' · '));
    if (filtros.tiposInstrumento.length) t.push(`${filtros.tiposInstrumento.length} instrumento(s)`);
    if (filtros.statusFiltro.length) t.push(filtros.statusFiltro.join(' · '));
    if (filtros.orgaoTexto) t.push(`Órgão: ${filtros.orgaoTexto}`);
    if (filtros.unidadeTexto) t.push(`Unidade: ${filtros.unidadeTexto}`);
    if (filtros.conteudoNacional) t.push(`Conteúdo nacional: ${filtros.conteudoNacional}`);
    if (filtros.emendaParlamentar) t.push(`Emenda parlamentar: ${filtros.emendaParlamentar}`);
    return t;
  }, [filtros]);

  /* Busca voltou → recolhe. Erro → reabre: quem errou o filtro precisa dele na
     frente para corrigir, não escondido atrás de um botão. */
  useEffect(() => {
    if (resultado) setPainelAberto(false);
  }, [resultado]);

  useEffect(() => {
    if (erro) setPainelAberto(true);
  }, [erro]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <CabecalhoPagina
          acoes={
            <>
              <Button
                variant="outline"
                onClick={() => buscar(pagina)}
                disabled={carregando || !buscaRealizada}
              >
                <RefreshCw className={carregando ? 'animate-spin' : undefined} aria-hidden="true" />
                Atualizar
              </Button>
              <Button onClick={() => buscar(1)} disabled={carregando}>
                <Search aria-hidden="true" />
                Buscar editais
              </Button>
            </>
          }
        >
          {resultado && (
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">
                {resultado.total.toLocaleString('pt-BR')}
              </span>{' '}
              editais encontrados na base do PNCP
            </p>
          )}
        </CabecalhoPagina>

        {/* Painel de filtros estilo SIASG */}
        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setPainelAberto(v => !v)}
            aria-expanded={painelAberto}
            className="w-full text-left px-6 py-3 border-b border-border bg-muted hover:bg-muted/70 transition-colors flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="font-semibold text-foreground text-sm">Pesquisa de licitações</span>
            {filtrosAtivosCount > 0 && (
              <Badge variant="info" className="shrink-0">
                {filtrosAtivosCount} filtro{filtrosAtivosCount > 1 ? 's' : ''}
              </Badge>
            )}
            <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              {painelAberto ? 'Recolher' : 'Alterar filtros'}
              {painelAberto
                ? <ChevronUp className="w-4 h-4" />
                : <ChevronDown className="w-4 h-4" />}
            </span>
          </button>

          {/* Recolhido: as escolhas viram etiquetas. Sem isso, fechar o painel
              esconderia o que está filtrando, e o número de resultados passaria
              a ser um dado sem contexto. */}
          {!painelAberto && (
            <div className="px-6 py-3 flex flex-wrap items-center gap-2">
              {resumoFiltros.length === 0 ? (
                <span className="text-xs text-muted-foreground">Nenhum filtro aplicado</span>
              ) : (
                resumoFiltros.map((t) => (
                  <Badge key={t} variant="info" truncate className="max-w-[280px]">
                    {t}
                  </Badge>
                ))
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={limparFiltros}
                className="ml-auto shrink-0"
              >
                <Eraser aria-hidden="true" />
                Limpar
              </Button>
            </div>
          )}

          <div className={painelAberto ? 'p-6 space-y-6' : 'hidden'}>
            <p className="text-xs text-muted-foreground -mb-1">
              Caso não seja informado o número da licitação, será obrigatório informar o
              Período de Publicação e Modalidade.
            </p>

            {/* Linha 1: Número / Período */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
              <Label className="md:col-span-2 pt-2 text-sm text-foreground">Número da Licitação</Label>
              <div className="md:col-span-4 flex items-center gap-2">
                <Input
                  placeholder="Ex: 102005"
                  value={filtros.numero}
                  onChange={e => setFiltros(p => ({ ...p, numero: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  className="max-w-[160px]"
                />
                <span className="text-xs text-muted-foreground">/</span>
                <Input
                  placeholder="aaaa"
                  value={filtros.ano}
                  onChange={e => setFiltros(p => ({ ...p, ano: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                  className="max-w-[90px]"
                />
                <span className="text-xs text-muted-foreground">(número e ano)</span>
              </div>

              <Label className="md:col-span-2 pt-2 text-sm text-foreground">Período de Publicação</Label>
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
              <Label className="md:col-span-2 text-sm text-foreground">Objeto</Label>
              <div className="md:col-span-10 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Ex: material de escritório, equipamentos médicos…"
                  value={filtros.objeto}
                  onChange={e => setFiltros(p => ({ ...p, objeto: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') buscar(1); }}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Linha 3: Modalidades — Lei 14.133/2021 (Art. 28) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <Label className="md:col-span-2 pt-2 text-sm text-foreground">
                Modalidades
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  Lei 14.133/2021
                </span>
              </Label>
              <div className="md:col-span-10 space-y-4">
                {/* Bloco 1: Modalidades de Licitação (Art. 28) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3">
                  {/* Coluna 1: Modalidades base */}
                  <div className="space-y-1.5">
                    <p className="mb-1 text-sm font-semibold text-foreground">Modalidades de Licitação</p>
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
                    <p className="mb-1 text-sm font-semibold text-foreground">Tipos de Concorrência</p>
                    {TIPOS_CONCORRENCIA.map(t => (
                      <CheckboxRow
                        key={t.id}
                        checked={
                          filtros.tiposConc.includes(t.id) ||
                          filtros.tiposConc.includes('todos_conc') ||
                          filtros.modalidades.includes('todas')
                        }
                        onChange={() => toggleTipo('tiposConc', 'todos_conc', t.id)}
                        label={t.label}
                        disabled={!filtros.modalidades.includes('concorrencia') && !filtros.modalidades.includes('todas')}
                      />
                    ))}
                  </div>

                  {/* Coluna 3: Tipos de Pregão */}
                  <div className="space-y-1.5">
                    <p className="mb-1 text-sm font-semibold text-foreground">Tipos de Pregão</p>
                    {TIPOS_PREGAO.map(t => (
                      <CheckboxRow
                        key={t.id}
                        checked={
                          filtros.tiposPregao.includes(t.id) ||
                          filtros.tiposPregao.includes('todos_pregao') ||
                          filtros.modalidades.includes('todas')
                        }
                        onChange={() => toggleTipo('tiposPregao', 'todos_pregao', t.id)}
                        label={t.label}
                        disabled={!filtros.modalidades.includes('pregao') && !filtros.modalidades.includes('todas')}
                      />
                    ))}
                  </div>

                  {/* Coluna 4: Tipos de Leilão */}
                  <div className="space-y-1.5">
                    <p className="mb-1 text-sm font-semibold text-foreground">Tipos de Leilão</p>
                    {TIPOS_LEILAO.map(t => (
                      <CheckboxRow
                        key={t.id}
                        checked={
                          filtros.tiposLeilao.includes(t.id) ||
                          filtros.tiposLeilao.includes('todos_leilao') ||
                          filtros.modalidades.includes('todas')
                        }
                        onChange={() => toggleTipo('tiposLeilao', 'todos_leilao', t.id)}
                        label={t.label}
                        disabled={!filtros.modalidades.includes('leilao') && !filtros.modalidades.includes('todas')}
                      />
                    ))}
                  </div>
                </div>

                {/* Bloco 2: Contratações Diretas (Arts. 74–79) */}
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="mb-2 text-sm font-semibold text-foreground">
                    Contratações Diretas
                    <span className="text-xs text-muted-foreground font-normal ml-1.5">
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
              <Label className="md:col-span-2 text-sm text-foreground">Órgão</Label>
              <div className="md:col-span-10 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Busca parcial por nome do órgão…"
                  value={filtros.orgaoTexto}
                  onChange={e => setFiltros(p => ({ ...p, orgaoTexto: e.target.value }))}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Linha 12: Unidade */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              <Label className="md:col-span-2 text-sm text-foreground">Unidade</Label>
              <div className="md:col-span-10 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Busca parcial por nome da unidade…"
                  value={filtros.unidadeTexto}
                  onChange={e => setFiltros(p => ({ ...p, unidadeTexto: e.target.value }))}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Linha 13: Conteúdo Nacional / Emenda Parlamentar */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
              <Label className="md:col-span-2 pt-1 text-sm text-foreground">Outros filtros</Label>
              <div className="md:col-span-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Conteúdo Nacional */}
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-foreground">Exigência de Conteúdo Nacional</p>
                  <div className="flex items-center gap-4">
                    {(['', 'sim', 'nao'] as const).map(v => (
                      <label key={v} className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
                        <input
                          type="radio"
                          name="conteudoNacional"
                          value={v}
                          checked={filtros.conteudoNacional === v}
                          onChange={() => setFiltros(p => ({ ...p, conteudoNacional: v }))}
                          className="h-4 w-4 accent-primary"
                        />
                        {v === '' ? 'Todos' : v === 'sim' ? 'Sim' : 'Não'}
                      </label>
                    ))}
                  </div>
                </div>
                {/* Emenda Parlamentar */}
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-foreground">Emenda Parlamentar</p>
                  <div className="flex items-center gap-4">
                    {(['', 'sim', 'nao'] as const).map(v => (
                      <label key={v} className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
                        <input
                          type="radio"
                          name="emendaParlamentar"
                          value={v}
                          checked={filtros.emendaParlamentar === v}
                          onChange={() => setFiltros(p => ({ ...p, emendaParlamentar: v }))}
                          className="h-4 w-4 accent-primary"
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
                    <p className="font-semibold text-foreground">Fonte Orçamentária</p>
                    <p>Indica de onde vêm os recursos da licitação — ex: <span className="font-medium">Tesouro Nacional</span>, <span className="font-medium">Recursos Próprios</span>, <span className="font-medium">Convênio</span>.</p>
                    <div className="space-y-1 border-t border-border pt-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-warning-ink">Por que está vazio?</p>
                      <p>A API pública do PNCP <span className="font-semibold">não retorna esse campo na listagem</span> de editais — ele só existe no endpoint de detalhe individual de cada edital.</p>
                    </div>
                    <div className="space-y-1 border-t border-border pt-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-success-ink">Como preencher?</p>
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
                    <p className="font-semibold text-foreground">Margem de Preferência</p>
                    <p>Indica se a licitação aplica vantagem de preço para produtos ou serviços nacionais — ex: <span className="font-medium">Normal</span>, <span className="font-medium">Ampliada</span>.</p>
                    <div className="space-y-1 border-t border-border pt-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-warning-ink">Por que está vazio?</p>
                      <p>A API pública do PNCP <span className="font-semibold">não retorna esse campo na listagem</span> de editais. Dependendo da versão da API, ele pode aparecer só no detalhe individual.</p>
                    </div>
                    <div className="space-y-1 border-t border-border pt-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-success-ink">Como preencher?</p>
                      <p>O sistema tenta extrair esse dado automaticamente a cada coleta periódica do PNCP. As opções aparecerão aqui assim que estiverem disponíveis na próxima atualização.</p>
                    </div>
                  </div>
                }
              />
            </div>

            {/* Aviso Materiais/Serviços */}
            <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
              <p className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
                <strong className="text-foreground">Materiais (CATMAT) e Serviços (CATSER):</strong>
                serão integrados via{' '}
                <a href="/preferencias-alertas" className="font-medium text-primary hover:underline">
                  Preferências de Alertas
                </a>
                {' '}— em desenvolvimento.
              </p>
            </div>

            {/* Botões de busca / limpeza (estilo SIASG) */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
              <Button onClick={() => buscar(1)} disabled={carregando} className="px-8">
                {carregando
                  ? <><Loader2 className="animate-spin" aria-hidden="true" />Pesquisando…</>
                  : <><Search aria-hidden="true" />Buscar editais</>}
              </Button>
              <Button variant="outline" onClick={limparFiltros}>
                <Eraser aria-hidden="true" />
                Limpar
              </Button>
            </div>
          </div>
        </div>

        {/* Erro */}
        {erro && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Erro na consulta</AlertTitle>
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        {/* Aviso */}
        {resultado?.aviso && (
          <Alert variant="warning">
            <Info className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{resultado.aviso}</AlertDescription>
          </Alert>
        )}

        {/* Espera — esqueleto com a forma do que vem, não um spinner girando no
            vazio. Quem espera já vê quantos cartões chegam e onde cada dado vai
            cair, então a tela não "pula" quando o resultado monta. */}
        {carregando && (
          <div className="space-y-3" role="status" aria-label="Consultando base de editais">
            <div className="flex items-center justify-between px-1">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-sm">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-32 shrink-0" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-28 shrink-0" />
                  <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
                  <Skeleton className="h-4 w-24 shrink-0" />
                </div>
              ))}
            </div>
            <span className="sr-only">Consultando base de editais…</span>
          </div>
        )}

        {/* Estado inicial */}
        {!buscaRealizada && !carregando && (
          <EstadoVazio
            icone={<Search />}
            titulo="Preencha os critérios e clique em Buscar editais"
            descricao="Sem o número da licitação, é obrigatório selecionar o Período de Publicação e a Modalidade."
          />
        )}

        {/* Resultados — tabela densa com ações por linha */}
        {buscaRealizada && resultado && !carregando && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm px-1">
              <span className="text-muted-foreground">
                Exibindo <span className="font-semibold text-foreground tabular-nums">{resultado.data.length}</span> de{' '}
                <span className="font-semibold text-foreground tabular-nums">{resultado.total.toLocaleString('pt-BR')}</span> editais
              </span>
              <span className="text-muted-foreground">
                Página {pagina} de {resultado.paginas}
              </span>
            </div>

            {resultado.data.length === 0 ? (
              <EstadoVazio
                icone={<FileText />}
                titulo="Nenhum edital encontrado"
                descricao="Nenhum edital corresponde aos filtros selecionados. Amplie o período ou remova filtros."
                acao={<Button variant="outline" onClick={limparFiltros}><Eraser aria-hidden="true" />Limpar filtros</Button>}
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
                <Table className="[&_td]:px-3 [&_th]:px-3">
                  <TableHeader>
                    <TableRow>
                      {/* Chip "Pregão Eletrônico nº 37/2026" (~250 px) + selo SRP/Em gestão
                          ao lado, sem quebrar para baixo: menos que isto, a linha da
                          tabela ganha uma altura a mais só por causa do selo. */}
                      {/* As larguras mínimas somam 1.339 px com o respiro de 12 px
                          por lado — abaixo dos 1.376 px do contêiner (1.440 − 2×32).
                          A soma anterior passava disso e a coluna Ações saía cortada
                          ("Aç…") atrás da rolagem interna da tabela (print de 17/09). */}
                      <TableHead className="min-w-[336px]">Identificação</TableHead>
                      <TableHead className="min-w-[216px]">Órgão</TableHead>
                      <TableHead className="min-w-[228px]">Prazo</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead className="text-right">Valor estimado</TableHead>
                      <TableHead className="w-[200px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultado.data.map((edital) => {
                      const key = `${edital.numeroCompra}||${edital.orgao}`;
                      return (
                        <EditalLinha
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
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {resultado.paginas > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagina <= 1 || carregando}
                  onClick={() => buscar(pagina - 1)}
                >
                  <ChevronLeft aria-hidden="true" />Anterior
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(resultado.paginas, 7) }, (_, i) => {
                    const p = pagina <= 4 ? i + 1
                      : pagina >= resultado.paginas - 3 ? resultado.paginas - 6 + i
                      : pagina - 3 + i;
                    if (p < 1 || p > resultado.paginas) return null;
                    return (
                      <Button
                        key={p}
                        variant={p === pagina ? 'default' : 'ghost'}
                        size="sm"
                        aria-current={p === pagina ? 'page' : undefined}
                        onClick={() => buscar(p)}
                        className="w-9 px-0 tabular-nums"
                      >
                        {p}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagina >= resultado.paginas || carregando}
                  onClick={() => buscar(pagina + 1)}
                >
                  Próxima<ChevronRight aria-hidden="true" />
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
    <label className={`flex items-center gap-2 text-sm text-foreground transition-colors ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}>
      <Checkbox checked={checked} onCheckedChange={() => !disabled && onChange()} disabled={disabled} className="h-4 w-4" />
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
      <Label className="md:col-span-2 pt-2 text-sm text-foreground">
        {label}
        {labelSub && (
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{labelSub}</span>
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
                        className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full bg-warning-tint text-xs font-bold text-warning-ink"
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
              <span key={v} className="inline-flex items-center gap-1 rounded-md bg-primary-tint px-2 py-0.5 text-xs font-medium text-primary">
                {v}
                <button onClick={(e) => { e.stopPropagation(); onToggle(v); }} className="rounded-sm hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
          <div className="ml-auto flex items-center gap-1">
            {valores.length > 0 && (
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onClear(); }} className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive">
                Excluir
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }} className="h-8 px-2 text-xs">
              {open ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
              Selecionar
            </Button>
          </div>
        </div>
        {open && options.length === 0 && info && (
          <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs text-warning leading-relaxed [&_p]:mb-1 [&_.border-t]:border-warning/30 [&_p.font-medium]:text-warning">
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
                    ? 'border-primary bg-primary text-primary-foreground'
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
      <Label className="md:col-span-2 pt-2 text-sm text-foreground">{label}</Label>
      <div className="md:col-span-10 space-y-2">
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
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
            className="max-w-md"
          />
          <Button variant="outline" onClick={() => onAdd(tempValue)}>
            Selecionar
          </Button>
        </div>
        {valores.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {valores.map((v, i) => (
              <span key={`${v}-${i}`} className="inline-flex items-center gap-1 rounded-md bg-primary-tint px-2 py-0.5 text-xs font-medium text-primary">
                {v}
                <button onClick={() => onRemove(i)} className="rounded-sm hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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

// ─── Linha do Edital (padrão "tabela" do registro de páginas) ────────────────
// A consulta ao PNCP, o favorito e o modal de início de processo são os mesmos
// do cartão anterior — só a apresentação virou linha de tabela com detalhe
// expansível, como a galeria desenha para /monitoramento-editais.

interface EditalLinhaProps {
  edital: Edital;
  favoritado: boolean;
  onFavoritar: () => void;
  licitacaoId: string | null;
  compromissoId: string | null;
  onIniciarProcesso: () => void;
}

const PNCP_API = 'https://pncp.gov.br/api/consulta/v1';

type AbaDetalhe = 'itens' | 'arquivos' | 'atas' | 'contratos' | 'historico';

function EditalLinha({ edital, favoritado, onFavoritar, licitacaoId, compromissoId, onIniciarProcesso }: EditalLinhaProps) {
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

  const identidade = useMemo(() => identidadeDoEdital({
    numeroCompra: edital.numeroCompra,
    modalidade: edital.modalidade,
    anoCompra: edital.anoCompra,
  }), [edital.numeroCompra, edital.modalidade, edital.anoCompra]);

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
    <>
      <TableRow className={expandido ? 'bg-muted/50' : undefined}>
        {/* Identificação: número padronizado, marcas do processo e objeto */}
        <TableCell className="align-top">
          <div className="flex flex-wrap items-center gap-2">
            {/* Identidade padronizada: cada portal publica o número do
                seu jeito ("011/2026", "PE nº 9/2026-0025 PMPD", "007
                SRP"); aqui todos leem igual — modalidade + nº N/AAAA,
                derivados dos dados oficiais. O tooltip preserva a forma
                bruta (é ela que consta no diário e na sala de disputa). */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-0.5 text-sm font-semibold text-foreground">
                    {identidade.rotulo}
                    {(identidade.reescrito || edital.numeroControlePncp) && (
                      <Info className="w-3 h-3 text-muted-foreground" />
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm p-3 text-xs leading-relaxed">
                  <p>
                    <strong>Como o portal publica:</strong>{' '}
                    <span className="font-mono">{identidade.bruto || 'sem número'}</span>
                  </p>
                  {edital.numeroControlePncp && (
                    <p className="mt-1">
                      <strong>Controle PNCP:</strong>{' '}
                      <span className="font-mono">{edital.numeroControlePncp}</span>
                    </p>
                  )}
                  <p className="mt-1 text-muted-foreground">
                    Identificação padronizada a partir dos dados oficiais — use a forma do
                    portal ao peticionar ou falar com o pregoeiro.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {edital.srp && <Badge variant="muted">SRP</Badge>}
            {emGestao && (
              <Badge variant="success" className="gap-1">
                <CheckCircle className="w-3 h-3" aria-hidden="true" />
                Em gestão
              </Badge>
            )}
            {emCompromisso && (
              <a href="/meus-compromissos" title="Abrir em Meus Compromissos" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Badge variant="info" className="gap-1">
                  <ListChecks className="w-3 h-3" aria-hidden="true" />
                  Em compromissos
                </Badge>
              </a>
            )}
          </div>
          <p className="mt-1.5 line-clamp-2 max-w-lg text-sm text-foreground">{edital.objeto}</p>
        </TableCell>

        {/* Órgão e localidade */}
        <TableCell className="align-top">
          <p className="flex items-start gap-1.5 text-sm text-foreground">
            <Building2 className="mt-0.5 w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="line-clamp-2">{edital.orgao}</span>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {(edital.municipio || edital.uf) && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" aria-hidden="true" />
                {[edital.municipio, edital.uf].filter(Boolean).join(' — ')}
              </span>
            )}
            {edital.esfera && <span>{ESFERA_LABELS[edital.esfera] || edital.esfera}</span>}
          </p>
        </TableCell>

        {/* Prazo: abertura, encerramento e a contagem regressiva.
            Cada data numa linha só: com a coluna estreita, "dd/mm/aaaa às
            hh:mm" quebrava ao meio e a célula virava cinco linhas — era ela,
            junto com as ações, que esticava a linha da tabela (17/09). */}
        <TableCell className="align-top text-sm">
          {edital.dataAbertura && (
            <p className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
              <CalendarIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
              Abertura: <span className="text-foreground tabular-nums">{formatData(edital.dataAbertura)}</span>
            </p>
          )}
          {edital.dataEncerramento && (
            <p className="mt-1 flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
              <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
              Encerramento: <span className="text-foreground tabular-nums">{formatData(edital.dataEncerramento)}</span>
            </p>
          )}
          {!edital.dataAbertura && !edital.dataEncerramento && (
            <span className="text-xs text-muted-foreground">—</span>
          )}
          {diasRestantes !== null && diasRestantes >= 0 && (
            <Badge
              variant={diasRestantes <= 1 ? 'danger' : diasRestantes <= 3 ? 'warning' : 'success'}
              className="mt-1.5"
            >
              {diasRestantes === 0 ? 'Encerra hoje' : `${diasRestantes} dia${diasRestantes === 1 ? '' : 's'} restantes`}
            </Badge>
          )}
        </TableCell>

        {/* Situação */}
        <TableCell className="align-top">
          <Badge variant={statusCfg.variante} className="gap-1">
            <StatusIcon className="w-3 h-3" aria-hidden="true" />
            {statusCfg.label}
          </Badge>
        </TableCell>

        {/* Valor estimado */}
        <TableCell className="align-top text-right text-sm font-semibold tabular-nums" nowrap>
          {edital.valorEstimado
            ? formatMoeda(edital.valorEstimado)
            : <span className="font-normal text-muted-foreground">Não informado</span>}
        </TableCell>

        {/* Ações da linha — duas alturas, não cinco.

            Eram cinco botões de texto num `flex-wrap`, numa coluna sem largura:
            quebravam em quatro linhas e esticavam a linha inteira da tabela
            até o dobro do conteúdo (print de 17/09). A ação principal fica em
            cima, com o nome inteiro; as secundárias viram uma fileira de
            ícones com nome acessível e dica — o texto continua chegando ao
            leitor de tela e ao mouse parado. */}
        <TableCell className="w-[200px] align-top">
          <div className="flex flex-col gap-1.5">
            <Button
              variant={emGestao ? 'outline' : 'default'}
              size="sm"
              className="w-full"
              onClick={onIniciarProcesso}
            >
              {emGestao ? <ArrowRight aria-hidden="true" /> : <Rocket aria-hidden="true" />}
              {emGestao ? 'Abrir processo' : 'Iniciar processo'}
            </Button>
            <div className="flex items-center justify-between gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="px-2"
                onClick={() => setExpandido(!expandido)}
                aria-expanded={expandido}
              >
                {expandido ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                {expandido ? 'Menos' : 'Detalhes'}
              </Button>
              <TooltipProvider>
                <div className="flex items-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn('h-8 w-8', favoritado && 'text-primary')}
                        onClick={onFavoritar}
                        aria-pressed={favoritado}
                        aria-label={favoritado ? 'Remover dos salvos' : 'Salvar edital'}
                      >
                        {favoritado ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{favoritado ? 'Salvo — clique para remover' : 'Salvar'}</TooltipContent>
                  </Tooltip>
                  {edital.link && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <a href={edital.link} target="_blank" rel="noopener noreferrer" aria-label="Abrir no sistema de origem">
                            <ExternalLink aria-hidden="true" />
                          </a>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Sistema de origem</TooltipContent>
                    </Tooltip>
                  )}
                  {edital.linkPncp && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <a href={edital.linkPncp} target="_blank" rel="noopener noreferrer" aria-label="Abrir no PNCP">
                            <Globe aria-hidden="true" />
                          </a>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>PNCP</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </TooltipProvider>
            </div>
          </div>
        </TableCell>
      </TableRow>

      {expandido && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={6} className="bg-muted/30 p-0">
          {carregandoDetalhe ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-sm">
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
                  <p className="text-sm text-foreground leading-relaxed">
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
                      className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        abaAtiva === key
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {label}
                      {count > 0 && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-muted text-xs font-normal">
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
                      <p className="text-sm text-muted-foreground">Nenhum item retornado pela API.</p>
                      {edital.linkPncp && (
                        <a href={edital.linkPncp} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <ExternalLink className="w-3 h-3" />Ver itens no portal PNCP
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-border bg-card">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted text-foreground">
                            <th className="w-10 px-3 py-2 text-left text-sm font-semibold">Nº</th>
                            <th className="px-3 py-2 text-left text-sm font-semibold">Descrição</th>
                            <th className="w-24 px-3 py-2 text-right text-sm font-semibold">Quantidade</th>
                            <th className="w-32 px-3 py-2 text-right text-sm font-semibold">Vlr. unit. est.</th>
                            <th className="w-32 px-3 py-2 text-right text-sm font-semibold">Vlr. total est.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {itens.map((item: any, i: number) => {
                            const qtd = item.quantidade ?? item.quantidadeItens;
                            const vUnit = item.valorUnitarioEstimado ?? item.valorUnitario;
                            const vTotal = item.valorTotal ?? item.valorTotalEstimado
                              ?? (vUnit != null && qtd != null ? vUnit * qtd : null);
                            return (
                              <tr key={item.numeroItem ?? i} className="hover:bg-muted/20 transition-colors">
                                <td className="px-3 py-2 text-muted-foreground">{item.numeroItem ?? i + 1}</td>
                                <td className="px-3 py-2 text-foreground">
                                  {item.descricao || item.descricaoItem || '—'}
                                  {item.unidadeMedida && (
                                    <span className="ml-1.5 rounded border border-border px-1 text-xs text-muted-foreground">
                                      {item.unidadeMedida}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">{qtd?.toLocaleString('pt-BR') ?? '—'}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                                  {vUnit != null ? formatMoeda(vUnit) : '—'}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">
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
                      <p className="text-sm text-muted-foreground">Nenhum arquivo retornado pela API.</p>
                      {edital.linkPncp && (
                        <a href={edital.linkPncp} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <ExternalLink className="w-3 h-3" />Ver arquivos no portal PNCP
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {arquivos.map((arq: any, i: number) => (
                        <div key={arq.sequencialDocumento ?? i}
                          className="flex items-center justify-between rounded-md border border-border bg-card p-2.5 transition-colors hover:bg-muted">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {arq.titulo || arq.nomeArquivo || `Arquivo ${i + 1}`}
                              </p>
                              {arq.dataPublicacao && (
                                <p className="text-xs text-muted-foreground">{formatData(arq.dataPublicacao)}</p>
                              )}
                            </div>
                          </div>
                          {arq.url && (
                            <Button variant="outline" size="sm" asChild className="ml-3 shrink-0">
                              <a href={arq.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink aria-hidden="true" />
                                Abrir
                              </a>
                            </Button>
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
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        <ExternalLink className="w-3.5 h-3.5" />
                        Abrir no portal PNCP
                      </a>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ─── Detalhe auxiliar ────────────────────────────────────────────────────────

function DetalheItem({
  label, valor, mono = false, destaque = false,
}: { label: string; valor: string; mono?: boolean; destaque?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-sm text-foreground ${mono ? 'font-mono' : ''} ${destaque ? 'font-semibold tabular-nums' : ''}`}>
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
        className="max-w-[140px]"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
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
