import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Building2, Download, Upload, Search, Loader2,
  TrendingUp, TrendingDown, ExternalLink, FileSpreadsheet, Trash2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { readExcelFile, writeExcelFromJson } from '@/lib/excel-utils';
import { TransparenciaPortal } from '@/data/transparencia-portais';

type EmpenhoData = {
  id?: string;
  orgao: string;
  ano: number;
  valor_total: number;
  quantidade_empenhos: number;
  categoria?: string;
  fonte_recurso?: string;
};

const COLORS = ['hsl(var(--accent))', 'hsl(var(--info))', 'hsl(var(--warning))', 'hsl(var(--success))', 'hsl(var(--destructive))', 'hsl(var(--chart-6))', 'hsl(var(--chart-7))', 'hsl(var(--chart-8))'];
const formatCurrency = (v: number) => {
  if (v >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return `R$ ${v.toFixed(0)}`;
};

const currentYear = new Date().getFullYear();
const anos = Array.from({ length: 5 }, (_, i) => currentYear - i);

type Props = {
  portal: TransparenciaPortal;
};

type NotaEmpenhoPA = {
  numero: string; dt_despesa: string; orgao: string; credor: string;
  id_ne: string; valor_empenhado: number; valor_pago: number;
  credor_cpf_cnpj?: string | null;
};

type TotaisCredorPA = {
  qtd_notas: number; valor_empenhado: number; valor_pago: number; saldo_a_pagar: number;
};

export default function TransparenciaPA({ portal }: Props) {
  const [dados, setDados] = useState<EmpenhoData[]>([]);
  const [anoFiltro, setAnoFiltro] = useState<string>('todos');
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  // ── API oficial do Pará (08/09) — só o PA tem; os demais seguem com
  // planilha + portal. Nada aqui é estimado: dados-abertos.sistemas.pa.gov.br
  const ehParaEstado = portal.tipo === 'estado' && portal.sigla === 'PA';
  const [extraindo, setExtraindo] = useState(false);
  const [credor, setCredor] = useState('');
  const [anoCredor, setAnoCredor] = useState(String(currentYear));
  const [buscandoCredor, setBuscandoCredor] = useState(false);
  const [achados, setAchados] = useState<NotaEmpenhoPA[]>([]);
  const [totaisCredor, setTotaisCredor] = useState<TotaisCredorPA | null>(null);
  const [paginaCredor, setPaginaCredor] = useState(1);
  const [buscouCredor, setBuscouCredor] = useState(false);

  const portalLabel = portal.tipo === 'estado'
    ? `Estado: ${portal.nome} (${portal.sigla})`
    : `Capital: ${portal.nome} (${portal.sigla})`;

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

  /** Fase A: execução por órgão, da API oficial — um clique popula a aba. */
  const extrairDaApiOficial = async () => {
    setExtraindo(true);
    try {
      const ano = anoFiltro !== 'todos' ? parseInt(anoFiltro) : currentYear;
      const { data, error } = await supabase.functions.invoke('transparencia-pa-oficial', {
        body: { modo: 'despesas', ano },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      const linhas = (data?.data ?? []) as Array<{ orgao: string; valor: number; quantidade: number }>;
      if (linhas.length === 0) { toast.info('A API oficial não devolveu órgãos para este ano.'); return; }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Troca o ano inteiro: extração repetida atualiza em vez de duplicar.
      await supabase.from('transparencia_empenhos')
        .delete().eq('user_id', user.id).eq('ano', ano);
      const { error: insertError } = await supabase.from('transparencia_empenhos').insert(
        linhas.map((l) => ({
          user_id: user.id,
          orgao: l.orgao,
          ano,
          valor_total: l.valor,
          quantidade_empenhos: l.quantidade || 1,
        })),
      );
      if (insertError) throw insertError;
      toast.success(`${linhas.length} órgãos importados da API oficial do Pará (${ano}).`, {
        description: 'Valor = total EMPENHADO por órgão no ano, direto do portal de dados abertos.',
      });
      loadDados();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao consultar a API do Pará');
    } finally {
      setExtraindo(false);
    }
  };

  /** Fase B: busca de empenhos por nome/CNPJ/nº — a MESMA busca textual do
   *  portal (backend api-notas-empenho), com os totais que a tela dele
   *  mostra: notas, empenhado, pago e o saldo a pagar. Instantânea. */
  const buscarPorCredor = async (pagina = 1) => {
    setBuscandoCredor(true);
    if (pagina === 1) { setAchados([]); setTotaisCredor(null); }
    try {
      const { data, error } = await supabase.functions.invoke('transparencia-pa-oficial', {
        body: { modo: 'empenhos', ano: parseInt(anoCredor), credor: credor.trim(), pagina, qtdRegistros: 50 },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      setAchados((prev) => pagina === 1 ? (data.achados ?? []) : [...prev, ...(data.achados ?? [])]);
      if (data.totais) setTotaisCredor(data.totais as TotaisCredorPA);
      setPaginaCredor(pagina);
      setBuscouCredor(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha na busca');
    } finally {
      setBuscandoCredor(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const jsonData = await readExcelFile(file);

      if (jsonData.length === 0) {
        toast.error('Planilha vazia');
        return;
      }

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

  const dadosFiltrados = dados.filter(d => !busca || d.orgao.toLowerCase().includes(busca.toLowerCase()));

  const handleExportCSV = async () => {
    if (dadosFiltrados.length === 0) return;
    await writeExcelFromJson(`transparencia-${portal.sigla.toLowerCase()}-${anoFiltro}.xlsx`, `Transparência ${portal.nome}`,
      dadosFiltrados.map(d => ({
        'Órgão': d.orgao,
        'Ano': d.ano,
        'Valor Total (R$)': d.valor_total,
        'Qtd Empenhos': d.quantidade_empenhos,
        'Categoria': d.categoria || '',
      }))
    );
  };

  const top10 = [...dadosFiltrados]
    .sort((a, b) => b.valor_total - a.valor_total)
    .slice(0, 10);

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
  // A API oficial agrega por ÓRGÃO e não diz quantas notas há (o portal diz:
  // 256.868 em 2026) — a importação grava quantidade=1 por linha. Somar isso
  // e chamar de "Total Empenhos: 70" era mentira de rótulo (confronto de
  // 08/09). Quando NENHUMA linha tem contagem real, os cards dizem a verdade:
  // contagem não informada, e a média é POR ÓRGÃO, rotulada como tal.
  const contagemConhecida = dados.some(d => (d.quantidade_empenhos ?? 1) > 1);

  return (
    <div className="space-y-4">
      {/* Portal info */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="outline">{portalLabel}</Badge>
      </div>

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

        {/* O "Extrair do Portal" de IA foi aposentado (estimava números).
            Para o PARÁ ele renasceu de verdade: a API oficial de dados
            abertos do Estado. Para os demais portais, os caminhos honestos
            continuam sendo a planilha e o link. */}
        {ehParaEstado && (
          <Button variant="outline" size="sm" onClick={extrairDaApiOficial} disabled={extraindo}>
            {extraindo ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
            Extrair da API oficial
          </Button>
        )}

        <label className="cursor-pointer">
          <Button variant="outline" size="sm" asChild>
            <span>
              <Upload className="w-4 h-4 mr-1" /> Importar Planilha
            </span>
          </Button>
          <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
        </label>

        <a href={portal.url} target="_blank" rel="noopener noreferrer">
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

      {/* ── Fase B: empenhos por credor, a MESMA busca do portal (só PA) ──
          O caso de uso nº 1 é a empresa procurar A SI MESMA: os próprios
          empenhos estaduais, com empenhado, pago e o SALDO A RECEBER, sem
          depender do órgão avisar. Busca textual do backend do portal:
          nome, CNPJ ou número do empenho — instantânea, com os totais que a
          tela do portal exibe. */}
      {ehParaEstado && (
        <Card className="p-4 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <Search className="w-4 h-4 text-muted-foreground" /> Empenhos por credor — busca do portal do Pará
          </h4>
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="Nome, CNPJ ou nº do empenho (ex.: SANTA ROSA)" value={credor}
              onChange={(e) => setCredor(e.target.value)} className="w-80 h-9"
              onKeyDown={(e) => { if (e.key === 'Enter' && credor.trim().length >= 4) buscarPorCredor(1); }} />
            <Select value={anoCredor} onValueChange={setAnoCredor}>
              <SelectTrigger className="w-28 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {anos.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-9" disabled={buscandoCredor || credor.trim().length < 4}
              onClick={() => buscarPorCredor(1)}>
              {buscandoCredor ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />}
              Buscar
            </Button>
          </div>

          {totaisCredor && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-md border border-border/50 p-2.5">
                <p className="text-xs text-muted-foreground">Notas empenhadas</p>
                <p className="text-lg font-bold tabular-nums">{totaisCredor.qtd_notas.toLocaleString('pt-BR')}</p>
              </div>
              <div className="rounded-md border border-border/50 p-2.5">
                <p className="text-xs text-muted-foreground">Valor empenhado</p>
                <p className="text-lg font-bold tabular-nums">{formatCurrency(totaisCredor.valor_empenhado)}</p>
              </div>
              <div className="rounded-md border border-border/50 p-2.5">
                <p className="text-xs text-muted-foreground">Valor pago</p>
                <p className="text-lg font-bold tabular-nums text-success">{formatCurrency(totaisCredor.valor_pago)}</p>
              </div>
              <div className="rounded-md border border-border/50 p-2.5">
                <p className="text-xs text-muted-foreground">Saldo a pagar</p>
                <p className={`text-lg font-bold tabular-nums ${totaisCredor.saldo_a_pagar > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
                  {formatCurrency(totaisCredor.saldo_a_pagar)}
                </p>
              </div>
            </div>
          )}

          {buscouCredor && !buscandoCredor && achados.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhum empenho encontrado para “{credor.trim()}” em {anoCredor}.
            </p>
          )}

          {achados.length > 0 && (
            <div className="divide-y divide-border/40 max-h-[320px] overflow-y-auto rounded-md border border-border/40">
              {achados.map((n) => (
                <div key={n.id_ne} className="flex items-center justify-between gap-3 p-2.5 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium tabular-nums">{n.numero} · {n.orgao}</p>
                    <p className="text-muted-foreground truncate">
                      {n.credor}{n.credor_cpf_cnpj ? ` · ${n.credor_cpf_cnpj}` : ''} · {n.dt_despesa}
                    </p>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    <p className="font-semibold">{formatCurrency(n.valor_empenhado)}</p>
                    <p className={n.valor_pago > 0 ? 'text-success' : 'text-muted-foreground'}>
                      pago: {formatCurrency(n.valor_pago)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totaisCredor && achados.length > 0 && achados.length < totaisCredor.qtd_notas && !buscandoCredor && (
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => buscarPorCredor(paginaCredor + 1)}>
              Carregar mais ({achados.length} de {totaisCredor.qtd_notas})
            </Button>
          )}
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Órgãos</span>
          </div>
          <p className="text-2xl font-bold">{orgaosUnicos}</p>
          <span className="text-xs text-muted-foreground">identificados</span>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total Empenhos</span>
          </div>
          {contagemConhecida ? (
            <p className="text-2xl font-bold">{totalEmpenhos.toLocaleString('pt-BR')}</p>
          ) : (
            <>
              <p className="text-2xl font-bold text-muted-foreground">—</p>
              <span className="text-xs text-muted-foreground">a fonte agrega por órgão, sem contagem de notas</span>
            </>
          )}
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Volume Total (empenhado)</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(totalGeral)}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{contagemConhecida ? 'Ticket Médio' : 'Média por órgão'}</span>
          </div>
          {contagemConhecida ? (
            <p className="text-2xl font-bold">{totalEmpenhos > 0 ? formatCurrency(totalGeral / totalEmpenhos) : 'R$ 0'}</p>
          ) : (
            <p className="text-2xl font-bold">{orgaosUnicos > 0 ? formatCurrency(totalGeral / orgaosUnicos) : 'R$ 0'}</p>
          )}
        </div>
      </div>

      {dados.length === 0 ? (
        <Card className="p-8 text-center">
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold mb-2">Nenhum dado importado</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Abra o portal de {portal.nome} pelo botão <strong>"Abrir Portal"</strong>, baixe a planilha
            de empenhos/despesas e envie por <strong>"Importar Planilha"</strong> — os números aqui
            são sempre os do próprio portal, nunca estimativas.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span>Formatos aceitos: .xlsx, .xls, .csv</span>
            <span>•</span>
            <span>Colunas esperadas: Órgão, Valor, Ano, Quantidade</span>
          </div>
        </Card>
      ) : (
        <>
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
                    <span className="text-lg font-bold text-foreground w-8 text-center">{i + 1}º</span>
                    <div>
                      <p className="text-sm font-medium">{d.orgao}</p>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">{d.ano}</Badge>
                        {d.categoria && <Badge variant="secondary" className="text-xs">{d.categoria}</Badge>}
                        <span className="text-xs text-muted-foreground">{d.quantidade_empenhos} empenhos</span>
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
