import { useState, useEffect, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  ehDecidido, STATUS_PROCESSO, normalizarStatus, rotuloStatus, type StatusProcesso,
} from '@/lib/licitacao/status';
import {
  Search, Archive, Trophy, XCircle, Download, Building2, MapPin,
  TrendingUp, CheckCircle, AlertTriangle, BarChart3, Clock,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { downloadCSV, downloadPDF, downloadJSON } from '@/lib/download-utils';
import { identidadeDoEdital } from '@/lib/licitacao/identidade-edital';

// A quarta lista de status que existia aqui ('Publicado', 'Homologado' no
// masculino, 'Contrato Assinado'…) era a origem dos valores que nenhuma outra
// tela reconhecia — e do arquivamento automático que nunca disparava (D1).
// Status agora é o vocabulário canônico; Deserto/Fracassado/Revogado/Anulado
// e Contrato Assinado são DESFECHOS e vivem no campo Resultado.
const STATUS_FLOW = STATUS_PROCESSO;

/** Variantes semânticas do Badge (identidade 12/09) — status sempre com texto. */
type VarianteBadge = 'success' | 'warning' | 'danger' | 'info' | 'muted';

/**
 * Aparência de cada status canônico no Badge. O vocabulário continua sendo o
 * de `@/lib/licitacao/status` (o tipo garante cobertura completa); aqui só se
 * escolhe a família semântica — a lib devolve classes com alfa composto à
 * mão (`bg-warning/10 text-warning`), que a régua nova aposentou.
 */
const VARIANTE_STATUS: Record<StatusProcesso, VarianteBadge> = {
  Monitorando: 'muted',
  'Em Análise': 'warning',
  'Proposta Enviada': 'info',
  'Em Disputa': 'info',
  Vencida: 'success',
  Homologada: 'success',
  Perdida: 'danger',
  Arquivada: 'muted',
};

const statusConfig: Record<string, { label: string; variant: VarianteBadge }> = {
  'Publicado': { label: 'Publicado', variant: 'info' },
  'Em Disputa': { label: 'Em Disputa', variant: 'warning' },
  'Homologado': { label: 'Homologado', variant: 'success' },
  'Contrato Assinado': { label: 'Contrato Assinado', variant: 'success' },
  'Deserto': { label: 'Deserto', variant: 'muted' },
  'Fracassado': { label: 'Fracassado', variant: 'danger' },
  'Revogado': { label: 'Revogado', variant: 'danger' },
  'Anulado': { label: 'Anulado', variant: 'danger' },
};

const resultadoOptions = ['Vencida', 'Perdida', 'Desclassificada', 'Deserto', 'Fracassado', 'Revogado', 'Anulado', 'Contrato Assinado'];

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
  const { empresaAtiva } = useEmpresa();
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
    // Histórico da empresa: o resultado de uma licitação é patrimônio da
    // empresa, não do colaborador que a cadastrou.
    let q = supabase
      .from('licitacoes')
      .select('id, numero, orgao, objeto, modalidade, status, valor_estimado, valor_adjudicado, resultado, vencedor, data_homologacao, data_encerramento, arquivado_em, uf, municipio, created_at');
    if (empresaAtiva) q = q.eq('empresa_id', empresaAtiva.id);
    const { data } = await q.order('created_at', { ascending: false });
    setLicitacoes(data || []);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, [user, empresaAtiva?.id]);

  // Metrics
  const metrics = useMemo(() => {
    const total = licitacoes.length;
    const vencidas = licitacoes.filter(l => l.vencedor === true).length;
    const perdidas = licitacoes.filter(l => l.resultado === 'Perdida').length;
    // Conta pelo desfecho real (status OU resultado) — a lista masculina antiga nunca casava com o que o app grava
    const finalizados = licitacoes.filter(l => ehDecidido(l.status, l.resultado)).length;
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
    // A lista literal que existia aqui era a mesma da edge function e usava
    // grafias que o app nunca grava ('Homologado' no masculino). `ehDecidido`
    // olha os dois eixos — status e resultado — que é onde os desfechos
    // realmente estão.
    const shouldArchive = ehDecidido(editStatus, editResultado) && !editingLic.arquivado_em;

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
      {/* Título, descrição, ícone e trilha vêm do registro
          `lib/navegacao/paginas.ts` pela rota. O prazo de 120 dias saiu da
          descrição e ficou onde ele significa alguma coisa: no aviso que só
          aparece quando existe processo arquivado correndo o prazo. */}
      <CabecalhoPagina
        acoes={
          <>
            <Button variant="outline" onClick={handleDownloadAll}>
              <Download aria-hidden="true" /> CSV
            </Button>
            <Button variant="outline" onClick={handleDownloadPDF}>
              <Download aria-hidden="true" /> PDF
            </Button>
            <Button variant="outline" onClick={handleDownloadJSON}>
              <Download aria-hidden="true" /> JSON
            </Button>
          </>
        }
        filtros={
          <>
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Buscar..."
                aria-label="Buscar por objeto, órgão ou número"
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48" aria-label="Filtrar por status"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {STATUS_FLOW.map(s => <SelectItem key={s} value={s}>{rotuloStatus(s)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={resultadoFilter} onValueChange={setResultadoFilter}>
              <SelectTrigger className="w-full sm:w-48" aria-label="Filtrar por resultado"><SelectValue placeholder="Resultado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos resultados</SelectItem>
                {resultadoOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        }
      />

      <div className="space-y-6">
        {/* Metrics */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {[
            { label: 'Total', value: metrics.total, icon: BarChart3, color: 'text-foreground' },
            { label: 'Em andamento', value: metrics.emAndamento, icon: Clock, color: 'text-warning' },
            { label: 'Vencidas', value: metrics.vencidas, icon: Trophy, color: 'text-success' },
            { label: 'Perdidas', value: metrics.perdidas, icon: XCircle, color: 'text-destructive' },
            { label: 'Taxa de sucesso', value: `${metrics.taxaSucesso}%`, icon: TrendingUp, color: 'text-foreground' },
            { label: 'Valor ganho', value: formatCurrency(metrics.valorGanho), icon: CheckCircle, color: 'text-success' },
          ].map((m, i) => (
            <Card key={i} className="min-w-0 p-6">
              <div className="mb-2 flex items-start justify-between gap-2">
                <span className="text-xs text-muted-foreground">{m.label}</span>
                <m.icon className={cn('h-4 w-4 shrink-0', m.color)} aria-hidden="true" />
              </div>
              <p className={cn('text-[2rem] font-bold leading-10 tabular-nums [overflow-wrap:anywhere]', m.color)}>{m.value}</p>
            </Card>
          ))}
        </div>

        {/* Alert */}
        {metrics.arquivados > 0 && (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription className="text-base">
              <strong>{metrics.arquivados}</strong> processo(s) arquivado(s). Faça o download antes do prazo de 120 dias para evitar perda de dados.
            </AlertDescription>
          </Alert>
        )}

        {/* Table */}
        <Card className="overflow-hidden">
          <Table className="min-w-[1100px] table-fixed">
            <colgroup>
              <col className="w-[340px]" />
              <col className="w-[220px]" />
              <col className="w-[130px]" />
              <col className="w-[130px]" />
              <col className="w-[150px]" />
              <col className="w-[120px]" />
              <col className="w-[110px]" />
            </colgroup>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="whitespace-nowrap">Nº / Objeto</TableHead>
                <TableHead className="whitespace-nowrap">Órgão</TableHead>
                <TableHead className="whitespace-nowrap text-center">Status</TableHead>
                <TableHead className="whitespace-nowrap text-center">Resultado</TableHead>
                <TableHead className="whitespace-nowrap text-right">Valor adj.</TableHead>
                <TableHead className="whitespace-nowrap text-center">Prazo</TableHead>
                <TableHead className="whitespace-nowrap text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && [0, 1, 2].map((i) => (
                <TableRow key={`sk-${i}`}>
                  <TableCell><Skeleton className="h-4 w-24" /><Skeleton className="mt-2 h-4 w-64" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="mx-auto h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="mx-auto h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="ml-auto h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="mx-auto h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="mx-auto h-8 w-16" /></TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && !loading && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7}>
                    <EstadoVazio
                      tamanho="compacto"
                      icone={<Archive />}
                      titulo="Nenhuma licitação encontrada"
                      descricao="Ajuste a busca ou os filtros de status e resultado."
                    />
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((lic) => {
                const st = statusConfig[lic.status]
                  || { label: rotuloStatus(lic.status), variant: VARIANTE_STATUS[normalizarStatus(lic.status)] };
                const dias = diasRestantes(lic.arquivado_em);
                return (
                  <TableRow key={lic.id}>
                    <TableCell className="px-4 py-3">
                      {(() => {
                        // Autoridade única de nomeação — "P.E. 044", "6" e
                        // "00046" crus não identificam; a forma do portal
                        // fica no hover.
                        const identidade = identidadeDoEdital({ numeroCompra: lic.numero, modalidade: lic.modalidade });
                        return (
                          <span
                            className="block cursor-help text-xs font-medium text-muted-foreground"
                            title={identidade.reescrito ? `Como o portal publica: ${identidade.bruto}` : undefined}
                          >
                            {identidade.rotulo}{identidade.srpNoTexto ? ' · SRP' : ''}
                          </span>
                        );
                      })()}
                      <span className="text-sm font-medium line-clamp-1">{lic.objeto}</span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="line-clamp-1">{lic.orgao}</span>
                      </div>
                      {lic.municipio && lic.uf && (
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-4 w-4" aria-hidden="true" />{lic.municipio}/{lic.uf}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      {lic.vencedor === true ? (
                        <Badge variant="success" className="gap-1">
                          <Trophy className="h-3 w-3" aria-hidden="true" /> Vencida
                        </Badge>
                      ) : lic.resultado ? (
                        <span className="text-sm text-muted-foreground">{lic.resultado}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
                      {lic.valor_adjudicado ? formatCurrency(lic.valor_adjudicado) : '-'}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      {dias !== null ? (
                        <span className={cn('text-sm font-medium tabular-nums', dias <= 30 ? 'text-destructive' : dias <= 60 ? 'text-warning' : 'text-muted-foreground')}>
                          {dias}d restantes
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(lic)}>
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>

        {/* Status flow legend */}
        <Card className="p-6">
          <h2 className="mb-3 text-lg font-semibold">Fluxo de status padronizado</h2>
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_FLOW.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <Badge variant={VARIANTE_STATUS[s]}>{rotuloStatus(s)}</Badge>
                {i < 3 && <span className="text-xs text-muted-foreground" aria-hidden="true">→</span>}
                {i === 3 && <span className="ml-2 text-xs text-muted-foreground" aria-hidden="true">|</span>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingLic} onOpenChange={(o) => !o && setEditingLic(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Atualizar resultado — {editingLic ? identidadeDoEdital({ numeroCompra: editingLic.numero, modalidade: editingLic.modalidade }).rotulo : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger id="edit-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_FLOW.map(s => <SelectItem key={s} value={s}>{rotuloStatus(s)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-resultado">Resultado</Label>
              <Select value={editResultado} onValueChange={setEditResultado}>
                <SelectTrigger id="edit-resultado"><SelectValue placeholder="Selecionar resultado" /></SelectTrigger>
                <SelectContent>
                  {resultadoOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-vencedor">Empresa vencedora?</Label>
              <Select value={editVencedor} onValueChange={setEditVencedor}>
                <SelectTrigger id="edit-vencedor"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-valor-adj">Valor adjudicado (R$)</Label>
              <MoneyInput id="edit-valor-adj" value={Number(editValorAdj) || 0} onValueChange={v => setEditValorAdj(String(v))} placeholder="R$ 0,00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-data-hom">Data de homologação</Label>
              <Input id="edit-data-hom" type="date" value={editDataHom} onChange={e => setEditDataHom(e.target.value)} />
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
