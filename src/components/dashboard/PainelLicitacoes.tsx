import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
  FileText, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

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
};

const statusConfig: Record<string, { label: string; className: string }> = {
  Publicado: { label: 'Publicado', className: 'bg-info/10 text-info border-info/20' },
  monitorando: { label: 'Monitorando', className: 'bg-info/10 text-info border-info/20' },
  analisando: { label: 'Analisando', className: 'bg-warning/10 text-warning border-warning/20' },
  proposta: { label: 'Proposta', className: 'bg-primary/10 text-primary border-primary/20' },
  'Proposta Enviada': { label: 'Enviada', className: 'bg-accent/10 text-accent border-accent/20' },
  enviada: { label: 'Enviada', className: 'bg-accent/10 text-accent border-accent/20' },
  Vencida: { label: 'Vencida', className: 'bg-success/10 text-success border-success/20' },
  vencida: { label: 'Vencida', className: 'bg-success/10 text-success border-success/20' },
  Homologada: { label: 'Homologada', className: 'bg-success/10 text-success border-success/20' },
  Perdida: { label: 'Perdida', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  perdida: { label: 'Perdida', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const PAGE_SIZE = 10;

export default function PainelLicitacoes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [modalidadeFilter, setModalidadeFilter] = useState<string>('todos');
  const [ufFilter, setUfFilter] = useState<string>('todos');
  const [sortField, setSortField] = useState<'created_at' | 'data_encerramento' | 'valor_estimado'>('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (user) loadLicitacoes();
  }, [user]);

  async function loadLicitacoes() {
    setLoading(true);
    const { data, error } = await supabase
      .from('licitacoes')
      .select('id, numero, orgao, objeto, status, modalidade, valor_estimado, uf, municipio, data_abertura, data_encerramento, portal, url_edital, created_at')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

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
    const { error } = await supabase
      .from('licitacoes')
      .update({ status: newStatus })
      .eq('id', id)
      .eq('user_id', user!.id);

    if (error) {
      toast.error('Erro ao atualizar status');
    } else {
      setLicitacoes((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l))
      );
      toast.success('Status atualizado');
    }
  }

  // Derived unique values for filters
  const uniqueStatus = useMemo(() => [...new Set(licitacoes.map((l) => l.status))], [licitacoes]);
  const uniqueModalidades = useMemo(() => [...new Set(licitacoes.map((l) => l.modalidade))], [licitacoes]);
  const uniqueUfs = useMemo(() => [...new Set(licitacoes.filter((l) => l.uf).map((l) => l.uf!))].sort(), [licitacoes]);

  // Filtered & sorted
  const filtered = useMemo(() => {
    let result = [...licitacoes];

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
  }, [licitacoes, search, statusFilter, modalidadeFilter, ufFilter, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
  }, [search, statusFilter, modalidadeFilter, ufFilter]);

  // Summary stats
  const stats = useMemo(() => {
    const total = filtered.length;
    const ativas = filtered.filter((l) => !['Perdida', 'perdida', 'Vencida', 'vencida', 'Homologada'].includes(l.status)).length;
    const valorTotal = filtered.reduce((s, l) => s + (l.valor_estimado || 0), 0);
    const urgentes = filtered.filter((l) => {
      if (!l.data_encerramento) return false;
      const diff = new Date(l.data_encerramento).getTime() - Date.now();
      return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
    }).length;
    return { total, ativas, valorTotal, urgentes };
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total.toString(), color: 'text-foreground' },
          { label: 'Ativas', value: stats.ativas.toString(), color: 'text-info' },
          { label: 'Valor Estimado', value: formatCurrency(stats.valorTotal), color: 'text-accent' },
          { label: 'Urgentes (≤3d)', value: stats.urgentes.toString(), color: stats.urgentes > 0 ? 'text-destructive' : 'text-muted-foreground' },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-xl border border-border/50 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{s.label}</p>
            <p className={cn('text-lg font-bold mt-0.5', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border/50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por objeto, órgão ou número..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Status</SelectItem>
              {uniqueStatus.map((s) => (
                <SelectItem key={s} value={s}>{statusConfig[s]?.label || s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={modalidadeFilter} onValueChange={setModalidadeFilter}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
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
            <SelectTrigger className="w-[100px] h-9 text-xs">
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
                  <th className="text-center p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground w-[180px]">Ações</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {paginated.map((lic, i) => {
                    const st = statusConfig[lic.status] || { label: lic.status, className: 'bg-muted text-muted-foreground' };
                    const isUrgent = lic.data_encerramento && (new Date(lic.data_encerramento).getTime() - Date.now()) < 3 * 24 * 60 * 60 * 1000 && (new Date(lic.data_encerramento).getTime() - Date.now()) > 0;
                    return (
                      <motion.tr
                        key={lic.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={cn(
                          'border-b border-border/30 hover:bg-muted/40 transition-colors',
                          isUrgent && 'bg-destructive/5'
                        )}
                      >
                        <td className="p-3">
                          <span className="text-[11px] font-mono text-muted-foreground block">{lic.numero}</span>
                          <p className="font-medium truncate max-w-[300px]">{lic.objeto}</p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                            {lic.modalidade && <span>{lic.modalidade}</span>}
                            {lic.data_encerramento && (
                              <span className={cn('flex items-center gap-0.5', isUrgent && 'text-destructive font-semibold')}>
                                <Calendar className="w-3 h-3" />
                                {new Date(lic.data_encerramento).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground hidden md:table-cell max-w-[200px] truncate">{lic.orgao}</td>
                        <td className="p-3 text-xs text-muted-foreground hidden lg:table-cell">
                          {lic.municipio && lic.uf ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {lic.municipio}/{lic.uf}
                            </span>
                          ) : lic.uf || '—'}
                        </td>
                        <td className="p-3 text-right font-semibold text-xs">
                          {lic.valor_estimado ? formatCurrency(lic.valor_estimado) : '—'}
                        </td>
                        <td className="p-3 text-center">
                          <Select
                            value={lic.status}
                            onValueChange={(val) => handleStatusChange(lic.id, val)}
                          >
                            <SelectTrigger className="h-7 w-[120px] mx-auto text-[11px] border-0 bg-transparent p-0 justify-center">
                              <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5', st.className)}>
                                {st.label}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(statusConfig).map(([key, cfg]) => (
                                <SelectItem key={key} value={key} className="text-xs">{cfg.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Ver detalhes"
                              onClick={() => navigate('/licitacoes-estrategicas')}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Kanban"
                              onClick={() => navigate('/kanban')}
                            >
                              <Kanban className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Proposta Técnica"
                              onClick={() => navigate('/proposta-tecnica')}
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Robô de Lances"
                              onClick={() => navigate('/robo-lances')}
                            >
                              <Crosshair className="w-3.5 h-3.5" />
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
    </div>
  );
}
