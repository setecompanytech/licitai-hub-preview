import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Building2, Download, Upload, Search, Loader2, RefreshCw,
  TrendingUp, TrendingDown, ExternalLink, FileSpreadsheet, Trash2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

type EmpenhoData = {
  id?: string;
  orgao: string;
  ano: number;
  valor_total: number;
  quantidade_empenhos: number;
  categoria?: string;
  fonte_recurso?: string;
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

export default function TransparenciaPA() {
  const [dados, setDados] = useState<EmpenhoData[]>([]);
  const [anoFiltro, setAnoFiltro] = useState<string>('todos');
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);

  const loadDados = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('transparencia_empenhos')
        .select('*')
        .eq('user_id', user.id)
        .order('valor_total', { ascending: false });

      if (anoFiltro !== 'todos') {
        query = query.eq('ano', parseInt(anoFiltro));
      }

      const { data, error } = await query;
      if (error) throw error;
      setDados(data || []);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [anoFiltro]);

  useEffect(() => { loadDados(); }, [loadDados]);

  const handleScrape = async () => {
    setScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-transparencia-pa', {
        body: { ano: anoFiltro !== 'todos' ? parseInt(anoFiltro) : currentYear },
      });

      if (error) throw error;

      if (data?.fallback) {
        toast.info('Portal com carregamento lento. Use a importação de planilha abaixo.', { duration: 6000 });
      } else if (data?.success && data?.data?.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const rows = data.data.map((d: any) => ({
          user_id: user.id,
          orgao: d.orgao,
          ano: anoFiltro !== 'todos' ? parseInt(anoFiltro) : currentYear,
          valor_total: d.valor,
          quantidade_empenhos: d.quantidade || 1,
        }));

        const { error: insertError } = await supabase.from('transparencia_empenhos').insert(rows);
        if (insertError) throw insertError;

        toast.success(`${rows.length} órgãos importados com sucesso!`);
        loadDados();
      } else {
        toast.info('Nenhum dado extraído. Tente importar uma planilha do portal.', { duration: 5000 });
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao acessar portal');
    } finally {
      setScraping(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

      if (jsonData.length === 0) {
        toast.error('Planilha vazia');
        return;
      }

      // Map columns flexibly
      const rows: EmpenhoData[] = jsonData.map((row) => {
        const orgao = row['Órgão'] || row['ORGAO'] || row['orgao'] || row['Unidade'] || row['UNIDADE'] || Object.values(row)[0] || 'Não identificado';
        const valorStr = String(row['Valor'] || row['VALOR'] || row['valor_total'] || row['Valor Total'] || row['VALOR TOTAL'] || Object.values(row)[1] || '0');
        const valor = parseFloat(valorStr.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
        const qtd = parseInt(String(row['Quantidade'] || row['QTD'] || row['quantidade'] || '1')) || 1;
        const ano = parseInt(String(row['Ano'] || row['ANO'] || row['ano'] || currentYear));
        const categoria = row['Categoria'] || row['CATEGORIA'] || row['Elemento'] || null;

        return { orgao: String(orgao).trim(), ano, valor_total: valor, quantidade_empenhos: qtd, categoria };
      }).filter(r => r.valor_total > 0);

      if (rows.length === 0) {
        toast.error('Nenhum dado válido encontrado na planilha');
        return;
      }

      const insertRows = rows.map(r => ({ ...r, user_id: user.id }));
      const { error } = await supabase.from('transparencia_empenhos').insert(insertRows);
      if (error) throw error;

      toast.success(`${rows.length} registros importados com sucesso!`);
      loadDados();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao importar planilha');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleLimparDados = async () => {
    if (!confirm('Tem certeza que deseja limpar todos os dados importados?')) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from('transparencia_empenhos').delete().eq('user_id', user.id);
      if (error) throw error;
      toast.success('Dados removidos');
      loadDados();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleExportCSV = () => {
    if (dadosFiltrados.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(dadosFiltrados.map(d => ({
      'Órgão': d.orgao,
      'Ano': d.ano,
      'Valor Total (R$)': d.valor_total,
      'Qtd Empenhos': d.quantidade_empenhos,
      'Categoria': d.categoria || '',
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transparência PA');
    XLSX.writeFile(wb, `transparencia-pa-${anoFiltro}.xlsx`);
  };

  const dadosFiltrados = dados.filter(d => !busca || d.orgao.toLowerCase().includes(busca.toLowerCase()));

  // Aggregate for charts - top 10 by value
  const top10 = [...dadosFiltrados]
    .sort((a, b) => b.valor_total - a.valor_total)
    .slice(0, 10);

  // Aggregate by year
  const porAno = anos.map(ano => {
    const doAno = dados.filter(d => d.ano === ano);
    return {
      ano: String(ano),
      valor: doAno.reduce((s, d) => s + d.valor_total, 0),
      qtd: doAno.reduce((s, d) => s + d.quantidade_empenhos, 0),
    };
  }).reverse();

  const totalGeral = dados.reduce((s, d) => s + d.valor_total, 0);
  const totalEmpenhos = dados.reduce((s, d) => s + d.quantidade_empenhos, 0);
  const orgaosUnicos = new Set(dados.map(d => d.orgao)).size;

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={anoFiltro} onValueChange={setAnoFiltro}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os anos</SelectItem>
            {anos.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={handleScrape} disabled={scraping}>
          {scraping ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
          Extrair do Portal
        </Button>

        <label className="cursor-pointer">
          <Button variant="outline" size="sm" asChild>
            <span>
              <Upload className="w-4 h-4 mr-1" /> Importar Planilha
            </span>
          </Button>
          <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
        </label>

        <a href="https://www.sistemas.pa.gov.br/portaltransparencia/empenho/notas" target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm">
            <ExternalLink className="w-4 h-4 mr-1" /> Abrir Portal
          </Button>
        </a>

        {dados.length > 0 && (
          <>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="w-4 h-4 mr-1" /> Exportar
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLimparDados} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-1" /> Limpar
            </Button>
          </>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-accent" />
            <span className="text-xs text-muted-foreground">Órgãos</span>
          </div>
          <p className="text-2xl font-bold">{orgaosUnicos}</p>
          <span className="text-xs text-muted-foreground">identificados</span>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <FileSpreadsheet className="w-4 h-4 text-accent" />
            <span className="text-xs text-muted-foreground">Total Empenhos</span>
          </div>
          <p className="text-2xl font-bold">{totalEmpenhos.toLocaleString('pt-BR')}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-accent" />
            <span className="text-xs text-muted-foreground">Volume Total</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(totalGeral)}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-accent" />
            <span className="text-xs text-muted-foreground">Ticket Médio</span>
          </div>
          <p className="text-2xl font-bold">{totalEmpenhos > 0 ? formatCurrency(totalGeral / totalEmpenhos) : 'R$ 0'}</p>
        </div>
      </div>

      {dados.length === 0 ? (
        <Card className="p-8 text-center">
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="font-semibold mb-2">Nenhum dado importado</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Clique em <strong>"Extrair do Portal"</strong> para tentar coletar automaticamente, 
            ou <strong>"Importar Planilha"</strong> para enviar uma planilha baixada do Portal de Transparência do Pará.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span>Formatos aceitos: .xlsx, .xls, .csv</span>
            <span>•</span>
            <span>Colunas esperadas: Órgão, Valor, Ano, Quantidade</span>
          </div>
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
                  <YAxis type="category" dataKey="orgao" tick={{ fontSize: 9 }} width={160} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="valor_total" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-4">Distribuição por Órgão (Top 8)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={top10.slice(0, 8).map(d => ({ name: d.orgao.substring(0, 30), value: d.valor_total }))}
                    cx="50%" cy="50%" outerRadius={100} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {top10.slice(0, 8).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            {porAno.some(a => a.valor > 0) && (
              <Card className="p-5 lg:col-span-2">
                <h3 className="text-sm font-semibold mb-4">Evolução Anual do Volume de Empenhos</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={porAno.filter(a => a.valor > 0)}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="ano" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="valor" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Volume (R$)" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
          </div>

          {/* Table */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Ranking de Órgãos</h3>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar órgão..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-10 h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {dadosFiltrados.map((d, i) => (
                <div key={d.id || i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-accent w-8 text-center">{i + 1}º</span>
                    <div>
                      <p className="text-sm font-medium">{d.orgao}</p>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-[10px]">{d.ano}</Badge>
                        {d.categoria && <Badge variant="secondary" className="text-[10px]">{d.categoria}</Badge>}
                        <span className="text-[10px] text-muted-foreground">{d.quantidade_empenhos} empenhos</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(d.valor_total)}</p>
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
