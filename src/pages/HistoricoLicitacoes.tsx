import { useState, useEffect, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Search, Archive, Trophy, XCircle, Download, Calendar, Building2, MapPin,
  TrendingUp, CheckCircle, AlertTriangle, BarChart3, Clock,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { downloadCSV, downloadPDF, downloadJSON } from '@/lib/download-utils';

const STATUS_FLOW = ['Publicado', 'Em Disputa', 'Homologado', 'Contrato Assinado', 'Deserto', 'Fracassado', 'Revogado', 'Anulado'] as const;

const statusConfig: Record<string, { label: string; className: string; icon: typeof Trophy }> = {
  'Publicado': { label: 'Publicado', className: 'bg-info/10 text-info border-info/20', icon: Clock },
  'Em Disputa': { label: 'Em Disputa', className: 'bg-warning/10 text-warning border-warning/20', icon: TrendingUp },
  'Homologado': { label: 'Homologado', className: 'bg-success/10 text-success border-success/20', icon: CheckCircle },
  'Contrato Assinado': { label: 'Contrato Assinado', className: 'bg-accent/10 text-accent border-accent/20', icon: CheckCircle },
  'Deserto': { label: 'Deserto', className: 'bg-muted text-muted-foreground border-border', icon: AlertTriangle },
  'Fracassado': { label: 'Fracassado', className: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle },
  'Revogado': { label: 'Revogado', className: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle },
  'Anulado': { label: 'Anulado', className: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle },
};

const resultadoOptions = ['Vencida', 'Perdida', 'Desclassificada', 'Deserto', 'Fracassado', 'Revogado', 'Anulado'];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type Licitacao = {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  modalidade: string;
  status: string;
  valor_estimado: number | null;
  valor_adjudicado: number | null;
  resultado: string | null;
  vencedor: boolean | null;
  data_homologacao: string | null;
  data_encerramento: string | null;
  arquivado_em: string | null;
  uf: string | null;
  municipio: string | null;
  created_at: string;
};

export default function HistoricoLicitacoes() {
  const { user } = useAuth();
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [resultadoFilter, setResultadoFilter] = useState<string>('all');

  // Edit dialog
  const [editingLic, setEditingLic] = useState<Licitacao | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editResultado, setEditResultado] = useState('');
  const [editVencedor, setEditVencedor] = useState<string>('');
  const [editValorAdj, setEditValorAdj] = useState('');
  const [editDataHom, setEditDataHom] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('licitacoes')
      .select('id, numero, orgao, objeto, modalidade, status, valor_estimado, valor_adjudicado, resultado, vencedor, data_homologacao, data_encerramento, arquivado_em, uf, municipio, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setLicitacoes(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  // Metrics
  const metrics = useMemo(() => {
    const total = licitacoes.length;
    const vencidas = licitacoes.filter(l => l.vencedor === true).length;
    const perdidas = licitacoes.filter(l => l.resultado === 'Perdida').length;
    const finalizados = licitacoes.filter(l => ['Homologado', 'Contrato Assinado', 'Deserto', 'Fracassado', 'Revogado', 'Anulado'].includes(l.status)).length;
    const emAndamento = total - finalizados;
    const taxaSucesso = finalizados > 0 ? ((vencidas / finalizados) * 100).toFixed(1) : '0';
    const valorGanho = licitacoes
      .filter(l => l.vencedor === true)
      .reduce((s, l) => s + (l.valor_adjudicado || l.valor_estimado || 0), 0);
    const arquivados = licitacoes.filter(l => l.arquivado_em).length;
    return { total, vencidas, perdidas, finalizados, emAndamento, taxaSucesso, valorGanho, arquivados };
  }, [licitacoes]);

  const filtered = licitacoes.filter((l) => {
    const matchSearch =
      l.objeto.toLowerCase().includes(search.toLowerCase()) ||
      l.orgao.toLowerCase().includes(search.toLowerCase()) ||
      l.numero.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    const matchResult = resultadoFilter === 'all' || l.resultado === resultadoFilter;
    return matchSearch && matchStatus && matchResult;
  });

  const openEdit = (lic: Licitacao) => {
    setEditingLic(lic);
    setEditStatus(lic.status);
    setEditResultado(lic.resultado || '');
    setEditVencedor(lic.vencedor === true ? 'sim' : lic.vencedor === false ? 'nao' : '');
    setEditValorAdj(lic.valor_adjudicado?.toString() || '');
    setEditDataHom(lic.data_homologacao ? lic.data_homologacao.split('T')[0] : '');
  };

  const handleSave = async () => {
    if (!editingLic) return;
    setSaving(true);
    const finalStatuses = ['Homologado', 'Contrato Assinado', 'Deserto', 'Fracassado', 'Revogado', 'Anulado'];
    const shouldArchive = finalStatuses.includes(editStatus) && !editingLic.arquivado_em;

    const { error } = await supabase
      .from('licitacoes')
      .update({
        status: editStatus,
        resultado: editResultado || null,
        vencedor: editVencedor === 'sim' ? true : editVencedor === 'nao' ? false : null,
        valor_adjudicado: editValorAdj ? parseFloat(editValorAdj) : null,
        data_homologacao: editDataHom ? new Date(editDataHom).toISOString() : null,
        arquivado_em: shouldArchive ? new Date().toISOString() : editingLic.arquivado_em,
      })
      .eq('id', editingLic.id);

    setSaving(false);
    if (error) {
      toast.error('Erro ao atualizar: ' + error.message);
    } else {
      toast.success('Licitação atualizada!');
      setEditingLic(null);
      fetchData();
    }
  };

  const handleDownloadAll = () => {
    const headers = ['Número', 'Órgão', 'Objeto', 'Status', 'Resultado', 'Vencedor', 'Valor Estimado', 'Valor Adjudicado', 'Homologação', 'UF'];
    const rows = filtered.map(l => [
      l.numero, l.orgao, l.objeto, l.status, l.resultado || '', l.vencedor ? 'Sim' : 'Não',
      l.valor_estimado?.toString() || '', l.valor_adjudicado?.toString() || '',
      l.data_homologacao ? new Date(l.data_homologacao).toLocaleDateString('pt-BR') : '', l.uf || '',
    ]);
    downloadCSV('historico-licitacoes', headers, rows);
    toast.success('Download realizado!');
  };

  const handleDownloadPDF = () => {
    const headers = ['Número', 'Órgão', 'Status', 'Resultado', 'Valor Adj.', 'Homologação'];
    const rows = filtered.map(l => [
      l.numero, l.orgao, l.status, l.resultado || '-',
      l.valor_adjudicado ? formatCurrency(l.valor_adjudicado) : '-',
      l.data_homologacao ? new Date(l.data_homologacao).toLocaleDateString('pt-BR') : '-',
    ]);
    downloadPDF('historico-licitacoes', 'Histórico de Licitações', headers, rows);
    toast.success('PDF gerado!');
  };

  const handleDownloadJSON = () => {
    downloadJSON('historico-licitacoes', filtered);
    toast.success('JSON exportado!');
  };

  const diasRestantes = (arquivadoEm: string | null) => {
    if (!arquivadoEm) return null;
    const dias = 120 - Math.floor((Date.now() - new Date(arquivadoEm).getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, dias);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
              <Archive className="w-5 h-5 sm:w-6 sm:h-6 text-accent flex-shrink-0" />
              Histórico e Desempenho
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Acompanhe os resultados das licitações. Processos finalizados ficam disponíveis por 120 dias.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadAll}>
              <Download className="w-4 h-4 mr-1" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
              <Download className="w-4 h-4 mr-1" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadJSON}>
              <Download className="w-4 h-4 mr-1" /> JSON
            </Button>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total', value: metrics.total, icon: BarChart3, color: 'text-foreground' },
            { label: 'Em Andamento', value: metrics.emAndamento, icon: Clock, color: 'text-warning' },
            { label: 'Vencidas', value: metrics.vencidas, icon: Trophy, color: 'text-success' },
            { label: 'Perdidas', value: metrics.perdidas, icon: XCircle, color: 'text-destructive' },
            { label: 'Taxa de Sucesso', value: `${metrics.taxaSucesso}%`, icon: TrendingUp, color: 'text-accent' },
            { label: 'Valor Ganho', value: formatCurrency(metrics.valorGanho), icon: CheckCircle, color: 'text-success' },
          ].map((m, i) => (
            <div key={i} className="bg-card rounded-xl border border-border/50 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <m.icon className={cn('w-4 h-4', m.color)} />
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
              <p className={cn('text-lg font-bold', m.color)}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Alert */}
        {metrics.arquivados > 0 && (
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 flex items-start gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
            <span>
              <strong>{metrics.arquivados}</strong> processo(s) arquivado(s). Faça o download antes do prazo de 120 dias para evitar perda de dados.
            </span>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[250px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-9 bg-card border-border/50" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[170px] bg-card border-border/50"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUS_FLOW.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={resultadoFilter} onValueChange={setResultadoFilter}>
            <SelectTrigger className="w-[160px] bg-card border-border/50"><SelectValue placeholder="Resultado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos resultados</SelectItem>
              {resultadoOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] table-auto">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap min-w-[320px]">Nº / Objeto</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap min-w-[200px]">Órgão</th>
                  <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap w-[140px]">Status</th>
                  <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap w-[120px]">Resultado</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap w-[130px]">Valor Adj.</th>
                  <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap w-[110px]">Prazo</th>
                  <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap w-[90px]">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && !loading && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma licitação encontrada.</td></tr>
                )}
                {filtered.map((lic, i) => {
                  const st = statusConfig[lic.status] || { label: lic.status, className: 'bg-muted text-muted-foreground', icon: Clock };
                  const dias = diasRestantes(lic.arquivado_em);
                  return (
                    <tr key={lic.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-muted-foreground block">{lic.numero}</span>
                        <span className="text-sm font-medium line-clamp-1">{lic.objeto}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="line-clamp-1">{lic.orgao}</span>
                        </div>
                        {lic.municipio && lic.uf && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" />{lic.municipio}/{lic.uf}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5', st.className)}>{st.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {lic.vencedor === true ? (
                          <Badge className="bg-success/10 text-success border-success/20 text-[10px]">
                            <Trophy className="w-3 h-3 mr-1" /> Vencida
                          </Badge>
                        ) : lic.resultado ? (
                          <span className="text-xs text-muted-foreground">{lic.resultado}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold">
                        {lic.valor_adjudicado ? formatCurrency(lic.valor_adjudicado) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {dias !== null ? (
                          <span className={cn('text-xs font-medium', dias <= 30 ? 'text-destructive' : dias <= 60 ? 'text-warning' : 'text-muted-foreground')}>
                            {dias}d restantes
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(lic)} className="text-xs">
                          Editar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Status flow legend */}
        <div className="bg-card rounded-xl border border-border/50 shadow-sm p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Fluxo de Status Padronizado</p>
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_FLOW.map((s, i) => {
              const st = statusConfig[s];
              return (
                <div key={s} className="flex items-center gap-1">
                  <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5', st.className)}>{st.label}</Badge>
                  {i < STATUS_FLOW.length - 1 && i < 3 && <span className="text-muted-foreground text-xs">→</span>}
                  {i === 3 && <span className="text-muted-foreground text-xs ml-2">|</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingLic} onOpenChange={(o) => !o && setEditingLic(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atualizar Resultado — {editingLic?.numero}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_FLOW.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Resultado</Label>
              <Select value={editResultado} onValueChange={setEditResultado}>
                <SelectTrigger><SelectValue placeholder="Selecionar resultado" /></SelectTrigger>
                <SelectContent>
                  {resultadoOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Empresa vencedora?</Label>
              <Select value={editVencedor} onValueChange={setEditVencedor}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor Adjudicado (R$)</Label>
              <Input type="number" step="0.01" value={editValorAdj} onChange={e => setEditValorAdj(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Data de Homologação</Label>
              <Input type="date" value={editDataHom} onChange={e => setEditDataHom(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLic(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
