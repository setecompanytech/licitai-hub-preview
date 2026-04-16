import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import {
  Search, Filter, ChevronDown, ChevronUp, ExternalLink,
  MapPin, Building2, Calendar, Clock, CheckCircle2, XCircle,
  PauseCircle, ChevronLeft, ChevronRight,
  Bookmark, BookmarkCheck, Info, Loader2, RefreshCw, AlertCircle, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
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
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS',
  'MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC',
  'SE','SP','TO',
];

const MODALIDADES = [
  { id: 6, label: 'Pregão Eletrônico' },
  { id: 7, label: 'Pregão Presencial' },
  { id: 4, label: 'Concorrência Eletrônica' },
  { id: 5, label: 'Concorrência Presencial' },
  { id: 8, label: 'Dispensa de Licitação' },
  { id: 9, label: 'Inexigibilidade' },
  { id: 12, label: 'Credenciamento' },
  { id: 1, label: 'Leilão Eletrônico' },
  { id: 3, label: 'Concurso' },
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

// ─── Componente principal ────────────────────────────────────────────────────

export default function MonitoramentoEditais() {
  const [filtros, setFiltros] = useState({
    termo: '',
    uf: 'all',
    modalidade: 'all',
    situacao: 'abertas',
    esfera: 'all',
    dataInicial: '',
    dataFinal: '',
  });
  const [filtrosAbertos, setFiltrosAbertos] = useState(true);

  const [resultado, setResultado] = useState<ResultadoBusca | null>(null);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [favoritos, setFavoritos] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('praefectus_fav_editais') || '[]'));
    } catch { return new Set(); }
  });

  const abortRef = useRef<AbortController | null>(null);

  const buscar = useCallback(async (pag = 1) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setCarregando(true);
    setErro(null);

    try {
      // Convert 'all' sentinel values to empty strings for the API
      const apiBody = {
        termo: filtros.termo,
        uf: filtros.uf === 'all' ? '' : filtros.uf,
        modalidade: filtros.modalidade === 'all' ? '' : filtros.modalidade,
        situacao: filtros.situacao,
        esfera: filtros.esfera === 'all' ? '' : filtros.esfera,
        dataInicial: filtros.dataInicial,
        dataFinal: filtros.dataFinal,
        pagina: pag,
        tamanhoPagina: 20,
      };
      const { data, error } = await supabase.functions.invoke('busca-licitacoes', {
        body: apiBody,
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setResultado(data as ResultadoBusca);
      setPagina(pag);
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      const msg = e instanceof Error ? e.message : 'Erro ao consultar o PNCP';
      setErro(msg);
      toast.error('Erro na consulta', { description: msg });
    } finally {
      setCarregando(false);
    }
  }, [filtros]);

  useEffect(() => { buscar(1); }, []); // eslint-disable-line

  const toggleFavorito = (id: string) => {
    setFavoritos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem('praefectus_fav_editais', JSON.stringify([...next]));
      return next;
    });
  };

  const setFiltro = (campo: string, valor: string) => {
    setFiltros(prev => ({ ...prev, [campo]: valor }));
  };

  const limparFiltros = () => {
    setFiltros({ termo: '', uf: 'all', modalidade: 'all', situacao: 'abertas', esfera: 'all', dataInicial: '', dataFinal: '' });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') buscar(1);
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">
              Monitoramento de Editais
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Fonte oficial: Portal Nacional de Contratações Públicas — PNCP
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
              disabled={carregando}
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${carregando ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <button
            onClick={() => setFiltrosAbertos(!filtrosAbertos)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Filter className="w-4 h-4 text-accent" />
              Filtros de pesquisa
              {(filtros.termo || filtros.uf || filtros.modalidade || filtros.esfera) && (
                <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent text-xs font-medium">
                  {[filtros.termo, filtros.uf, filtros.modalidade, filtros.esfera].filter(Boolean).length} ativo(s)
                </span>
              )}
            </div>
            {filtrosAbertos
              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {filtrosAbertos && (
            <div className="px-5 pb-5 pt-1 border-t border-border space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs text-muted-foreground mb-1.5">Objeto / Termo de pesquisa</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Ex: material de escritório, equipamentos médicos..."
                      value={filtros.termo}
                      onChange={e => setFiltro('termo', e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Situação das propostas</label>
                  <Select value={filtros.situacao} onValueChange={v => setFiltro('situacao', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="abertas">Propostas abertas</SelectItem>
                      <SelectItem value="todas">Todas as publicações</SelectItem>
                      <SelectItem value="encerradas">Encerradas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">UF</label>
                  <Select value={filtros.uf} onValueChange={v => setFiltro('uf', v)}>
                    <SelectTrigger><SelectValue placeholder="Todos os estados" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="">Todos os estados</SelectItem>
                      {UFS.map(uf => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Modalidade</label>
                  <Select value={filtros.modalidade} onValueChange={v => setFiltro('modalidade', v)}>
                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas as modalidades</SelectItem>
                      {MODALIDADES.map(m => (
                        <SelectItem key={m.id} value={String(m.id)}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Esfera</label>
                  <Select value={filtros.esfera} onValueChange={v => setFiltro('esfera', v)}>
                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas as esferas</SelectItem>
                      <SelectItem value="F">Federal</SelectItem>
                      <SelectItem value="E">Estadual</SelectItem>
                      <SelectItem value="M">Municipal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {filtros.situacao !== 'abertas' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5">Data início de publicação</label>
                    <Input
                      type="date"
                      value={filtros.dataInicial}
                      onChange={e => setFiltro('dataInicial', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5">Data fim de publicação</label>
                    <Input
                      type="date"
                      value={filtros.dataFinal}
                      onChange={e => setFiltro('dataFinal', e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Button
                  onClick={() => buscar(1)}
                  disabled={carregando}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-6"
                >
                  {carregando
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Consultando PNCP...</>
                    : <><Search className="w-4 h-4 mr-2" />Pesquisar</>}
                </Button>
                <Button variant="ghost" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Erro */}
        {erro && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3.5 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Erro na consulta ao PNCP</p>
              <p className="text-destructive/70 mt-0.5">{erro}</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {carregando && !resultado && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
            <p className="text-muted-foreground text-sm">Consultando Portal Nacional de Contratações Públicas…</p>
          </div>
        )}

        {/* Resultados */}
        {resultado && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm px-1">
              <span className="text-muted-foreground">
                Exibindo <span className="text-foreground font-medium">{resultado.data.length}</span> de{' '}
                <span className="text-foreground font-medium">{resultado.total.toLocaleString('pt-BR')}</span> editais
                {filtros.situacao === 'abertas' && (
                  <span className="ml-2 text-success">• propostas abertas</span>
                )}
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
              resultado.data.map((edital) => (
                <EditalCard
                  key={edital.id}
                  edital={edital}
                  favoritado={favoritos.has(edital.id)}
                  onFavoritar={() => toggleFavorito(edital.id)}
                />
              ))
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
    </AppLayout>
  );
}

// ─── Card do Edital ──────────────────────────────────────────────────────────

interface EditalCardProps {
  edital: Edital;
  favoritado: boolean;
  onFavoritar: () => void;
}

function EditalCard({ edital, favoritado, onFavoritar }: EditalCardProps) {
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
            <a
              href={edital.linkPncp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ver no PNCP
            </a>
          </div>
        </div>
      </div>

      {expandido && (
        <div className="px-4 pb-4 pt-0 border-t border-border mt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            <DetalheItem label="Número do processo" valor={edital.processo || '—'} />
            <DetalheItem label="Situação PNCP" valor={edital.situacaoNome} />
            <DetalheItem label="Modo de disputa" valor={edital.modoDisputa || '—'} />
            <DetalheItem label="Tipo de instrumento" valor={edital.tipoEdital} />
            <DetalheItem label="CNPJ do órgão" valor={edital.cnpj || '—'} mono />
            {edital.valorHomologado && (
              <DetalheItem label="Valor homologado" valor={formatMoeda(edital.valorHomologado)} destaque />
            )}
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
