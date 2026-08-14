import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  FileText, Loader2, MessageSquare, Archive, RotateCcw, AlertTriangle, Calculator,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  STATUS_PROCESSO, FAIXAS, FAIXAS_PADRAO, type Faixa,
  faixaDe, aparenciaStatus, rotuloStatus, prazoPerdidoNoRadar,
} from '@/lib/licitacao/status';
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

    result = result.filter((l) => faixasAtivas.includes(faixaDe(l.status, l.arquivado_em)));

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

    result.sort((a, b) => {
      let va: any = a[sortField];
      let vb: any = b[sortField];
      if (va == null) va = sortAsc ? Infinity : -Infinity;
      if (vb == null) vb = sortAsc ? Infinity : -Infinity;
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

    return result;
  }, [licitacoes, faixasAtivas, search, statusFilter, modalidadeFilter, ufFilter, sortField, sortAsc]);

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
  }, [faixasAtivas, search, statusFilter, modalidadeFilter, ufFilter]);

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

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border/50 p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando processos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total.toString(), color: 'text-foreground' },
          { label: 'Ativas', value: stats.ativas.toString(), color: 'text-foreground' },
          { label: 'Valor Estimado', value: formatCurrency(stats.valorTotal), color: 'text-accent' },
          { label: 'Urgentes (≤3d)', value: stats.urgentes.toString(), color: stats.urgentes > 0 ? 'text-destructive' : 'text-muted-foreground' },
          { label: 'Prazo perdido', value: stats.prazoPerdido.toString(), color: stats.prazoPerdido > 0 ? 'text-warning' : 'text-muted-foreground' },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-xl border border-border/50 p-3 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{s.label}</p>
            <p className={cn('text-lg font-bold mt-0.5', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Faixas do ciclo de vida — a triagem que o sistema passa a fazer pelo usuário */}
      <div className="bg-card rounded-xl border border-border/50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {FAIXAS.map((f) => {
            const ativa = faixasAtivas.includes(f.id);
            return (
              <button
                key={f.id}
                title={f.descricao}
                aria-pressed={ativa}
                onClick={() =>
                  setFaixasAtivas((prev) =>
                    prev.includes(f.id) ? prev.filter((x) => x !== f.id) : [...prev, f.id]
                  )
                }
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  ativa
                    ? 'bg-accent/10 border-accent/30 text-accent font-medium'
                    : 'bg-transparent border-border/60 text-muted-foreground hover:bg-muted'
                )}
              >
                {f.label}
                <span className="text-xs tabular-nums opacity-70">{contagemPorFaixa[f.id]}</span>
              </button>
            );
          })}
          <span className="text-xs text-muted-foreground ml-auto hidden sm:block">
            O Arquivo fica oculto por padrão
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border/50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por objeto, órgão ou número..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Status</SelectItem>
              {uniqueStatus.map((s) => (
                <SelectItem key={s} value={s}>{rotuloStatus(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={modalidadeFilter} onValueChange={setModalidadeFilter}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="Modalidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas Modalidades</SelectItem>
              {uniqueModalidades.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={ufFilter} onValueChange={setUfFilter}>
            <SelectTrigger className="w-[100px] h-9 text-sm">
              <SelectValue placeholder="UF" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas UFs</SelectItem>
              {uniqueUfs.map((u) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="h-9">
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          </Button>
        </div>

        {/* Sort buttons */}
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <Filter className="w-3.5 h-3.5" />
          <span>Ordenar:</span>
          {[
            { field: 'created_at' as const, label: 'Recente' },
            { field: 'data_encerramento' as const, label: 'Encerramento' },
            { field: 'valor_estimado' as const, label: 'Valor' },
          ].map((opt) => (
            <button
              key={opt.field}
              onClick={() => toggleSort(opt.field)}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-md transition-colors',
                sortField === opt.field ? 'bg-accent/10 text-accent font-medium' : 'hover:bg-muted'
              )}
            >
              {opt.label}
              {sortField === opt.field && <ArrowUpDown className="w-3 h-3" />}
            </button>
          ))}
          <span className="ml-auto">{filtered.length} resultado(s)</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        {paginated.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma licitação encontrada com os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Nº / Objeto</th>
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Órgão</th>
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Local</th>
                  <th className="text-right p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Valor Est.</th>
                  <th className="text-center p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="text-center p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground w-[240px]">Ações</th>
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
                          'border-b border-border/30 hover:bg-muted/40 transition-colors cursor-pointer',
                          isUrgent && 'bg-destructive/5',
                          lic.arquivado_em && 'opacity-60'
                        )}
                      >
                        <td className="p-3">
                          <span className="text-xs tabular-nums text-muted-foreground block">{lic.numero}</span>
                          <p className="text-base font-medium truncate max-w-[300px]">{lic.objeto}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            {lic.modalidade && <span>{lic.modalidade}</span>}
                            {lic.data_encerramento && (
                              <span className={cn('flex items-center gap-0.5', isUrgent && 'text-destructive font-semibold')}>
                                <Calendar className="w-3 h-3" />
                                {new Date(lic.data_encerramento).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                            {/* Sinaliza a falha operacional em vez de escondê-la:
                                arquivar automaticamente aqui apagaria a evidência. */}
                            {perdeuPrazo && (
                              <span className="flex items-center gap-0.5 text-warning font-semibold">
                                <AlertTriangle className="w-3 h-3" />
                                Prazo perdido
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground hidden md:table-cell max-w-[200px] truncate">{lic.orgao}</td>
                        <td className="p-3 text-sm text-muted-foreground hidden lg:table-cell">
                          {lic.municipio && lic.uf ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {lic.municipio}/{lic.uf}
                            </span>
                          ) : lic.uf || '—'}
                        </td>
                        <td className="p-3 text-right font-semibold text-sm">
                          {lic.valor_estimado ? formatCurrency(lic.valor_estimado) : '—'}
                        </td>
                        {/* stopPropagation: a linha inteira abre o prontuário, então
                            os controles precisam impedir a navegação. */}
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={lic.status}
                            onValueChange={(val) => handleStatusChange(lic.id, val)}
                          >
                            <SelectTrigger className="h-7 w-[120px] mx-auto text-xs border-0 bg-transparent p-0 justify-center">
                              <Badge variant="outline" className={cn('text-xs px-2 py-0.5', st.className)}>
                                {st.label}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_PROCESSO.map((s) => (
                                <SelectItem key={s} value={s} className="text-xs">{rotuloStatus(s)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Abrir processo"
                              onClick={() => navigate(`/processo/${lic.id}`)}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Kanban"
                              onClick={() => navigate(`/kanban?focus=${lic.id}`)}
                            >
                              <Kanban className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Documentos e proposta"
                              onClick={() => navigate(`/processo/${lic.id}?aba=documentos`)}
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Precificação"
                              onClick={() => navigate(`/processo/${lic.id}?aba=precificacao`)}
                            >
                              <Calculator className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Mural / Chat"
                              onClick={() => navigate(`/monitoramento-chat?lid=${lic.id}&num=${encodeURIComponent(lic.numero)}`)}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Robô de Lances"
                              onClick={() => navigate(`/robo-lances?licitacao=${lic.id}`)}
                            >
                              <Crosshair className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title={lic.arquivado_em ? 'Restaurar processo' : 'Arquivar processo'}
                              onClick={() => handleArquivar(lic)}
                            >
                              {lic.arquivado_em
                                ? <RotateCcw className="w-3.5 h-3.5" />
                                : <Archive className="w-3.5 h-3.5" />}
                            </Button>
                            {lic.url_edital && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                title="Edital"
                                onClick={() => window.open(lic.url_edital!, '_blank')}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/30">
            <span className="text-xs text-muted-foreground">
              Página {page + 1} de {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="w-4 h-4" />
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
