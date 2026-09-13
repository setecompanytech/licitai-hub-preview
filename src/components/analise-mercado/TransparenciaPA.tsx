import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Building2, Download, Upload, Search, Loader2,
  TrendingUp, TrendingDown, ExternalLink, FileSpreadsheet, Trash2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { readExcelFile, writeExcelFromJson } from '@/lib/excel-utils';
import { downloadCSV, downloadPDF } from '@/lib/download-utils';
import { useEmpresa } from '@/contexts/EmpresaContext';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

/** Séries de gráfico — a exceção contida à regra de cor: os tokens `--chart-*`
 *  existem para isto, e recharts pinta por valor de cor, não por classe. */
const COLORS = [
  'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))',
  'hsl(var(--chart-5))', 'hsl(var(--chart-6))', 'hsl(var(--chart-7))', 'hsl(var(--chart-8))',
];
const formatCurrency = (v: number) => {
  if (v >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return `R$ ${v.toFixed(0)}`;
};

/** Dentro de um processo o número é EXATO, com centavos — "R$ 97K" serve
 *  para panorama, não para conferir um empenho (pedido de 08/09). */
const brlExato = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
  const { empresaAtiva } = useEmpresa();
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

  /** Fase A: execução por órgão, da API oficial — um clique popula a aba.
   *  "Todos os anos" varre os 5 anos do seletor, um a um: antes, caía em
   *  silêncio no ano corrente e o filtro mentia (08/09). */
  const extrairDaApiOficial = async () => {
    setExtraindo(true);
    try {
      const anosAlvo = anoFiltro !== 'todos' ? [parseInt(anoFiltro)] : anos;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let totalOrgaos = 0;
      const anosComDado: number[] = [];
      for (const ano of anosAlvo) {
        const { data, error } = await supabase.functions.invoke('transparencia-pa-oficial', {
          body: { modo: 'despesas', ano },
        });
        if (error) throw error;
        if (data?.error) { toast.error(`${ano}: ${data.error}`); continue; }
        const linhas = (data?.data ?? []) as Array<{ orgao: string; valor: number; quantidade: number }>;
        if (linhas.length === 0) continue;
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
        totalOrgaos += linhas.length;
        anosComDado.push(ano);
      }
      if (totalOrgaos === 0) { toast.info('A API oficial não devolveu órgãos para o período.'); return; }
      toast.success(`${totalOrgaos} registros importados da API oficial do Pará (${anosComDado.join(', ')}).`, {
        description: 'Valor = total EMPENHADO por órgão em cada ano, direto do portal de dados abertos.',
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

  // ── Exportar RESULTADO da busca por credor (08/09): PDF com timbrado,
  // Excel, Word e JPG — o JPG existe para o recorte rápido que se manda numa
  // conversa; os demais para processo, planilha e ofício.
  const tituloResultado = () =>
    `Empenhos do credor "${credor.trim()}" — Portal da Transparência do Pará (${anoCredor})`;
  const cabecalhosResultado = ['Empenho', 'Órgão', 'Credor', 'CNPJ/CPF', 'Data', 'Empenhado (R$)', 'Pago (R$)'];
  const linhasResultado = () => achados.map((n) => [
    n.numero, n.orgao, n.credor, n.credor_cpf_cnpj ?? '', n.dt_despesa,
    n.valor_empenhado.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    n.valor_pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
  ]);
  const rodapeTotais = () => totaisCredor
    ? `${totaisCredor.qtd_notas} nota(s) · empenhado ${brlExato(totaisCredor.valor_empenhado)} · pago ${brlExato(totaisCredor.valor_pago)} · saldo a pagar ${brlExato(totaisCredor.saldo_a_pagar)}`
    : '';

  const exportarResultadoPDF = async () => {
    const { carregarTimbrado } = await import('@/lib/timbrado/timbrado');
    const timbrado = await carregarTimbrado(empresaAtiva?.id);
    // Sem timbrado o PDF sai cru — dizer POR QUÊ evita parecer defeito:
    // cada empresa configura o seu (foi o caso da ETHOS em 08/09).
    if (!timbrado) {
      toast.info('Esta empresa ainda não tem timbrado configurado — o PDF sai sem identidade visual.', {
        description: 'Configure em Configurações → Timbrado da empresa.',
      });
    }
    downloadPDF(`empenhos-credor-${anoCredor}`, `${tituloResultado()} — ${rodapeTotais()}`,
      cabecalhosResultado, linhasResultado(), timbrado);
  };

  const exportarResultadoExcel = async () => {
    await writeExcelFromJson(`empenhos-credor-${anoCredor}.xlsx`, 'Empenhos por credor',
      achados.map((n) => ({
        'Empenho': n.numero, 'Órgão': n.orgao, 'Credor': n.credor,
        'CNPJ/CPF': n.credor_cpf_cnpj ?? '', 'Data': n.dt_despesa,
        'Empenhado (R$)': n.valor_empenhado, 'Pago (R$)': n.valor_pago,
      })));
  };

  const exportarResultadoWord = () => {
    const linhas = linhasResultado()
      .map((l) => `<tr>${l.map((c) => `<td>${String(c).replace(/</g, '&lt;')}</td>`).join('')}</tr>`)
      .join('');
    const html = `<html><head><meta charset="utf-8"><style>table{border-collapse:collapse;font-family:Times New Roman}td,th{border:1px solid #999;padding:4px 8px;font-size:10pt}</style></head><body><h2>${tituloResultado()}</h2><p>${rodapeTotais()}</p><table><tr>${cabecalhosResultado.map((h) => `<th>${h}</th>`).join('')}</tr>${linhas}</table></body></html>`;
    const blob = new Blob(['﻿', html], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `empenhos-credor-${anoCredor}.doc`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportarResultadoJPG = () => {
    const linhas = linhasResultado();
    const colX = [20, 190, 330, 700, 860, 960, 1150];
    const W = 1340; const rowH = 30; const topo = 100;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = topo + (linhas.length + 1) * rowH + 30;
    const ctx = canvas.getContext('2d');
    if (!ctx) { toast.error('Não foi possível gerar a imagem neste navegador.'); return; }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111111'; ctx.font = 'bold 18px sans-serif';
    ctx.fillText(tituloResultado(), 20, 34);
    ctx.font = '14px sans-serif'; ctx.fillStyle = '#444444';
    ctx.fillText(rodapeTotais(), 20, 60);
    ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#111111';
    cabecalhosResultado.forEach((h, i) => ctx.fillText(h, colX[i], topo - 10));
    ctx.strokeStyle = '#cccccc'; ctx.beginPath();
    ctx.moveTo(20, topo - 2); ctx.lineTo(W - 20, topo - 2); ctx.stroke();
    ctx.font = '13px sans-serif';
    linhas.forEach((l, r) => {
      const y = topo + (r + 1) * rowH - 10;
      l.forEach((c, i) => {
        const max = (colX[i + 1] ?? W - 20) - colX[i] - 12;
        let texto = String(c);
        while (ctx.measureText(texto).width > max && texto.length > 3) texto = texto.slice(0, -2) + '…';
        ctx.fillStyle = '#222222';
        ctx.fillText(texto, colX[i], y);
      });
    });
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `empenhos-credor-${anoCredor}.jpg`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/jpeg', 0.95);
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
      // Limpar limpa a TELA inteira: a busca por credor tem estado próprio e
      // ficava de pé depois do clique (08/09) — pesquisa remanescente parece
      // dado que sobreviveu à limpeza.
      setCredor('');
      setAchados([]);
      setTotaisCredor(null);
      setBuscouCredor(false);
      setPaginaCredor(1);
      toast.success('Dados removidos');
      loadDados();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const dadosFiltrados = dados.filter(d => !busca || d.orgao.toLowerCase().includes(busca.toLowerCase()));

  // ── Exportação em formatos (08/09): PDF veste o timbrado da empresa, como
  // todo documento gerado; Excel e CSV para planilha; Word para quem monta
  // ofício em cima. JPG fica de fora de propósito: tabela em imagem não se
  // confere nem se soma — o PDF cobre a impressão.
  const nomeBase = `transparencia-${portal.sigla.toLowerCase()}-${anoFiltro}`;
  const cabecalhos = ['Órgão', 'Ano', 'Valor empenhado (R$)'];
  const linhasExport = () => dadosFiltrados.map(d => [
    d.orgao, String(d.ano),
    d.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
  ]);

  const exportarExcel = async () => {
    if (dadosFiltrados.length === 0) return;
    await writeExcelFromJson(`${nomeBase}.xlsx`, `Transparência ${portal.nome}`,
      dadosFiltrados.map(d => ({
        'Órgão': d.orgao,
        'Ano': d.ano,
        'Valor Total (R$)': d.valor_total,
        'Qtd Empenhos': d.quantidade_empenhos,
        'Categoria': d.categoria || '',
      }))
    );
  };

  const exportarCSVArquivo = () => {
    if (dadosFiltrados.length === 0) return;
    downloadCSV(nomeBase, cabecalhos, linhasExport());
  };

  const exportarPDF = async () => {
    if (dadosFiltrados.length === 0) return;
    const { carregarTimbrado } = await import('@/lib/timbrado/timbrado');
    const timbrado = await carregarTimbrado(empresaAtiva?.id);
    if (!timbrado) {
      toast.info('Esta empresa ainda não tem timbrado configurado — o PDF sai sem identidade visual.', {
        description: 'Configure em Configurações → Timbrado da empresa.',
      });
    }
    downloadPDF(nomeBase, `Transparência ${portal.nome} — despesas por órgão (${anoFiltro})`,
      cabecalhos, linhasExport(), timbrado);
  };

  const exportarWord = () => {
    if (dadosFiltrados.length === 0) return;
    const linhas = linhasExport()
      .map((l) => `<tr>${l.map((c) => `<td>${String(c).replace(/</g, '&lt;')}</td>`).join('')}</tr>`)
      .join('');
    const html = `<html><head><meta charset="utf-8"><style>table{border-collapse:collapse;font-family:Times New Roman}td,th{border:1px solid #999;padding:4px 8px;font-size:11pt}</style></head><body><h2>Transparência ${portal.nome} — despesas por órgão (${anoFiltro})</h2><table><tr>${cabecalhos.map((h) => `<th>${h}</th>`).join('')}</tr>${linhas}</table></body></html>`;
    const blob = new Blob(['﻿', html], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${nomeBase}.doc`;
    a.click();
    URL.revokeObjectURL(a.href);
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
      <div className="flex items-center gap-2">
        <Badge variant="info">{portalLabel}</Badge>
      </div>

      {/* Header actions */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="transparencia-ano" className="text-sm font-medium text-foreground">Ano</label>
          <Select value={anoFiltro} onValueChange={setAnoFiltro}>
            <SelectTrigger id="transparencia-ano" className="w-44">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os anos</SelectItem>
              {anos.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* O "Extrair do Portal" de IA foi aposentado (estimava números).
              Para o PARÁ ele renasceu de verdade: a API oficial de dados
              abertos do Estado. Para os demais portais, os caminhos honestos
              continuam sendo a planilha e o link. */}
          {ehParaEstado && (
            <Button variant="outline" size="sm" onClick={extrairDaApiOficial} disabled={extraindo}>
              {extraindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Extração oficial
            </Button>
          )}

          <label className="cursor-pointer">
            <Button variant="outline" size="sm" asChild>
              <span>
                <Upload className="h-4 w-4" /> Importar planilha
              </span>
            </Button>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="sr-only" />
          </label>

          {/* Exporta o RESULTADO da busca por credor — posição a pedido (08/09):
              entre Importar Planilha e Abrir Portal. */}
          {achados.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4" /> Exportar resultado
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={exportarResultadoPDF}>PDF (com timbrado)</DropdownMenuItem>
                <DropdownMenuItem onClick={exportarResultadoWord}>Word (.doc)</DropdownMenuItem>
                <DropdownMenuItem onClick={exportarResultadoExcel}>Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={exportarResultadoJPG}>JPG (imagem)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Ordem a pedido (08/09): Exportar · Abrir Portal · Limpar. */}
          {dados.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={exportarPDF}>PDF (com timbrado)</DropdownMenuItem>
                <DropdownMenuItem onClick={exportarExcel}>Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={exportarWord}>Word (.doc)</DropdownMenuItem>
                <DropdownMenuItem onClick={exportarCSVArquivo}>CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button asChild variant="ghost" size="sm">
            <a href={portal.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" /> Abrir portal
            </a>
          </Button>

          {(dados.length > 0 || achados.length > 0) && (
            <Button variant="ghost" size="sm" onClick={handleLimparDados} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" /> Limpar
            </Button>
          )}
        </div>
      </div>

      {/* ── Fase B: empenhos por credor, a MESMA busca do portal (só PA) ──
          O caso de uso nº 1 é a empresa procurar A SI MESMA: os próprios
          empenhos estaduais, com empenhado, pago e o SALDO A RECEBER, sem
          depender do órgão avisar. Busca textual do backend do portal:
          nome, CNPJ ou número do empenho — instantânea, com os totais que a
          tela do portal exibe. */}
      {ehParaEstado && (
        <Card className="space-y-4 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            Empenhos por credor — busca do portal do Pará
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            {/* Placeholder NEUTRO: exemplo com razão social de um assinante
                aparecia no login de outro (08/09) — nome de empresa não é
                texto de exemplo. */}
            <div className="flex flex-col gap-1">
              <label htmlFor="credor-busca" className="text-sm font-medium text-foreground">Credor</label>
              <Input id="credor-busca" placeholder="Nome do credor, CNPJ ou nº do empenho" value={credor}
                onChange={(e) => setCredor(e.target.value)} className="w-80 max-w-full"
                onKeyDown={(e) => { if (e.key === 'Enter' && credor.trim().length >= 4) buscarPorCredor(1); }} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="credor-ano" className="text-sm font-medium text-foreground">Ano</label>
              <Select value={anoCredor} onValueChange={setAnoCredor}>
                <SelectTrigger id="credor-ano" className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {anos.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button disabled={buscandoCredor || credor.trim().length < 4}
              onClick={() => buscarPorCredor(1)}>
              {buscandoCredor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar
            </Button>
          </div>

          {totaisCredor && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border border-border p-4">
                <p className="text-sm text-muted-foreground">Notas empenhadas</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{totaisCredor.qtd_notas.toLocaleString('pt-BR')}</p>
              </div>
              <div className="rounded-md border border-border p-4">
                <p className="text-sm text-muted-foreground">Valor empenhado</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{brlExato(totaisCredor.valor_empenhado)}</p>
              </div>
              <div className="rounded-md border border-border p-4">
                <p className="text-sm text-muted-foreground">Valor pago</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-success-ink">{brlExato(totaisCredor.valor_pago)}</p>
              </div>
              <div className="rounded-md border border-border p-4">
                <p className="text-sm text-muted-foreground">Saldo a pagar</p>
                <p className={`mt-1 text-lg font-semibold tabular-nums ${totaisCredor.saldo_a_pagar > 0 ? 'text-warning-ink' : 'text-muted-foreground'}`}>
                  {brlExato(totaisCredor.saldo_a_pagar)}
                </p>
              </div>
            </div>
          )}

          {buscouCredor && !buscandoCredor && achados.length === 0 && (
            <EstadoVazio
              tamanho="compacto"
              icone={<Search />}
              titulo="Nenhum empenho encontrado"
              descricao={`Sem resultado para “${credor.trim()}” em ${anoCredor}.`}
            />
          )}

          {achados.length > 0 && (
            <ul className="max-h-[320px] divide-y divide-border overflow-y-auto rounded-md border border-border">
              {/* Cada linha abre o DETALHE do empenho no portal oficial (a
                  pedido, 08/09): itens, processo, datas — para confrontar e
                  imprimir na fonte. O id_ne é a chave da rota do portal. */}
              {achados.map((n) => (
                <li key={n.id_ne}>
                  <a
                    href={`https://sistemas.pa.gov.br/portaltransparencia/empenho/notas/detalhe/${n.id_ne}`}
                    target="_blank" rel="noopener noreferrer"
                    title="Abrir o detalhe deste empenho no portal oficial (confrontar e imprimir)"
                    className="flex cursor-pointer items-center justify-between gap-3 p-3 text-sm transition-colors hover:bg-muted"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium tabular-nums text-foreground">
                        {n.numero} · {n.orgao}
                        <ExternalLink className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {n.credor}{n.credor_cpf_cnpj ? ` · ${n.credor_cpf_cnpj}` : ''} · {n.dt_despesa}
                      </p>
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      <p className="font-semibold text-foreground">{brlExato(n.valor_empenhado)}</p>
                      <p className={`text-xs ${n.valor_pago > 0 ? 'text-success-ink' : 'text-muted-foreground'}`}>
                        pago: {brlExato(n.valor_pago)}
                      </p>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}

          {totaisCredor && achados.length > 0 && achados.length < totaisCredor.qtd_notas && !buscandoCredor && (
            <Button size="sm" variant="outline" onClick={() => buscarPorCredor(paginaCredor + 1)}>
              Carregar mais ({achados.length} de {totaisCredor.qtd_notas})
            </Button>
          )}
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" aria-hidden="true" />
            Órgãos
          </p>
          <p className="mt-2 text-[2rem] font-bold leading-10 tabular-nums text-foreground">{orgaosUnicos}</p>
          <p className="text-xs text-muted-foreground">identificados</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            Total de empenhos
          </p>
          {contagemConhecida ? (
            <p className="mt-2 text-[2rem] font-bold leading-10 tabular-nums text-foreground">{totalEmpenhos.toLocaleString('pt-BR')}</p>
          ) : (
            <>
              <p className="mt-2 text-[2rem] font-bold leading-10 tabular-nums text-muted-foreground">—</p>
              <p className="text-xs text-muted-foreground">a fonte agrega por órgão, sem contagem de notas</p>
            </>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            Volume total (empenhado)
          </p>
          {/* Valor EXATO no card: dentro de um processo, centavos importam. */}
          <p className="mt-2 text-lg font-semibold tabular-nums text-foreground">{brlExato(totalGeral)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingDown className="h-4 w-4" aria-hidden="true" />
            {contagemConhecida ? 'Ticket médio' : 'Média por órgão'}
          </p>
          {contagemConhecida ? (
            <p className="mt-2 text-lg font-semibold tabular-nums text-foreground">{totalEmpenhos > 0 ? brlExato(totalGeral / totalEmpenhos) : 'R$ 0,00'}</p>
          ) : (
            <p className="mt-2 text-lg font-semibold tabular-nums text-foreground">{orgaosUnicos > 0 ? brlExato(totalGeral / orgaosUnicos) : 'R$ 0,00'}</p>
          )}
        </div>
      </div>

      {dados.length === 0 ? (
        <Card>
          <EstadoVazio
            icone={<Building2 />}
            titulo="Nenhum dado importado"
            descricao={
              <>
                Abra o portal de {portal.nome} pelo botão <strong>“Abrir portal”</strong>, baixe a planilha
                de empenhos/despesas e envie por <strong>“Importar planilha”</strong> — os números aqui
                são sempre os do próprio portal, nunca estimativas.
                <span className="mt-2 block text-xs">
                  Formatos aceitos: .xlsx, .xls, .csv · Colunas esperadas: Órgão, Valor, Ano, Quantidade
                </span>
              </>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Top 10 órgãos por volume (R$)</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={top10} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="orgao" tick={{ fontSize: 9 }} width={160} />
                  <Tooltip formatter={(v: number) => brlExato(v)} />
                  <Bar dataKey="valor_total" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Distribuição por órgão (top 8)</h2>
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
                  <Tooltip formatter={(v: number) => brlExato(v)} />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            {porAno.some(a => a.valor > 0) && (
              <Card className="p-6 lg:col-span-2">
                <h2 className="mb-4 text-lg font-semibold text-foreground">Evolução anual do volume de empenhos</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={porAno.filter(a => a.valor > 0)}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="ano" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => brlExato(v)} />
                    <Bar dataKey="valor" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Volume (R$)" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
          </div>

          <Card className="p-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Ranking de órgãos</h2>
              <div className="flex flex-col gap-1">
                <label htmlFor="ranking-busca" className="text-sm font-medium text-foreground">Buscar órgão</label>
                <Input id="ranking-busca" placeholder="Nome do órgão" value={busca}
                  onChange={e => setBusca(e.target.value)} className="w-64 max-w-full" />
              </div>
            </div>
            <ul className="max-h-[400px] space-y-2 overflow-y-auto">
              {dadosFiltrados.map((d, i) => (
                <li key={d.id || i} className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted p-3 transition-colors hover:border-primary/40">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-8 shrink-0 text-center text-lg font-bold text-foreground">{i + 1}º</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{d.orgao}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="muted">{d.ano}</Badge>
                        {d.categoria && <Badge variant="info">{d.categoria}</Badge>}
                        <span className="text-xs text-muted-foreground">{d.quantidade_empenhos} empenhos</span>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-foreground">{brlExato(d.valor_total)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
