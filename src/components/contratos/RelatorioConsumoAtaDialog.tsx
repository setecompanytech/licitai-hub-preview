import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileBarChart2, Download, Loader2, FileText, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { downloadCSV, downloadPDF } from '@/lib/download-utils';
import { toast } from 'sonner';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtQtd = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(v || 0);
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

type Props = { ataId: string; ataNumero?: string | null };

const PAGE_SIZE = 500;

export default function RelatorioConsumoAtaDialog({ ataId, ataNumero }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const hoje = new Date().toISOString().slice(0, 10);
  const seisMesesAtras = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
  const [dataInicio, setDataInicio] = useState(seisMesesAtras);
  const [dataFim, setDataFim] = useState(hoje);

  async function carregarDados() {
    // Agregação 100% no banco via RPC (resumo + saldos numa chamada; detalhe paginado se >PAGE_SIZE)
    let offset = 0;
    let detalhe: any[] = [];
    let primeira: any = null;

    while (true) {
      const { data, error } = await supabase.rpc('relatorio_consumo_ata' as any, {
        p_ata_id: ataId,
        p_data_inicio: dataInicio,
        p_data_fim: dataFim,
        p_limite_detalhe: PAGE_SIZE,
        p_offset_detalhe: offset,
      });
      if (error) throw error;
      const payload: any = data;
      if (!payload?.ata) throw new Error('ATA não encontrada');
      if (!primeira) primeira = payload;
      const pagina: any[] = payload.detalhe_itens || [];
      detalhe = detalhe.concat(pagina);
      const total = Number(payload.total_detalhe || 0);
      offset += pagina.length;
      if (pagina.length < PAGE_SIZE || offset >= total) break;
    }

    return {
      ata: primeira.ata,
      resumoContratos: primeira.resumo_contratos || [],
      detalheItens: detalhe,
      saldos: primeira.saldos || [],
      totalDetalhe: primeira.total_detalhe || detalhe.length,
    };
  }

  function mapearLinhas(dados: Awaited<ReturnType<typeof carregarDados>>) {
    const linhas = dados.detalheItens.map((l: any) => ({
      contrato_numero: l.contrato_numero || '—',
      orgao: l.orgao || '—',
      data_assinatura: l.data_assinatura,
      item_descricao: l.item_descricao || '—',
      ata_item_descricao: l.ata_item_descricao || '—',
      unidade: l.unidade || '—',
      qtd_consumida: Number(l.qtd_consumida || 0),
      valor_unitario: Number(l.valor_unitario || 0),
      valor_total: Number(l.valor_total || 0),
      origem_vinculo: l.origem_vinculo || 'Sem vínculo',
      similaridade: '—',
      motivo: l.motivo || 'sem_vinculo',
    }));
    const porContrato = dados.resumoContratos.map((c: any) => ({
      numero: c.numero || '—',
      orgao: c.orgao || '—',
      data: c.data_assinatura,
      qtd_itens: Number(c.qtd_itens || 0),
      valor_total: Number(c.valor_total || 0),
      ia: Number(c.ia || 0),
      override: Number(c.override || 0),
      manual: Number(c.manual || 0),
      sem: Number(c.sem || 0),
    }));
    const saldos = dados.saldos.map((s: any) => ({
      descricao: s.descricao,
      unidade: s.unidade || '—',
      qtd_total: Number(s.qtd_total || 0),
      qtd_consumida: Number(s.qtd_consumida || 0),
      saldo_qtd: Number(s.saldo_qtd || 0),
      valor_total: Number(s.valor_total || 0),
      saldo_financeiro: Number(s.saldo_financeiro || 0),
    }));
    return { linhas, porContrato, saldos };
  }

  async function exportar(formato: 'pdf' | 'csv') {
    setLoading(true);
    const t0 = performance.now();
    try {
      const dados = await carregarDados();
      const { linhas, porContrato, saldos } = mapearLinhas(dados);

      if (linhas.length === 0 && porContrato.length === 0) {
        toast.warning('Nenhum contrato derivado encontrado no período selecionado.');
        setLoading(false);
        return;
      }

      const ts = new Date().toISOString().slice(0, 10);
      const periodoLabel = `${new Date(dataInicio).toLocaleDateString('pt-BR')} a ${new Date(dataFim).toLocaleDateString('pt-BR')}`;
      const ataLabel = ataNumero || dados.ata.numero_ata || dados.ata.numero_contrato || ataId.slice(0, 8);
      const baseFile = `consumo-ata-${String(ataLabel).replace(/[^\w]/g, '_')}-${ts}`;

      if (formato === 'csv') {
        downloadCSV(
          `${baseFile}-resumo-contratos`,
          ['Contrato', 'Órgão', 'Data Assinatura', 'Itens', 'Valor Consumido', 'Vínculos IA', 'Overrides', 'Manuais', 'Sem vínculo'],
          porContrato.map(c => [
            c.numero, c.orgao, fmtDate(c.data), String(c.qtd_itens),
            fmt(c.valor_total), String(c.ia), String(c.override), String(c.manual), String(c.sem),
          ]),
        );
        downloadCSV(
          `${baseFile}-itens-detalhe`,
          ['Contrato', 'Item Contrato', 'Item ATA', 'Unidade', 'Qtd', 'Vlr Unit.', 'Vlr Total', 'Origem Vínculo', 'Similaridade', 'Motivo'],
          linhas.map(l => [
            l.contrato_numero, l.item_descricao, l.ata_item_descricao, l.unidade,
            fmtQtd(l.qtd_consumida), fmt(l.valor_unitario), fmt(l.valor_total),
            l.origem_vinculo, l.similaridade, l.motivo,
          ]),
        );
        downloadCSV(
          `${baseFile}-saldos-ata`,
          ['Item ATA', 'Unidade', 'Qtd Total', 'Qtd Consumida', 'Saldo Qtd', 'Vlr Total', 'Saldo Financeiro'],
          saldos.map(s => [
            s.descricao, s.unidade, fmtQtd(s.qtd_total), fmtQtd(s.qtd_consumida),
            fmtQtd(s.saldo_qtd), fmt(s.valor_total), fmt(s.saldo_financeiro),
          ]),
        );
        toast.success(`CSVs exportados em ${(performance.now() - t0).toFixed(0)}ms.`);
        setOpen(false);
        return;
      }

      downloadPDF(
        `${baseFile}-resumo`,
        `Consumo da ATA ${ataLabel} — ${periodoLabel}`,
        ['Contrato', 'Órgão', 'Assinatura', 'Itens', 'Vlr Consumido', 'IA', 'Overr.', 'Manual', 'Sem'],
        porContrato.map(c => [
          c.numero, (c.orgao || '').slice(0, 35), fmtDate(c.data), String(c.qtd_itens),
          fmt(c.valor_total), String(c.ia), String(c.override), String(c.manual), String(c.sem),
        ]),
      );
      if (linhas.length) {
        downloadPDF(
          `${baseFile}-detalhe`,
          `Detalhe Itens Consumidos — ATA ${ataLabel}`,
          ['Contrato', 'Item', 'Item ATA', 'Un', 'Qtd', 'Vlr Unit', 'Vlr Total', 'Vínculo', 'Sim.'],
          linhas.map(l => [
            l.contrato_numero,
            (l.item_descricao || '').slice(0, 30),
            (l.ata_item_descricao || '').slice(0, 30),
            l.unidade, fmtQtd(l.qtd_consumida),
            fmt(l.valor_unitario), fmt(l.valor_total),
            l.origem_vinculo, l.similaridade,
          ]),
        );
      }
      downloadPDF(
        `${baseFile}-saldos`,
        `Saldos Atuais da ATA ${ataLabel}`,
        ['Item ATA', 'Un', 'Qtd Total', 'Qtd Consumida', 'Saldo Qtd', 'Vlr Total', 'Saldo Financ.'],
        saldos.map(s => [
          (s.descricao || '').slice(0, 50), s.unidade,
          fmtQtd(s.qtd_total), fmtQtd(s.qtd_consumida), fmtQtd(s.saldo_qtd),
          fmt(s.valor_total), fmt(s.saldo_financeiro),
        ]),
      );
      toast.success(`PDFs gerados em ${(performance.now() - t0).toFixed(0)}ms.`);
      setOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Erro ao gerar relatório.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs">
          <FileBarChart2 className="w-3.5 h-3.5" /> Relatório de Consumo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileBarChart2 className="w-5 h-5 text-accent" />
            Relatório de Consumo da ATA
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data início</Label>
              <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Data fim</Label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="bg-muted/40 rounded-md p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">O relatório inclui:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Resumo por contrato derivado (qtd itens e valor consumido)</li>
              <li>Detalhe item-a-item com vínculo à ATA (IA, Override ou Manual)</li>
              <li>Similaridade do match e motivo do vínculo</li>
              <li>Saldos atuais (quantitativo e financeiro) da ATA</li>
            </ul>
            <p className="text-xs mt-1 italic">Otimizado: agregação no banco + paginação ({PAGE_SIZE}/req) + índices.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => exportar('pdf')} disabled={loading} variant="default" className="gap-1.5">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              PDF
            </Button>
            <Button onClick={() => exportar('csv')} disabled={loading} variant="outline" className="gap-1.5">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              CSV
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
            <Download className="w-3 h-3" /> Os arquivos são baixados automaticamente
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
