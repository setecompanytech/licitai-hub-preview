import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { downloadCSV, downloadPDF, downloadJSON } from '@/lib/download-utils';
import type { LanceConfig } from './ConfigurarLanceDialog';

type Props = {
  lances: LanceConfig[];
};

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ExportarResultados({ lances }: Props) {
  if (lances.length === 0) return null;

  const headers = [
    'Edital', 'Portal', 'Status', 'Tipo Disputa', 'Vlr Referência',
    'Vlr Inicial', 'Vlr Mínimo', 'Último Lance', 'Desconto %',
    'Qtd Itens', 'Horário Sessão',
  ];

  const buildRows = (): string[][] =>
    lances.map(l => {
      const desconto = l.valorReferencia > 0 && l.meuLance
        ? ((1 - l.meuLance / l.valorReferencia) * 100).toFixed(2) + '%'
        : '—';
      return [
        l.edital,
        l.portal,
        l.status,
        l.tipoDisputa === 'lote' ? 'Por Lote' : 'Por Item',
        formatCurrency(l.valorReferencia),
        formatCurrency(l.valorInicial),
        formatCurrency(l.valorMinimo),
        l.meuLance ? formatCurrency(l.meuLance) : '—',
        desconto,
        String(l.itens.length),
        l.horario || '—',
      ];
    });

  const buildItemHeaders = () => [
    'Edital', 'Nº Item', 'Lote', 'Descrição', 'Qtd', 'Unid',
    'Vlr Referência', 'Melhor Lance', 'Seu Último Lance',
    'Situação', 'Disputando',
  ];

  const buildItemRows = (): string[][] =>
    lances.flatMap(l =>
      l.itens.map(i => [
        l.edital,
        String(i.numero),
        i.lote,
        i.descricao,
        String(i.quantidade),
        i.unidade,
        formatCurrency(i.valorReferencia),
        i.melhorLance ? formatCurrency(i.melhorLance) : '—',
        i.seuUltimoLance ? formatCurrency(i.seuUltimoLance) : '—',
        i.situacao,
        i.disputando ? 'Sim' : 'Não',
      ])
    );

  const handleExportCSV = () => {
    const ts = new Date().toISOString().slice(0, 10);
    downloadCSV(`disputas-${ts}`, headers, buildRows());
  };

  const handleExportItemsCSV = () => {
    const ts = new Date().toISOString().slice(0, 10);
    downloadCSV(`disputas-itens-${ts}`, buildItemHeaders(), buildItemRows());
  };

  const handleExportPDF = () => {
    const ts = new Date().toISOString().slice(0, 10);
    downloadPDF(`disputas-${ts}`, 'Relatório de Disputas — PRAEFECTUS', headers, buildRows());
  };

  const handleExportItemsPDF = () => {
    const ts = new Date().toISOString().slice(0, 10);
    downloadPDF(`disputas-itens-${ts}`, 'Relatório de Itens de Disputas — Praefectus', buildItemHeaders(), buildItemRows());
  };

  const handleExportJSON = () => {
    const ts = new Date().toISOString().slice(0, 10);
    downloadJSON(`disputas-${ts}`, lances);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="text-xs gap-1.5">
          <Download className="w-3.5 h-3.5" /> Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handleExportPDF}>
          <FileText className="w-3.5 h-3.5 mr-2" /> Disputas — PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportItemsPDF}>
          <FileText className="w-3.5 h-3.5 mr-2" /> Itens detalhados — PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportCSV}>
          <FileSpreadsheet className="w-3.5 h-3.5 mr-2" /> Disputas — CSV/Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportItemsCSV}>
          <FileSpreadsheet className="w-3.5 h-3.5 mr-2" /> Itens detalhados — CSV/Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportJSON}>
          <Download className="w-3.5 h-3.5 mr-2" /> JSON completo
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
