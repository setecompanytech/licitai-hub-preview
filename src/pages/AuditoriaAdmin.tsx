import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Shield, Search, RefreshCw, Loader2, Filter, Download, FileText, ShieldCheck, Activity, Lock, AlertTriangle } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { useEmpresa } from '@/contexts/EmpresaContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type Fonte = 'lgpd' | 'colaborador' | 'lances' | 'financeiro';

type RowUnif = {
  id: string;
  fonte: Fonte;
  data: string;
  acao: string;
  user_id: string;
  modulo?: string | null;
  detalhes: any;
  ip?: string | null;
};

const FONTE_META: Record<Fonte, { label: string; icon: typeof Shield; cor: string; tabela: string }> = {
  lgpd:        { label: 'LGPD (Art. 37)',     icon: Lock,        cor: 'text-muted-foreground', tabela: 'lgpd_tratamento_log' },
  colaborador: { label: 'Atividades equipe',  icon: Activity,    cor: 'text-info',        tabela: 'atividades_colaborador' },
  lances:      { label: 'Lances (chained)',   icon: ShieldCheck, cor: 'text-success',     tabela: 'audit_log_lances' },
  financeiro:  { label: 'Financeiro',         icon: FileText,    cor: 'text-warning',     tabela: 'financeiro_audit_log' },
};

