import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Building2, Download, Search, Loader2, RefreshCw,
  TrendingUp, ExternalLink, FileText, Trash2, FileSpreadsheet
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { writeExcelFromJson } from '@/lib/excel-utils';

type ContratoData = {
  id?: string;
  orgao: string;
  tipo: string;
  descricao?: string;
  valor_total: number;
  quantidade_itens: number;
  modalidade?: string;
  situacao?: string;
  ano: number;
};

const COLORS = ['hsl(var(--accent))', 'hsl(var(--info))', 'hsl(var(--warning))', 'hsl(var(--success))', 'hsl(var(--destructive))', '#8b5cf6', '#ec4899', '#06b6d4'];

const formatCurrency = (v: number) => {
  if (v >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return `R$ ${v.toFixed(0)}`;
};

const currentYear = new Date().getFullYear();
const anos = Array.from({ length: 5 }, (_, i) => currentYear - i);

const TIPOS = [
  { value: 'arp', label: 'Atas de Registro de Preços' },
  { value: 'contrato', label: 'Contratos' },
  { value: 'compra', label: 'Compras' },
];

export default function ContratosGov() {
  const [dados, setDados] = useState<ContratoData[]>([]);
  const [anoFiltro, setAnoFiltro] = useState<string>(String(currentYear));
  const [tipoFiltro, setTipoFiltro] = useState<string>('arp');
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const loadDados = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = (supabase.from('contratos_gov') as any)
        .select('*')
        .eq('user_id', user.id)
        .order('valor_total', { ascending: false });

      if (anoFiltro !== 'todos') query = query.eq('ano', parseInt(anoFiltro));
      if (tipoFiltro !== 'todos') query = query.eq('tipo', tipoFiltro);

      const { data, error } = await query;
      if (error) throw error;
      setDados(data || []);
    } catch (e: any) {
      toast.error('Não foi possível carregar os dados de contratos', {
        description: e.message || 'Verifique sua conexão e tente recarregar a página.',
        duration: 6000,
      });
    } finally {
      setLoading(false);
    }
  }, [anoFiltro, tipoFiltro]);

  useEffect(() => { loadDados(); }, [loadDados]);

  const handleExtract = async () => {
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-contratos-gov', {
        body: {
          ano: anoFiltro !== 'todos' ? parseInt(anoFiltro) : currentYear,
          tipo: tipoFiltro !== 'todos' ? tipoFiltro : 'arp',
        },
      });

      if (error) throw error;

      if (data?.success && data?.data?.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const selectedYear = anoFiltro !== 'todos' ? parseInt(anoFiltro) : currentYear;
        const selectedType = tipoFiltro !== 'todos' ? tipoFiltro : 'arp';

        const rows = data.data.map((d: any) => ({
          user_id: user.id,
          orgao: d.orgao,
          tipo: selectedType,
          descricao: d.descricao || null,
          valor_total: d.valor,
          quantidade_itens: d.quantidade || 1,
          modalidade: d.modalidade || null,
          situacao: d.situacao || 'vigente',
          ano: selectedYear,
        }));

        const { error: insertError } = await (supabase.from('contratos_gov') as any).insert(rows);
        if (insertError) throw insertError;

        toast.success(`${rows.length} órgãos importados via IA (estimativas baseadas em dados públicos)`);
        loadDados();
      } else {
        toast.error('Nenhum dado extraído pela IA', {
          description: data?.error || 'Não foram encontrados contratos para os filtros selecionados. Tente outro ano ou tipo.',
          duration: 7000,
        });
      }
    } catch (e: any) {
      toast.error('Falha ao importar dados de contratos', {
        description: e.message || 'Verifique sua conexão e tente novamente.',
        duration: 6000,
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleLimpar = async () => {
    if (!confirm('Tem certeza que deseja limpar todos os dados de Contratos Gov?')) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await (supabase.from('contratos_gov') as any).delete().eq('user_id', user.id);
      if (error) throw error;
      toast.success('Dados removidos');
      loadDados();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleExport = async () => {
    if (dadosFiltrados.length === 0) return;
    await writeExcelFromJson(`contratos-gov-${anoFiltro}-${tipoFiltro}.xlsx`, 'Contratos Gov',
      dadosFiltrados.map(d => ({
        'Órgão': d.orgao,
        'Tipo': d.tipo,
        'Ano': d.ano,
        'Valor Total (R$)': d.valor_total,
        'Qtd Itens': d.quantidade_itens,
        'Modalidade': d.modalidade || '',
        'Situação': d.situacao || '',
        'Descrição': d.descricao || '',
      }))
    );
  };

  const dadosFiltrados = dados.filter(d => !busca || d.orgao.toLowerCase().includes(busca.toLowerCase()));

  const top10 = [...dadosFiltrados].sort((a, b) => b.valor_total - a.valor_total).slice(0, 10);

  const porModalidade = Object.entries(
    dadosFiltrados.reduce((acc, d) => {
      const key = d.modalidade || 'Outros';
      acc[key] = (acc[key] || 0) + d.valor_total;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);

  const totalGeral = dados.reduce((s, d) => s + d.valor_total, 0);
  const totalItens = dados.reduce((s, d) => s + d.quantidade_itens, 0);
  const orgaosUnicos = new Set(dados.map(d => d.orgao)).size;
  const tipoLabel = TIPOS.find(t => t.value === tipoFiltro)?.label || 'Registros';

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={anoFiltro} onValueChange={setAnoFiltro}>
          <SelectTrigger className="w-32 h-8 text-sm">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {anos.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
          <SelectTrigger className="w-52 h-8 text-sm">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={handleExtract} disabled={extracting}>
          {extracting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
          Extrair via IA
        </Button>

        <a href="https://contratos.sistema.gov.br/transparencia" target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm">
            <ExternalLink className="w-4 h-4 mr-1" /> Abrir Portal
          </Button>
        </a>

        {dados.length > 0 && (
          <>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-1" /> Exportar
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLimpar} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-1" /> Limpar
            </Button>
          </>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Órgãos</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold">{orgaosUnicos}</p>
          <span className="text-xs text-muted-foreground">identificados</span>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total {tipoLabel}</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold">{totalItens.toLocaleString('pt-BR')}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Volume Total</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold">{formatCurrency(totalGeral)}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Ticket Médio</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold">{totalItens > 0 ? formatCurrency(totalGeral / totalItens) : 'R$ 0'}</p>
        </div>
      </div>

      {dados.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold mb-2">Nenhum dado importado</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Clique em <strong>"Extrair via IA"</strong> para obter estimativas de contratos e atas de registro de preços do Governo Federal via inteligência artificial.
          </p>
          <p className="text-xs text-muted-foreground">
            Fonte: <a href="https://contratos.sistema.gov.br/transparencia" target="_blank" rel="noopener noreferrer" className="text-accent underline">contratos.sistema.gov.br</a>
          </p>
        </Card>
      ) : (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-4">Top 10 Órgãos por Volume (R$)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={top10} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="orgao" tick={{ fontSize: 9 }} width={180} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="valor_total" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-4">Distribuição por Modalidade</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={porModalidade}
                    cx="50%" cy="50%" outerRadius={100} dataKey="value"
                    label={({ name, percent }) => `${name?.substring(0, 20)} ${(percent * 100).toFixed(0)}%`}
                  >
                    {porModalidade.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Table */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Ranking de Órgãos Federais</h3>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar órgão..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-10 h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {dadosFiltrados.map((d, i) => (
                <div key={d.id || i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-foreground w-8 text-center">{i + 1}º</span>
                    <div>
                      <p className="text-sm font-medium">{d.orgao}</p>
                      <div className="flex flex-wrap gap-1.5 mt-0.5">
                        <Badge variant="outline" className="text-xs">{d.ano}</Badge>
                        <Badge variant="secondary" className="text-xs">{TIPOS.find(t => t.value === d.tipo)?.label || d.tipo}</Badge>
                        {d.modalidade && <Badge variant="outline" className="text-xs">{d.modalidade}</Badge>}
                        <span className="text-xs text-muted-foreground">{d.quantidade_itens} itens</span>
                      </div>
                      {d.descricao && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{d.descricao}</p>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{formatCurrency(d.valor_total)}</p>
                    <Badge variant={d.situacao === 'vigente' ? 'default' : 'secondary'} className="text-xs">
                      {d.situacao}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
