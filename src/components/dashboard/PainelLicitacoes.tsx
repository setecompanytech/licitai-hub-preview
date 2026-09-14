import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import EstadoVazio from '@/components/shared/EstadoVazio';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Search, Filter, RefreshCw, ExternalLink, Calendar, MapPin,
  ArrowUpDown, ChevronLeft, ChevronRight, Eye, Kanban, Crosshair,
  FileText, MessageSquare, Archive, RotateCcw, AlertTriangle, Calculator,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  STATUS_PROCESSO, FAIXAS, FAIXAS_PADRAO, type Faixa,
  faixaDe, aparenciaStatus, rotuloStatus, prazoPerdidoNoRadar,
} from '@/lib/licitacao/status';
import { PARAM_RECORTE, recorteDaUrl } from '@/lib/licitacao/recortes-do-painel';
import { useLicitacaoIntegration } from '@/hooks/useLicitacaoIntegration';
import RegistrarPerdaDialog, { type PerdaAlvo } from '@/components/metas/RegistrarPerdaDialog';

type Licitacao = {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  status: string;
  modalidade: string;
  valor_estimado: number | null;
  uf: string | null;
  municipio: string | null;
  data_abertura: string | null;
  data_encerramento: string | null;
  portal: string | null;
  url_edital: string | null;
  created_at: string;
  arquivado_em: string | null;
  updated_at: string | null;
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const PAGE_SIZE = 10;

export default function PainelLicitacoes() {
  const { user } = useAuth();
  const { empresaAtiva, todasSelecionadas } = useEmpresa();
  const navigate = useNavigate();
  /* O recorte vem na URL (`?recorte=ganhas`), posto pelo indicador clicável do
     Resumo operacional. É o MESMO predicado que conta o cartão
     (`lib/licitacao/recortes-do-painel`) — por isso o número do indicador e a
     quantidade de linhas daqui não podem divergir: é a mesma função.
     Na URL, e não em estado interno, porque assim o endereço é compartilhável
     e o botão Voltar desfaz o filtro. */
  const [searchParams, setSearchParams] = useSearchParams();
  const recorte = recorteDaUrl(searchParams.get(PARAM_RECORTE));
  const secaoRef = useRef<HTMLDivElement | null>(null);
  const { arquivarProcesso, registrarPerda } = useLicitacaoIntegration();
  const [perdaAlvo, setPerdaAlvo] = useState<PerdaAlvo | null>(null);
  const [salvandoPerda, setSalvandoPerda] = useState(false);
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  // Faixas do ciclo de vida. Arquivo fica fora por padrão: era justamente a
  // ausência dessa separação que fazia a lista só crescer.
  const [faixasAtivas, setFaixasAtivas] = useState<Faixa[]>(FAIXAS_PADRAO);
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [modalidadeFilter, setModalidadeFilter] = useState<string>('todos');
  const [ufFilter, setUfFilter] = useState<string>('todos');
  const [sortField, setSortField] = useState<'created_at' | 'data_encerramento' | 'valor_estimado'>('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!user) return;
    loadLicitacoes();

    // O realtime segue a empresa, não o usuário: o painel de um colaborador
    // precisa reagir ao que o colega mexeu.
    const channel = supabase
      .channel('painel-licitacoes-realtime')
      .on(
        'postgres_changes',
        empresaAtiva
          ? { event: '*', schema: 'public', table: 'licitacoes', filter: `empresa_id=eq.${empresaAtiva.id}` }
          : { event: '*', schema: 'public', table: 'licitacoes' },
        () => loadLicitacoes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, empresaAtiva?.id, todasSelecionadas]);

  async function loadLicitacoes() {
    setLoading(true);
    // Escopo por empresa: o processo é da empresa, não do colaborador que o
    // cadastrou. O RLS já garante que só chegam empresas das quais se é membro,
    // então "Todas as Empresas" é simplesmente a ausência de filtro.
    let query = supabase
      .from('licitacoes')
      .select('id, numero, orgao, objeto, status, modalidade, valor_estimado, uf, municipio, data_abertura, data_encerramento, portal, url_edital, created_at, arquivado_em, updated_at');

    if (!todasSelecionadas && empresaAtiva) {
      query = query.eq('empresa_id', empresaAtiva.id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar licitações');
    } else {
      setLicitacoes(data || []);
    }
    setLoading(false);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadLicitacoes();
    setRefreshing(false);
    toast.success('Dados atualizados');
  }

  async function handleStatusChange(id: string, newStatus: string) {
    // "Perdida" exige motivo: o trigger do banco recusa o update sem registro
    // em comercial_perdas (é o que alimenta as metas do comercial). Mesmo
    // fluxo do Kanban: abre o diálogo e só então muda o status.
    if (newStatus === 'Perdida') {
      const lic = licitacoes.find((l) => l.id === id);
      if (lic && lic.status !== 'Perdida') {
        setPerdaAlvo({
          licitacaoId: id,
          numero: lic.numero,
          orgao: lic.orgao,
          modalidade: lic.modalidade ?? null,
          valorEstimado: lic.valor_estimado,
        });
        return;
      }
    }
    const { error } = await supabase
      .from('licitacoes')
      .update({ status: newStatus })
      .eq('id', id);
    // Sem `.eq('user_id')`: o processo é da empresa e o RLS já barra o que não
    // pertence a ela. Manter o filtro faria a edição falhar silenciosamente no
    // processo de um colega.

    if (error) {
      // A mensagem do trigger já vem pronta em português — mostrar a real
      // em vez de um "erro" genérico que não diz o que fazer.
      toast.error(error.message || 'Erro ao atualizar status');
    } else {
      setLicitacoes((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l))
      );
      toast.success('Status atualizado');
    }
  }

  async function confirmarPerda({ motivoId, observacao }: { motivoId: string; observacao: string }) {
    if (!perdaAlvo || !empresaAtiva) return;
    setSalvandoPerda(true);
    const ok = await registrarPerda({
      licitacaoId: perdaAlvo.licitacaoId,
      empresaId: empresaAtiva.id,
      motivoId,
      observacao,
      modalidade: perdaAlvo.modalidade,
      valorEstimado: perdaAlvo.valorEstimado,
    });
    setSalvandoPerda(false);
    if (!ok) return;
    setLicitacoes((prev) => prev.map((l) => (l.id === perdaAlvo.licitacaoId ? { ...l, status: 'Perdida' } : l)));
    setPerdaAlvo(null);
  }

  /**
   * Arquivar/restaurar pelo mesmo hook que o Kanban e os Compromissos usam,
   * para os três não discordarem entre si. O painel era a única tela que
   * mostrava o problema e não oferecia a ação.
   */
  async function handleArquivar(lic: Licitacao) {
    const restaurar = !!lic.arquivado_em;
    const ok = await arquivarProcesso(lic.id, !restaurar);
    if (!ok) return;
    toast.success(restaurar ? 'Processo restaurado' : 'Processo arquivado');
    loadLicitacoes();
  }

  // Derived unique values for filters
  const uniqueStatus = useMemo(() => [...new Set(licitacoes.map((l) => l.status))], [licitacoes]);
  const uniqueModalidades = useMemo(() => [...new Set(licitacoes.map((l) => l.modalidade))], [licitacoes]);
  const uniqueUfs = useMemo(() => [...new Set(licitacoes.filter((l) => l.uf).map((l) => l.uf!))].sort(), [licitacoes]);

  // Filtered & sorted
  const filtered = useMemo(() => {
    let result = [...licitacoes];

    if (recorte) {
      // Com recorte vindo do indicador, as FAIXAS não se aplicam: elas escondem
      // o Arquivo por padrão, e um processo ganho e arquivado continua ganho —
      // filtrá-lo fora daria menos linhas do que o número do cartão prometeu.
      result = result.filter((l) => recorte.aceita(l.status));
    } else {
      result = result.filter((l) => faixasAtivas.includes(faixaDe(l.status, l.arquivado_em)));
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.objeto.toLowerCase().includes(q) ||
          l.orgao.toLowerCase().includes(q) ||
          l.numero.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'todos') result = result.filter((l) => l.status === statusFilter);
    if (modalidadeFilter !== 'todos') result = result.filter((l) => l.modalidade === modalidadeFilter);
    if (ufFilter !== 'todos') result = result.filter((l) => l.uf === ufFilter);

    /* Os três campos de ordenação são duas datas em texto ISO e um número.
       O `any` que estava aqui escondia isso: `string | number` é o tipo real, e
       escrevê-lo mantém a comparação verificável (ISO ordena como texto). Sem
       valor, o registro vai para o FIM da ordem nos dois sentidos. */
    const semValor = sortAsc ? Infinity : -Infinity;
    const chave = (l: Licitacao): string | number => {
      const bruto = l[sortField];
      if (bruto == null) return semValor;
      return typeof bruto === 'string' ? bruto.toLowerCase() : bruto;
    };
    result.sort((a, b) => {
      const va = chave(a);
      const vb = chave(b);
      if (va === vb) return 0;
      return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

    return result;
  }, [licitacoes, recorte, faixasAtivas, search, statusFilter, modalidadeFilter, ufFilter, sortField, sortAsc]);

  /** Quantos processos existem em cada faixa — independente dos demais filtros. */
  const contagemPorFaixa = useMemo(() => {
    const acc = { radar: 0, em_jogo: 0, decidido: 0, arquivo: 0 } as Record<Faixa, number>;
    licitacoes.forEach((l) => { acc[faixaDe(l.status, l.arquivado_em)] += 1; });
    return acc;
  }, [licitacoes]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
  }, [recorte, faixasAtivas, search, statusFilter, modalidadeFilter, ufFilter]);

  /* Chegar aqui vindo de um indicador do topo é uma navegação DENTRO da mesma
     página: o React Router troca a query string e nada se move na tela — a
     pessoa clica, o filtro muda quatro rolagens abaixo e parece que o clique
     não fez nada. Por isso a seção se traz para a vista quando o recorte muda.
     `scrollIntoView` não existe no jsdom (e não existe em navegador antigo):
     a checagem evita derrubar o render em teste. */
  useEffect(() => {
    if (!recorte) return;
    const alvo = secaoRef.current;
    if (alvo && typeof alvo.scrollIntoView === 'function') {
      alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [recorte]);

  /** Tira o recorte da URL sem apagar os outros parâmetros da página. */
  const limparRecorte = () => {
    setSearchParams((atual) => {
      const proximo = new URLSearchParams(atual);
      proximo.delete(PARAM_RECORTE);
      return proximo;
    }, { replace: true });
  };

  // Summary stats
  const stats = useMemo(() => {
    const total = filtered.length;
    // "Ativas" passa a significar o que ainda ocupa a mesa: Radar + Em jogo.
    // A conta antiga comparava strings de status e não reconhecia 'Arquivada'
    // nem as grafias minúsculas, contando processo encerrado como ativo.
    const ativas = filtered.filter((l) => {
      const f = faixaDe(l.status, l.arquivado_em);
      return f === 'radar' || f === 'em_jogo';
    }).length;
    const valorTotal = filtered.reduce((s, l) => s + (l.valor_estimado || 0), 0);
    const urgentes = filtered.filter((l) => {
      if (!l.data_encerramento || l.arquivado_em) return false;
      const diff = new Date(l.data_encerramento).getTime() - Date.now();
      return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
    }).length;
    const prazoPerdido = filtered.filter((l) =>
      prazoPerdidoNoRadar(l.status, l.data_encerramento, l.arquivado_em)
    ).length;
    return { total, ativas, valorTotal, urgentes, prazoPerdido };
  }, [filtered]);

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  }

  /** Volta os filtros ao estado inicial — a ação do estado vazio. */
  function limparFiltros() {
    setSearch('');
    setStatusFilter('todos');
    setModalidadeFilter('todos');
    setUfFilter('todos');
    setFaixasAtivas(FAIXAS_PADRAO);
    // O recorte mora na URL, então limpar só o estado local deixaria a lista
    // ainda filtrada e o botão "Limpar filtros" parecendo quebrado.
    if (recorte) limparRecorte();
  }

  if (loading) {
    return (
      <div className="space-y-4" role="status" aria-label="Carregando processos">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
        <span className="sr-only">Carregando processos...</span>
      </div>
    );
  }

  const opcoesOrdenacao = [
    { field: 'created_at' as const, label: 'Recente' },
    { field: 'data_encerramento' as const, label: 'Encerramento' },
    { field: 'valor_estimado' as const, label: 'Valor' },
  ];

  return (
    <div className="space-y-4" ref={secaoRef}>
      {/* Chegou de um indicador do topo: a listagem diz em que recorte está e
          oferece a saída. Sem este aviso, a pessoa lê a lista filtrada como se
          fosse a lista inteira — e conclui que os outros processos sumiram. */}
      {recorte && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/20 bg-primary-tint p-4">
          <p className="min-w-0 flex-1 text-sm leading-5 text-foreground">
            Mostrando <strong>{recorte.descricaoDoFiltro.toLowerCase()}</strong> — {filtered.length}{' '}
            {filtered.length === 1 ? 'processo' : 'processos'}, do indicador do resumo.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={limparRecorte}>
            Ver todos
          </Button>
        </div>
      )}

      {/* Resumo do que os filtros deixaram passar. Cinco colunas só a partir de
          lg: em 640px cada célula teria 128px e o valor estimado, que é moeda
          por extenso, seria truncado no meio dos dígitos.

          Por que 20/28 e não o KPI de 32/40 da régua: a régua de 32 é a do
          número do TOPO da tela, e o Painel já tem a dela (os StatCard do
          cabeçalho). Este aqui é o resumo do que o filtro desta seção deixou
          passar, quatro rolagens abaixo — repetir o mesmo peso faria duas
          paredes de número disputando a mesma página. Rótulo em 14 (label da
          régua) e dígitos tabulares seguem iguais. */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5 [&>*]:min-w-0">
        {[
          { label: 'Total', value: stats.total.toString(), color: 'text-foreground' },
          { label: 'Ativas', value: stats.ativas.toString(), color: 'text-foreground' },
          { label: 'Valor estimado', value: formatCurrency(stats.valorTotal), color: 'text-primary' },
          { label: 'Urgentes (≤3d)', value: stats.urgentes.toString(), color: stats.urgentes > 0 ? 'text-destructive' : 'text-muted-foreground' },
          { label: 'Prazo perdido', value: stats.prazoPerdido.toString(), color: stats.prazoPerdido > 0 ? 'text-warning' : 'text-muted-foreground' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground truncate">{s.label}</p>
            <p className={cn('mt-1 text-xl font-bold tabular-nums truncate', s.color)} title={s.value}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Faixas do ciclo de vida — a triagem que o sistema passa a fazer pelo
          usuário. Com um recorte vindo do indicador elas ficam desligadas: duas
          triagens ao mesmo tempo dariam um número que nenhum cartão prometeu. */}
      <div className={cn('rounded-lg border border-border bg-card p-4 shadow-sm', recorte && 'opacity-60')}>
        <div className="flex flex-wrap items-center gap-2">
          {FAIXAS.map((f) => {
            const ativa = faixasAtivas.includes(f.id);
            return (
              <Button
                key={f.id}
                type="button"
                variant="outline"
                size="sm"
                title={recorte ? 'Saia do recorte para triar por faixa' : f.descricao}
                aria-pressed={ativa}
                disabled={!!recorte}
                onClick={() =>
                  setFaixasAtivas((prev) =>
                    prev.includes(f.id) ? prev.filter((x) => x !== f.id) : [...prev, f.id]
                  )
                }
                className={cn(
                  'rounded-full',
                  ativa
                    ? 'border-primary/40 bg-primary-tint text-primary hover:bg-primary-tint'
                    : 'text-muted-foreground'
                )}
              >
                {f.label}
                <span className="text-xs tabular-nums opacity-70">{contagemPorFaixa[f.id]}</span>
              </Button>
            );
          })}
          <span className="text-xs text-muted-foreground ml-auto hidden sm:block">
            O Arquivo fica oculto por padrão
          </span>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px] space-y-2">
            <Label htmlFor="painel-busca">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="painel-busca"
                placeholder="Buscar por objeto, órgão ou número..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="painel-status">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="painel-status" className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Status</SelectItem>
                {uniqueStatus.map((s) => (
                  <SelectItem key={s} value={s}>{rotuloStatus(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="painel-modalidade">Modalidade</Label>
            <Select value={modalidadeFilter} onValueChange={setModalidadeFilter}>
              <SelectTrigger id="painel-modalidade" className="w-[180px]">
                <SelectValue placeholder="Modalidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas Modalidades</SelectItem>
                {uniqueModalidades.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="painel-uf">UF</Label>
            <Select value={ufFilter} onValueChange={setUfFilter}>
              <SelectTrigger id="painel-uf" className="w-[120px]">
                <SelectValue placeholder="UF" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas UFs</SelectItem>
                {uniqueUfs.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="button" variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn(refreshing && 'animate-spin')} aria-hidden="true" />
            Atualizar
          </Button>
        </div>

        {/* Ordenação */}
        <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-muted-foreground">
          <Filter className="w-4 h-4" aria-hidden="true" />
          <span>Ordenar:</span>
          {opcoesOrdenacao.map((opt) => {
            const ativo = sortField === opt.field;
            return (
              <Button
                key={opt.field}
                type="button"
                variant="ghost"
                size="sm"
                aria-pressed={ativo}
                onClick={() => toggleSort(opt.field)}
                /* Sem `text-xs`: o Button de ui já define a escala do rótulo de
                   controle (14). Encolher o texto de um botão abaixo dela era o
                   que fazia esta fileira parecer legenda, e não coisa clicável. */
                className={cn(ativo && 'bg-primary-tint text-primary hover:bg-primary-tint')}
              >
                {opt.label}
                {ativo && <ArrowUpDown aria-hidden="true" />}
              </Button>
            );
          })}
          <span className="ml-auto tabular-nums">{filtered.length} resultado(s)</span>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        {paginated.length === 0 ? (
          <EstadoVazio
            tamanho="compacto"
            icone={<Search />}
            titulo="Nenhuma licitação encontrada"
            descricao="Nenhuma licitação encontrada com os filtros selecionados."
            acao={
              <Button type="button" variant="outline" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th scope="col" className="text-left p-3 text-sm font-semibold text-muted-foreground">Nº / Objeto</th>
                  <th scope="col" className="text-left p-3 text-sm font-semibold text-muted-foreground hidden md:table-cell">Órgão</th>
                  <th scope="col" className="text-left p-3 text-sm font-semibold text-muted-foreground hidden lg:table-cell">Local</th>
                  <th scope="col" className="text-right p-3 text-sm font-semibold text-muted-foreground">Valor Est.</th>
                  <th scope="col" className="text-center p-3 text-sm font-semibold text-muted-foreground">Status</th>
                  <th scope="col" className="text-center p-3 text-sm font-semibold text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {paginated.map((lic, i) => {
                    const st = aparenciaStatus(lic.status);
                    const isUrgent = !lic.arquivado_em && lic.data_encerramento && (new Date(lic.data_encerramento).getTime() - Date.now()) < 3 * 24 * 60 * 60 * 1000 && (new Date(lic.data_encerramento).getTime() - Date.now()) > 0;
                    const perdeuPrazo = prazoPerdidoNoRadar(lic.status, lic.data_encerramento, lic.arquivado_em);
                    return (
                      <motion.tr
                        key={lic.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: i * 0.03 }}
                        onClick={() => navigate(`/processo/${lic.id}`)}
                        className={cn(
                          'border-b border-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer',
                          isUrgent && 'bg-destructive-tint/60',
                          lic.arquivado_em && 'opacity-60'
                        )}
                      >
                        <td className="p-3">
                          <span className="text-xs tabular-nums text-muted-foreground block">{lic.numero}</span>
                          <p className="text-sm font-medium truncate max-w-[300px]">{lic.objeto}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                            {lic.modalidade && <span>{lic.modalidade}</span>}
                            {lic.data_encerramento && (
                              <span className={cn('flex items-center gap-1', isUrgent && 'text-destructive font-semibold')}>
                                <Calendar className="w-4 h-4" aria-hidden="true" />
                                {new Date(lic.data_encerramento).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                            {/* Sinaliza a falha operacional em vez de escondê-la:
                                arquivar automaticamente aqui apagaria a evidência. */}
                            {perdeuPrazo && (
                              <span className="flex items-center gap-1 text-warning font-semibold">
                                <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                                Prazo perdido
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground hidden md:table-cell max-w-[200px] truncate">{lic.orgao}</td>
                        <td className="p-3 text-sm text-muted-foreground hidden lg:table-cell">
                          {lic.municipio && lic.uf ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" aria-hidden="true" />
                              {lic.municipio}/{lic.uf}
                            </span>
                          ) : lic.uf || '—'}
                        </td>
                        <td className="p-3 text-right text-sm font-semibold tabular-nums whitespace-nowrap">
                          {lic.valor_estimado ? formatCurrency(lic.valor_estimado) : '—'}
                        </td>
                        {/* stopPropagation: a linha inteira abre o prontuário, então
                            os controles precisam impedir a navegação. */}
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={lic.status}
                            onValueChange={(val) => handleStatusChange(lic.id, val)}
                          >
                            {/* A aparência do status vem de `aparenciaStatus` (lib/licitacao/status,
                                a autoridade do vocabulário) — o painel não redeclara cores. */}
                            <SelectTrigger
                              aria-label={`Status: ${st.label}. Alterar status`}
                              className="h-9 w-auto mx-auto gap-1 border-0 bg-transparent px-1 justify-center focus:ring-offset-0"
                            >
                              <Badge variant="outline" className={cn('text-xs', st.className)}>
                                {st.label}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_PROCESSO.map((s) => (
                                <SelectItem key={s} value={s}>{rotuloStatus(s)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9 w-9 p-0"
                              title="Abrir processo"
                              aria-label="Abrir processo"
                              onClick={() => navigate(`/processo/${lic.id}`)}
                            >
                              <Eye aria-hidden="true" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9 w-9 p-0"
                              title="Kanban"
                              aria-label="Abrir no Kanban"
                              onClick={() => navigate(`/kanban?focus=${lic.id}`)}
                            >
                              <Kanban aria-hidden="true" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9 w-9 p-0"
                              title="Documentos e proposta"
                              aria-label="Documentos e proposta"
                              onClick={() => navigate(`/processo/${lic.id}?aba=documentos`)}
                            >
                              <FileText aria-hidden="true" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9 w-9 p-0"
                              title="Precificação"
                              aria-label="Precificação"
                              onClick={() => navigate(`/processo/${lic.id}?aba=precificacao`)}
                            >
                              <Calculator aria-hidden="true" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9 w-9 p-0"
                              title="Mural / Chat"
                              aria-label="Mural e chat"
                              onClick={() => navigate(`/monitoramento-chat?lid=${lic.id}&num=${encodeURIComponent(lic.numero)}`)}
                            >
                              <MessageSquare aria-hidden="true" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9 w-9 p-0"
                              title="Robô de Lances"
                              aria-label="Robô de Lances"
                              onClick={() => navigate(`/robo-lances?licitacao=${lic.id}`)}
                            >
                              <Crosshair aria-hidden="true" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9 w-9 p-0"
                              title={lic.arquivado_em ? 'Restaurar processo' : 'Arquivar processo'}
                              aria-label={lic.arquivado_em ? 'Restaurar processo' : 'Arquivar processo'}
                              onClick={() => handleArquivar(lic)}
                            >
                              {lic.arquivado_em
                                ? <RotateCcw aria-hidden="true" />
                                : <Archive aria-hidden="true" />}
                            </Button>
                            {lic.url_edital && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-9 w-9 p-0"
                                title="Edital"
                                aria-label="Abrir edital"
                                onClick={() => window.open(lic.url_edital!, '_blank')}
                              >
                                <ExternalLink aria-hidden="true" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-sm text-muted-foreground tabular-nums">
              Página {page + 1} de {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0"
                aria-label="Página anterior"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0"
                aria-label="Próxima página"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <RegistrarPerdaDialog
        alvo={perdaAlvo}
        salvando={salvandoPerda}
        onCancelar={() => setPerdaAlvo(null)}
        onConfirmar={confirmarPerda}
      />
    </div>
  );
}