export default function AuditoriaAdmin() {
  const { empresaAtiva } = useEmpresa();
  const [tab, setTab] = useState<Fonte>('lgpd');
  const [rows, setRows] = useState<RowUnif[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [periodoFilter, setPeriodoFilter] = useState('30d');
  const [operacaoFilter, setOperacaoFilter] = useState('todos');

  const sinceISO = useMemo(() => {
    if (periodoFilter === 'todos') return null;
    const days = periodoFilter === '1d' ? 1 : periodoFilter === '7d' ? 7 : periodoFilter === '30d' ? 30 : periodoFilter === '90d' ? 90 : 365;
    const d = new Date(); d.setDate(d.getDate() - days);
    return d.toISOString();
  }, [periodoFilter]);

  const fetchRows = async () => {
    setLoading(true);
    const tabela = FONTE_META[tab].tabela;
    let q: any = (supabase.from(tabela as any) as any).select('*').order('created_at', { ascending: false }).limit(500);
    if (sinceISO) q = q.gte('created_at', sinceISO);
    if (tab === 'lgpd' && empresaAtiva?.id) q = q.eq('empresa_id', empresaAtiva.id);
    if (tab === 'colaborador' && empresaAtiva?.id) q = q.eq('empresa_id', empresaAtiva.id);
    if (tab === 'financeiro' && empresaAtiva?.id) q = q.eq('empresa_id', empresaAtiva.id);
    if (operacaoFilter !== 'todos') {
      if (tab === 'lgpd') q = q.eq('operacao', operacaoFilter);
      else if (tab === 'colaborador') q = q.eq('acao', operacaoFilter);
      else if (tab === 'lances') q = q.eq('evento', operacaoFilter);
      else if (tab === 'financeiro') q = q.eq('operacao', operacaoFilter);
    }
    const { data } = await q;
    const mapped: RowUnif[] = (data || []).map((r: any) => {
      if (tab === 'lgpd') return {
        id: r.id, fonte: 'lgpd', data: r.created_at, acao: r.operacao,
        user_id: r.user_id, modulo: r.modulo,
        detalhes: { categoria: r.categoria_dados, finalidade: r.finalidade, base: r.base_legal, titular: r.titular_id, descricao: r.descricao, ...r.metadata },
        ip: r.ip_address,
      };
      if (tab === 'colaborador') return {
        id: r.id, fonte: 'colaborador', data: r.created_at, acao: r.acao,
        user_id: r.user_id, modulo: r.modulo, detalhes: { descricao: r.descricao, ...r.metadata }, ip: null,
      };
      if (tab === 'lances') return {
        id: r.id, fonte: 'lances', data: r.created_at, acao: r.evento,
        user_id: r.user_id, modulo: 'robo_lances',
        detalhes: { ...r.detalhes, valor: r.valor_lance, rodada: r.rodada, hash: r.hash_registro?.slice(0, 16) },
        ip: r.ip_address,
      };
      return {
        id: r.id, fonte: 'financeiro', data: r.created_at, acao: r.operacao,
        user_id: r.usuario_id, modulo: r.tabela,
        detalhes: { antes: r.dados_antes, depois: r.dados_depois }, ip: null,
      };
    });
    setRows(mapped);
    setLoading(false);
  };

  useEffect(() => { fetchRows(); /* eslint-disable-next-line */ }, [tab, periodoFilter, operacaoFilter, empresaAtiva?.id]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const s = search.toLowerCase();
    return rows.filter(r =>
      r.acao.toLowerCase().includes(s)
      || (r.user_id || '').toLowerCase().includes(s)
      || (r.modulo || '').toLowerCase().includes(s)
      || JSON.stringify(r.detalhes).toLowerCase().includes(s)
    );
  }, [rows, search]);

  const handleExportCSV = () => {
    const header = 'Fonte;Data;Ação;Módulo;Usuário;IP;Detalhes';
    const lines = filtered.map(r =>
      [r.fonte, r.data, r.acao, r.modulo || '', r.user_id, r.ip || '',
       JSON.stringify(r.detalhes).replace(/[\r\n;]/g, ' ')].join(';')
    );
    const csv = '\uFEFF' + [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `auditoria-${tab}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
    pdf.setFontSize(14);
    pdf.text(`PRAEFECTUS — Trilha de Auditoria (${FONTE_META[tab].label})`, 14, 14);
    pdf.setFontSize(9);
    pdf.text(
      `Empresa: ${empresaAtiva?.razao_social || '—'}  |  Período: ${periodoFilter}  |  Gerado em ${new Date().toLocaleString('pt-BR')}  |  ${filtered.length} registros`,
      14, 20,
    );
    autoTable(pdf, {
      startY: 26,
      head: [['Data', 'Ação', 'Módulo', 'Usuário', 'Detalhes']],
      body: filtered.slice(0, 1000).map(r => [
        new Date(r.data).toLocaleString('pt-BR'),
        r.acao,
        r.modulo || '—',
        r.user_id.slice(0, 8) + '...',
        JSON.stringify(r.detalhes).slice(0, 120),
      ]),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [15, 23, 42] },
      columnStyles: { 4: { cellWidth: 130 } },
    });
    pdf.setFontSize(8);
    const totalPages = (pdf as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.text(
        `Documento de auditoria interna — Lei nº 13.709/2018 (LGPD) — Retenção de 5 anos — Página ${i}/${totalPages}`,
        14, pdf.internal.pageSize.height - 8,
      );
    }
    pdf.save(`auditoria-${tab}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const operacoesFiltro: Record<Fonte, { value: string; label: string }[]> = {
    lgpd: [
      { value: 'todos', label: 'Todas operações' },
      { value: 'acesso', label: 'Acesso' },
      { value: 'exportacao', label: 'Exportação' },
      { value: 'exclusao', label: 'Exclusão' },
      { value: 'anonimizacao', label: 'Anonimização' },
      { value: 'retificacao', label: 'Retificação' },
      { value: 'compartilhamento', label: 'Compartilhamento' },
      { value: 'coleta', label: 'Coleta' },
    ],
    colaborador: [{ value: 'todos', label: 'Todas ações' }],
    lances: [
      { value: 'todos', label: 'Todos eventos' },
      { value: 'lance_enviado', label: 'Lance enviado' },
      { value: 'sessao_iniciada', label: 'Sessão iniciada' },
      { value: 'parada_emergencial', label: 'Kill switch' },
    ],
    financeiro: [
      { value: 'todos', label: 'Todas operações' },
      { value: 'INSERT', label: 'Inserção' },
      { value: 'UPDATE', label: 'Alteração' },
      { value: 'DELETE', label: 'Exclusão' },
    ],
  };

  const stats = useMemo(() => ({
    total: filtered.length,
    eventosUnicos: new Set(filtered.map(r => r.acao)).size,
    usuariosUnicos: new Set(filtered.map(r => r.user_id)).size,
    ultimas24h: filtered.filter(r => new Date(r.data) > new Date(Date.now() - 86400000)).length,
  }), [filtered]);

  return (
    <AppLayout>
      <Helmet><title>Auditoria & Compliance LGPD | PRAEFECTUS</title></Helmet>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-muted-foreground" />
              Auditoria & Compliance LGPD
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Trilha unificada de tratamento de dados pessoais (Art. 37 LGPD), atividades de equipe, lances e financeiro. Retenção de 5 anos.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={filtered.length === 0}>
              <Download className="w-4 h-4 mr-1" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={filtered.length === 0}>
              <FileText className="w-4 h-4 mr-1" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={fetchRows}>
              <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
            </Button>
          </div>
        </div>

        <div className="bg-warning/5 border border-warning/20 rounded-lg p-3 flex items-start gap-2 text-xs">
          <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Política de retenção</p>
            <p className="text-muted-foreground">
              Registros com mais de 5 anos são automaticamente expurgados (rotina diária às 03h). Exporte periodicamente para arquivamento de longo prazo.
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Fonte)}>
          <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full">
            {(Object.keys(FONTE_META) as Fonte[]).map((k) => {
              const M = FONTE_META[k];
              const Icon = M.icon;
              return (
                <TabsTrigger key={k} value={k} className="text-xs">
                  <Icon className={`w-3.5 h-3.5 mr-1.5 ${M.cor}`} />
                  <span className="truncate">{M.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value={tab} className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar ação, usuário, módulo, detalhes..."
                    className="pl-10" maxLength={120} />
                </div>
              </div>
              <div className="w-48">
                <Select value={operacaoFilter} onValueChange={setOperacaoFilter}>
                  <SelectTrigger><Filter className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {operacoesFiltro[tab].map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-32">
                <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1d">24 horas</SelectItem>
                    <SelectItem value="7d">7 dias</SelectItem>
                    <SelectItem value="30d">30 dias</SelectItem>
                    <SelectItem value="90d">90 dias</SelectItem>
                    <SelectItem value="365d">1 ano</SelectItem>
                    <SelectItem value="todos">Tudo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Registros', value: stats.total },
                { label: 'Ações distintas', value: stats.eventosUnicos },
                { label: 'Usuários', value: stats.usuariosUnicos },
                { label: 'Últimas 24h', value: stats.ultimas24h },
              ].map((s) => (
                <div key={s.label} className="bg-card border border-border rounded-lg p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-bold mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">
                <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum registro encontrado para os filtros selecionados.</p>
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs whitespace-nowrap">Data/Hora</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">Ação</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">Módulo</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">Usuário</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">IP</TableHead>
                      <TableHead className="text-xs">Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.slice(0, 200).map((r) => (
                      <TableRow key={`${r.fonte}-${r.id}`}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(r.data).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs whitespace-nowrap">{r.acao}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{r.modulo || '—'}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                          {r.user_id?.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{r.ip || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[400px] truncate" title={JSON.stringify(r.detalhes)}>
                          {JSON.stringify(r.detalhes).slice(0, 140)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filtered.length > 200 && (
                  <div className="text-xs text-muted-foreground text-center py-2 bg-muted/30 border-t border-border">
                    Exibindo 200 de {filtered.length} registros — exporte para visualizar todos.
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
