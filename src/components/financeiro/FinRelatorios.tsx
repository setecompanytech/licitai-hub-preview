import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Loader2, Download, BarChart3, Receipt, TrendingUp, Users } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function FinRelatorios() {
  const { empresaAtiva } = useEmpresa();
  const [loading, setLoading] = useState(false);
  const [dreData, setDreData] = useState<any[]>([]);
  const [nfData, setNfData] = useState<any[]>([]);
  const [fluxoData, setFluxoData] = useState<any[]>([]);
  const [comData, setComData] = useState<any[]>([]);

  async function loadDre() {
    setLoading(true);
    const { data } = await supabase.from('fin_lancamentos')
      .select('data_competencia, tipo, valor, status')
      .eq('empresa_id', empresaAtiva!.id)
      .in('status', ['pago', 'conciliado'])
      .order('data_competencia', { ascending: false });

    // Agrupar por mês
    const meses: Record<string, { receitas: number; despesas: number }> = {};
    (data ?? []).forEach(l => {
      const mes = l.data_competencia.substring(0, 7);
      if (!meses[mes]) meses[mes] = { receitas: 0, despesas: 0 };
      if (l.tipo === 'entrada') meses[mes].receitas += Number(l.valor);
      else if (l.tipo === 'saida') meses[mes].despesas += Number(l.valor);
    });
    setDreData(Object.entries(meses).map(([mes, v]) => ({ mes, ...v, resultado: v.receitas - v.despesas })));
    setLoading(false);
  }

  async function loadNf() {
    setLoading(true);
    const { data } = await supabase.from('fin_notas_fiscais')
      .select('numero_nf, nome_emitente, cnpj_emitente, valor_total, data_emissao, status_sefaz, manifesto')
      .eq('empresa_id', empresaAtiva!.id)
      .order('data_emissao', { ascending: false }).limit(100);
    setNfData(data ?? []);
    setLoading(false);
  }

  async function loadFluxo() {
    setLoading(true);
    const { data } = await supabase.from('fin_lancamentos')
      .select('descricao, tipo, valor, data_competencia, status')
      .eq('empresa_id', empresaAtiva!.id)
      .eq('status', 'pendente')
      .gte('data_competencia', new Date().toISOString().split('T')[0])
      .order('data_competencia').limit(50);
    setFluxoData(data ?? []);
    setLoading(false);
  }

  async function loadCom() {
    setLoading(true);
    const { data } = await supabase.from('fin_comissoes')
      .select('*')
      .eq('empresa_id', empresaAtiva!.id)
      .order('data_competencia', { ascending: false }).limit(100);
    setComData(data ?? []);
    setLoading(false);
  }

  function exportCsv(headers: string[], rows: any[][], filename: string) {
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado.');
  }

  return (
    <Tabs defaultValue="dre" className="space-y-4" onValueChange={v => {
      if (v === 'dre' && dreData.length === 0) loadDre();
      if (v === 'nf' && nfData.length === 0) loadNf();
      if (v === 'fluxo' && fluxoData.length === 0) loadFluxo();
      if (v === 'comissoes' && comData.length === 0) loadCom();
    }}>
      <TabsList className="flex-wrap">
        <TabsTrigger value="dre"><BarChart3 className="w-3.5 h-3.5 mr-1" /> DRE Mensal</TabsTrigger>
        <TabsTrigger value="nf"><Receipt className="w-3.5 h-3.5 mr-1" /> Extrato NF-e</TabsTrigger>
        <TabsTrigger value="fluxo"><TrendingUp className="w-3.5 h-3.5 mr-1" /> Fluxo Projetado</TabsTrigger>
        <TabsTrigger value="comissoes"><Users className="w-3.5 h-3.5 mr-1" /> Comissões</TabsTrigger>
      </TabsList>

      {/* DRE */}
      <TabsContent value="dre">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">DRE Mensal Resumida</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={loadDre}><Loader2 className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} /> Atualizar</Button>
              <Button size="sm" variant="outline" onClick={() => exportCsv(
                ['Mês', 'Receitas', 'Despesas', 'Resultado'],
                dreData.map(d => [d.mes, d.receitas.toFixed(2), d.despesas.toFixed(2), d.resultado.toFixed(2)]),
                'dre_mensal.csv'
              )}><Download className="w-3 h-3 mr-1" /> CSV</Button>
            </div>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-xs">Mês</TableHead>
              <TableHead className="text-xs text-right">Receitas</TableHead>
              <TableHead className="text-xs text-right">Despesas</TableHead>
              <TableHead className="text-xs text-right">Resultado</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {dreData.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Carregue os dados clicando em Atualizar</TableCell></TableRow>
              ) : dreData.map(d => (
                <TableRow key={d.mes}>
                  <TableCell className="text-xs font-mono">{d.mes}</TableCell>
                  <TableCell className="text-xs text-right font-mono text-success">{fmt(d.receitas)}</TableCell>
                  <TableCell className="text-xs text-right font-mono text-destructive">{fmt(d.despesas)}</TableCell>
                  <TableCell className={`text-xs text-right font-mono font-bold ${d.resultado >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(d.resultado)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      {/* NF-e */}
      <TabsContent value="nf">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Extrato de Notas Fiscais</h3>
            <Button size="sm" variant="outline" onClick={() => exportCsv(
              ['Número', 'Emitente', 'CNPJ', 'Valor', 'Emissão', 'Status', 'Manifesto'],
              nfData.map(n => [n.numero_nf, n.nome_emitente, n.cnpj_emitente, n.valor_total, n.data_emissao, n.status_sefaz, n.manifesto || '']),
              'extrato_nfe.csv'
            )}><Download className="w-3 h-3 mr-1" /> CSV</Button>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-xs">Nº</TableHead>
              <TableHead className="text-xs">Emitente</TableHead>
              <TableHead className="text-xs text-right">Valor</TableHead>
              <TableHead className="text-xs">Emissão</TableHead>
              <TableHead className="text-xs text-center">Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {nfData.map((n, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs font-mono">{n.numero_nf}</TableCell>
                  <TableCell className="text-xs">{n.nome_emitente}</TableCell>
                  <TableCell className="text-xs text-right font-mono">{fmt(n.valor_total ?? 0)}</TableCell>
                  <TableCell className="text-xs">{n.data_emissao ? new Date(n.data_emissao + 'T00:00:00').toLocaleDateString('pt-BR') : ''}</TableCell>
                  <TableCell className="text-center"><Badge variant="outline" className="text-[10px]">{n.status_sefaz}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      {/* Fluxo Projetado */}
      <TabsContent value="fluxo">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Fluxo Projetado (Pendentes Futuros)</h3>
            <Button size="sm" variant="outline" onClick={() => exportCsv(
              ['Data', 'Descrição', 'Tipo', 'Valor'],
              fluxoData.map(l => [l.data_competencia, l.descricao, l.tipo, l.valor]),
              'fluxo_projetado.csv'
            )}><Download className="w-3 h-3 mr-1" /> CSV</Button>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-xs">Data</TableHead>
              <TableHead className="text-xs">Descrição</TableHead>
              <TableHead className="text-xs">Tipo</TableHead>
              <TableHead className="text-xs text-right">Valor</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {fluxoData.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum lançamento futuro pendente</TableCell></TableRow>
              ) : fluxoData.map((l, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs font-mono">{new Date(l.data_competencia + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="text-xs">{l.descricao}</TableCell>
                  <TableCell><Badge variant="outline" className={`text-[10px] ${l.tipo === 'entrada' ? 'text-success' : 'text-destructive'}`}>{l.tipo}</Badge></TableCell>
                  <TableCell className={`text-xs text-right font-mono font-bold ${l.tipo === 'entrada' ? 'text-success' : 'text-destructive'}`}>{fmt(Number(l.valor))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      {/* Comissões */}
      <TabsContent value="comissoes">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Relatório de Comissões</h3>
            <Button size="sm" variant="outline" onClick={() => exportCsv(
              ['Comissionado', 'Origem', 'Base', '%', 'Comissão', 'Status', 'Data'],
              comData.map(c => [c.nome_comissionado, c.tipo_origem, c.valor_base, c.percentual, c.valor_comissao, c.status, c.data_competencia]),
              'relatorio_comissoes.csv'
            )}><Download className="w-3 h-3 mr-1" /> CSV</Button>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-xs">Comissionado</TableHead>
              <TableHead className="text-xs text-right">Base</TableHead>
              <TableHead className="text-xs text-center">%</TableHead>
              <TableHead className="text-xs text-right">Comissão</TableHead>
              <TableHead className="text-xs text-center">Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {comData.map((c, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs font-medium">{c.nome_comissionado}</TableCell>
                  <TableCell className="text-xs text-right font-mono">{c.valor_base ? fmt(c.valor_base) : '—'}</TableCell>
                  <TableCell className="text-xs text-center">{c.percentual ? `${c.percentual}%` : '—'}</TableCell>
                  <TableCell className="text-xs text-right font-mono font-bold">{fmt(c.valor_comissao)}</TableCell>
                  <TableCell className="text-center"><Badge variant="outline" className={`text-[10px] ${c.status === 'pago' ? 'text-success' : 'text-warning'}`}>{c.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
