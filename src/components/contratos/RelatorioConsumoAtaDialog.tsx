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

export default function RelatorioConsumoAtaDialog({ ataId, ataNumero }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const hoje = new Date().toISOString().slice(0, 10);
  const seisMesesAtras = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
  const [dataInicio, setDataInicio] = useState(seisMesesAtras);
  const [dataFim, setDataFim] = useState(hoje);

  async function carregarDados() {
    // 1) ATA (mãe) e seus itens
    const [ataRes, ataItensRes] = await Promise.all([
      supabase.from('contratos').select('id, numero_contrato, numero_ata, objeto, orgao_contratante, valor_global, valor_global_original, valor_consumido, data_assinatura, data_fim').eq('id', ataId).single(),
      supabase.from('contrato_itens').select('*').eq('contrato_id', ataId),
    ]);
    if (ataRes.error || !ataRes.data) throw new Error('ATA não encontrada');

    // 2) Contratos derivados no período (filtra por data_assinatura)
    const { data: derivados, error: errDeriv } = await supabase
      .from('contratos')
      .select('id, numero_contrato, orgao_contratante, data_assinatura, data_inicio, data_fim, valor_global, status')
      .eq('ata_srp_id', ataId)
      .eq('tipo_documento', 'contrato')
      .gte('data_assinatura', dataInicio)
      .lte('data_assinatura', dataFim);
    if (errDeriv) throw errDeriv;

    const derivIds = (derivados || []).map(d => d.id);

    // 3) Itens dos contratos derivados (com vínculo à ATA)
    let itensDerivados: any[] = [];
    if (derivIds.length) {
      const { data, error } = await supabase
        .from('contrato_itens')
        .select('*, ata_match_motivo, ata_match_similaridade, ata_match_origem')
        .in('contrato_id', derivIds);
      if (error) throw error;
      itensDerivados = data || [];
    }

    return {
      ata: ataRes.data,
      ataItens: (ataItensRes.data as any[]) || [],
      derivados: derivados || [],
      itensDerivados,
    };
  }

  function classificarOrigem(item: any): 'IA' | 'Manual' | 'Override' | 'Sem vínculo' {
    if (!item.ata_item_id) return 'Sem vínculo';
    const origem = (item.ata_match_origem || '').toLowerCase();
    const motivo = (item.ata_match_motivo || '').toLowerCase();
    if (origem === 'manual_override' || motivo.includes('override')) return 'Override';
    if (origem === 'ia' || motivo.includes('codigo_exato') || motivo.includes('descricao_similar')) return 'IA';
    return 'Manual';
  }

  function montarLinhas(dados: Awaited<ReturnType<typeof carregarDados>>) {
    const ataItensMap = new Map(dados.ataItens.map(i => [i.id, i]));
    const derivMap = new Map(dados.derivados.map(d => [d.id, d]));

    // Linhas: uma por item de contrato derivado vinculado
    const linhas = dados.itensDerivados.map(it => {
      const ataItem: any = it.ata_item_id ? ataItensMap.get(it.ata_item_id) : null;
      const contrato: any = derivMap.get(it.contrato_id);
      const origem = classificarOrigem(it);
      return {
        contrato_numero: contrato?.numero_contrato || '—',
        orgao: contrato?.orgao_contratante || '—',
        data_assinatura: contrato?.data_assinatura || null,
        item_descricao: it.descricao || '—',
        ata_item_descricao: ataItem?.descricao || (it.ata_item_id ? '(item removido)' : '—'),
        unidade: it.unidade || ataItem?.unidade || '—',
        qtd_consumida: Number(it.quantidade_contratada || 0),
        valor_unitario: Number(it.valor_unitario || 0),
        valor_total: Number(it.valor_total || 0),
        origem_vinculo: origem,
        similaridade: typeof it.ata_match_similaridade === 'number' ? `${Math.round(it.ata_match_similaridade * 100)}%` : '—',
        motivo: it.ata_match_motivo || '—',
      };
    });

    // Resumo agregado por contrato derivado
    const porContrato = new Map<string, { numero: string; orgao: string; data: string | null; qtd_itens: number; valor_total: number; ia: number; override: number; manual: number; sem: number }>();
    for (const l of linhas) {
      const key = l.contrato_numero;
      const cur = porContrato.get(key) || { numero: l.contrato_numero, orgao: l.orgao, data: l.data_assinatura, qtd_itens: 0, valor_total: 0, ia: 0, override: 0, manual: 0, sem: 0 };
      cur.qtd_itens += 1;
      cur.valor_total += l.valor_total;
      if (l.origem_vinculo === 'IA') cur.ia += 1;
      else if (l.origem_vinculo === 'Override') cur.override += 1;
      else if (l.origem_vinculo === 'Manual') cur.manual += 1;
      else cur.sem += 1;
      porContrato.set(key, cur);
    }

    // Saldos por item da ATA
    const saldos = dados.ataItens.map(ai => ({
      descricao: ai.descricao,
      unidade: ai.unidade || '—',
      qtd_total: Number(ai.quantidade_contratada || 0),
      qtd_consumida: Number(ai.quantidade_ata_consumida || 0),
      saldo_qtd: Math.max(Number(ai.quantidade_contratada || 0) - Number(ai.quantidade_ata_consumida || 0), 0),
      valor_total: Number(ai.valor_total || 0),
      saldo_financeiro: Number(ai.saldo_financeiro || 0),
    }));

    return { linhas, porContrato: Array.from(porContrato.values()), saldos };
  }

  async function exportar(formato: 'pdf' | 'csv') {
    setLoading(true);
    try {
      const dados = await carregarDados();
      const { linhas, porContrato, saldos } = montarLinhas(dados);

      if (linhas.length === 0 && porContrato.length === 0) {
        toast.warning('Nenhum contrato derivado encontrado no período selecionado.');
        setLoading(false);
        return;
      }

      const ts = new Date().toISOString().slice(0, 10);
      const periodoLabel = `${new Date(dataInicio).toLocaleDateString('pt-BR')} a ${new Date(dataFim).toLocaleDateString('pt-BR')}`;
      const ataLabel = ataNumero || dados.ata.numero_ata || dados.ata.numero_contrato || ataId.slice(0, 8);
      const baseFile = `consumo-ata-${String(ataLabel).replace(/[^\w]/g, '_')}-${ts}`;

      // ---------- CSV ----------
      if (formato === 'csv') {
        // Resumo por contrato
        downloadCSV(
          `${baseFile}-resumo-contratos`,
          ['Contrato', 'Órgão', 'Data Assinatura', 'Itens', 'Valor Consumido', 'Vínculos IA', 'Overrides', 'Manuais', 'Sem vínculo'],
          porContrato.map(c => [
            c.numero, c.orgao, fmtDate(c.data), String(c.qtd_itens),
            fmt(c.valor_total), String(c.ia), String(c.override), String(c.manual), String(c.sem),
          ]),
        );
        // Detalhe por item
        downloadCSV(
          `${baseFile}-itens-detalhe`,
          ['Contrato', 'Item Contrato', 'Item ATA', 'Unidade', 'Qtd', 'Vlr Unit.', 'Vlr Total', 'Origem Vínculo', 'Similaridade', 'Motivo'],
          linhas.map(l => [
            l.contrato_numero, l.item_descricao, l.ata_item_descricao, l.unidade,
            fmtQtd(l.qtd_consumida), fmt(l.valor_unitario), fmt(l.valor_total),
            l.origem_vinculo, l.similaridade, l.motivo,
          ]),
        );
        // Saldos atuais da ATA
        downloadCSV(
          `${baseFile}-saldos-ata`,
          ['Item ATA', 'Unidade', 'Qtd Total', 'Qtd Consumida', 'Saldo Qtd', 'Vlr Total', 'Saldo Financeiro'],
          saldos.map(s => [
            s.descricao, s.unidade, fmtQtd(s.qtd_total), fmtQtd(s.qtd_consumida),
            fmtQtd(s.saldo_qtd), fmt(s.valor_total), fmt(s.saldo_financeiro),
          ]),
        );
        toast.success('CSVs exportados (3 arquivos).');
        setOpen(false);
        return;
      }

      // ---------- PDF ----------
      // Resumo
      downloadPDF(
        `${baseFile}-resumo`,
        `Consumo da ATA ${ataLabel} — ${periodoLabel}`,
        ['Contrato', 'Órgão', 'Assinatura', 'Itens', 'Vlr Consumido', 'IA', 'Overr.', 'Manual', 'Sem'],
        porContrato.map(c => [
          c.numero, (c.orgao || '').slice(0, 35), fmtDate(c.data), String(c.qtd_itens),
          fmt(c.valor_total), String(c.ia), String(c.override), String(c.manual), String(c.sem),
        ]),
      );
      // Detalhe
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
      // Saldos
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
      toast.success('PDFs gerados (resumo, detalhe e saldos).');
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
          <div className="bg-muted/40 rounded-md p-3 text-[11px] text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">O relatório inclui:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Resumo por contrato derivado (qtd itens e valor consumido)</li>
              <li>Detalhe item-a-item com vínculo à ATA (IA, Override ou Manual)</li>
              <li>Similaridade do match e motivo do vínculo</li>
              <li>Saldos atuais (quantitativo e financeiro) da ATA</li>
            </ul>
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
          <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
            <Download className="w-3 h-3" /> Os arquivos são baixados automaticamente
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
