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
  uasgs: string[];
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
  uasgs: [],
};

// ─── Componente principal ────────────────────────────────────────────────────

export default function MonitoramentoEditais() {
  const [filtros, setFiltros] = useState<FiltrosLei14133>(filtrosVazios);
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

    try {
      // Monta termo de busca: combina objeto + nº licitação + uasgs como tokens
      const termoPartes: string[] = [];
      if (filtros.objeto.trim()) termoPartes.push(filtros.objeto.trim());
      if (filtros.numero.trim()) termoPartes.push(filtros.numero.trim());
      
      const termo = termoPartes.join(' ').trim() || null;

      const dataIni = filtros.dataIni ? dmyToIso(filtros.dataIni) : null;
      const dataFim = filtros.dataFim ? dmyToIso(filtros.dataFim) : null;

      const tamanho = 20;

      // Quando há múltiplas UFs ou modalidades, paralelizamos a RPC e mesclamos
      const ufsList = filtros.ufs.length > 0 ? filtros.ufs : [null];
      const modList = modalidadesEfetivas.length > 0 ? modalidadesEfetivas : [null];

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
              p_data_inicio: dataIni,
              p_data_fim: dataFim,
              p_ordenacao: 'data_publicacao',
              p_direcao: 'desc',
              p_pagina: pag,
              p_tamanho: tamanho,
            }) as any)
          );
        }
      }

      const respostas = await Promise.all(calls);
      const erros = respostas.filter(r => r.error).map(r => r.error?.message);
      if (erros.length === respostas.length) {
        throw new Error(erros[0] || 'Falha ao consultar o cache PNCP');
      }

      // Mescla, deduplica por id e aplica filtros client-side (uasg, município nome, ano)
      const rowsRaw: any[] = respostas.flatMap(r => r.data || []);
      const seen = new Set<string>();
      let totalEstimado = 0;
      const rows = rowsRaw.filter(r => {
        if (!r?.id || seen.has(r.id)) return false;
        seen.add(r.id);
        totalEstimado = Math.max(totalEstimado, Number(r.total_count) || 0);
        return true;
      });

      // Filtros locais adicionais (campos sem cobertura na RPC)
      const ufsSet = new Set(filtros.ufs);
      const muniSet = new Set(filtros.municipios.map(m => m.toLowerCase()));
      const uasgSet = new Set(filtros.uasgs.map(u => String(u).trim()));

      const filtrados = rows.filter(r => {
        if (ufsSet.size > 0 && !ufsSet.has(r.uf)) return false;
        if (muniSet.size > 0 && !muniSet.has(String(r.municipio || '').toLowerCase())) return false;
        if (uasgSet.size > 0) {
          const uasgRow = String(r.unidade_orgao || r.cnpj_orgao || '').trim();
          // Tenta casar pelo trecho numérico do unidade_orgao ou número compra
          const matches = Array.from(uasgSet).some(u => uasgRow.includes(u) || String(r.numero_compra || '').includes(u));
          if (!matches) return false;
        }
        if (filtros.ano && filtros.numero) {
          const numAno = `${filtros.numero}/${filtros.ano}`;
          if (!String(r.numero_compra || '').includes(numAno) && !String(r.numero_compra || '').includes(filtros.numero)) {
            return false;
          }
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
      }));

      const total = filtrados.length === rows.length ? totalEstimado : filtrados.length;
      const paginas = Math.max(1, Math.ceil(total / tamanho));

      setResultado({
        data: editais,
        total,
        paginas,
        pagina: pag,
      });
      setPagina(pag);
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
    if (filtros.uasgs.length > 0) n++;
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
                <Input
                  placeholder="dd/mm/aaaa"
                  value={filtros.dataIni}
                  onChange={e => setFiltros(p => ({ ...p, dataIni: formatDateInput(e.target.value) }))}
                  className="h-9 max-w-[140px]"
                />
                <span className="text-xs text-muted-foreground">até</span>
                <Input
                  placeholder="dd/mm/aaaa"
                  value={filtros.dataFim}
                  onChange={e => setFiltros(p => ({ ...p, dataFim: formatDateInput(e.target.value) }))}
                  className="h-9 max-w-[140px]"
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
                        checked={filtros.modalidades.includes(m.id)}
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
                        checked={filtros.tiposConc.includes(t.id)}
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
                        checked={filtros.tiposPregao.includes(t.id)}
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
                        checked={filtros.tiposLeilao.includes(t.id)}
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
                        checked={filtros.modalidades.includes(m.id)}
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

            {/* Linha 5: Municípios (free input) */}
            <ChipFreeInput
              label="Municípios"
              valores={filtros.municipios}
              tempValue={tempMunicipio}
              onTempChange={setTempMunicipio}
              onAdd={(v) => {
                if (!v.trim()) return;
                if (!filtros.municipios.includes(v.trim())) {
                  setFiltros(p => ({ ...p, municipios: [...p.municipios, v.trim()] }));
                }
                setTempMunicipio('');
              }}
              onRemove={(idx) => setFiltros(p => ({ ...p, municipios: p.municipios.filter((_, i) => i !== idx) }))}
              placeholder="Digite o município e pressione Enter"
              hint="(Selecione UF antes para resultados precisos)"
            />

            {/* Linha 6: UASG (até 5) */}
            <ChipFreeInput
              label="Cód. UASG (Unid. de Compra)"
              valores={filtros.uasgs}
              tempValue={tempUasg}
              onTempChange={setTempUasg}
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
              placeholder="Ex: 153031"
              hint="(máximo 5 UASGs)"
              numericOnly
            />

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
                      url: edital.linkPncp,
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
  label, options, valores, onToggle, onClear, placeholder,
}: {
  label: string;
  options: string[];
  valores: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
      <Label className="md:col-span-2 text-xs text-muted-foreground pt-2">{label}</Label>
      <div className="md:col-span-10 space-y-2">
        <div className="rounded-md border border-border bg-background min-h-[40px] px-2 py-1.5 flex flex-wrap gap-1.5 items-center">
          {valores.length === 0 ? (
            <span className="text-xs text-muted-foreground px-1.5">{placeholder}</span>
          ) : (
            valores.map(v => (
              <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-accent/15 text-accent text-xs font-medium">
                {v}
                <button onClick={() => onToggle(v)} className="hover:text-accent-foreground">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
          <div className="ml-auto flex items-center gap-1">
            {valores.length > 0 && (
              <Button variant="ghost" size="sm" onClick={onClear} className="h-6 text-[11px] px-2 text-muted-foreground hover:text-destructive">
                Excluir
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setOpen(o => !o)} className="h-6 text-[11px] px-2">
              {open ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
              Selecionar
            </Button>
          </div>
        </div>
        {open && (
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

function EditalCard({ edital, favoritado, onFavoritar, licitacaoId, compromissoId, onIniciarProcesso }: EditalCardProps) {
  const emGestao = !!licitacaoId;
  const emCompromisso = !!compromissoId;
  const [expandido, setExpandido] = useState(false);
  const statusCfg = STATUS_CONFIG[edital.status] || STATUS_CONFIG.encerrado;
  const { Icon: StatusIcon } = statusCfg;

  const diasRestantes = edital.status === 'aberto'
    ? calcularDiasRestantes(edital.dataEncerramento)
    : null;

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
                  <Calendar className="w-3 h-3" />
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
        <div className="px-4 pb-4 pt-0 border-t border-border mt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            <DetalheItem label="Número do processo" valor={edital.processo || '—'} />
            <DetalheItem label="Situação PNCP" valor={edital.situacaoNome || '—'} />
            <DetalheItem label="Tipo de instrumento" valor={edital.tipoEdital || '—'} />
            <DetalheItem label="CNPJ do órgão" valor={edital.cnpj || '—'} mono />
            {edital.dataPublicacao && (
              <DetalheItem label="Data de publicação" valor={formatData(edital.dataPublicacao)} />
            )}
          </div>

          {edital.informacaoComplementar && (
            <div className="mt-4 rounded-lg bg-muted/50 border border-border p-3">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Informação complementar
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
                {edital.informacaoComplementar}
              </p>
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
