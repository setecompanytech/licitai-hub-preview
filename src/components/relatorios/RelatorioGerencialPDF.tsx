import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { FileText, Download, Loader2, BarChart3 } from 'lucide-react';
import { downloadPDF } from '@/lib/download-utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';

const periodos = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: '180', label: 'Últimos 6 meses' },
  { value: '365', label: 'Último ano' },
];

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function RelatorioGerencialPDF() {
  const { user } = useAuth();
  const { empresaAtiva, todasSelecionadas } = useEmpresa();
  const [periodo, setPeriodo] = useState('30');
  const [generating, setGenerating] = useState(false);
  const [open, setOpen] = useState(false);

  const handleGenerate = async () => {
    if (!user) return;
    setGenerating(true);

    try {
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - parseInt(periodo));
      const inicio = dataInicio.toISOString();

      let q = supabase.from('licitacoes').select('*').gte('created_at', inicio); // relatorio gerencial e da empresa
      if (!todasSelecionadas && empresaAtiva) {
        q = q.eq('empresa_id', empresaAtiva.id);
      }

      const { data: licitacoes } = await q;
      const items = licitacoes || [];

      // KPIs
      const total = items.length;
      const vencidas = items.filter(l => ['Vencida', 'vencida', 'Homologada'].includes(l.status));
      const perdidas = items.filter(l => ['Perdida', 'perdida'].includes(l.status));
      const propostas = items.filter(l => ['Proposta Enviada', 'enviada', 'proposta'].includes(l.status));
      const totalDecididas = vencidas.length + perdidas.length;
      const taxa = totalDecididas > 0 ? ((vencidas.length / totalDecididas) * 100).toFixed(1) : '0';
      const valorGanho = vencidas.reduce((s, l) => s + (l.valor_adjudicado || l.valor_estimado || 0), 0);
      const valorEstimado = vencidas.reduce((s, l) => s + (l.valor_estimado || 0), 0);
      const roi = valorEstimado > 0
        ? ((valorEstimado - vencidas.reduce((s, l) => s + (l.valor_adjudicado || 0), 0)) / valorEstimado * 100).toFixed(1)
        : '0';

      // Summary PDF
      const ts = new Date().toISOString().slice(0, 10);
      const empresaLabel = todasSelecionadas ? 'Todas as Empresas' : empresaAtiva?.razao_social || 'N/I';
      const periodoLabel = periodos.find(p => p.value === periodo)?.label || periodo;

      const summaryHeaders = ['Indicador', 'Valor'];
      const summaryRows = [
        ['Período', periodoLabel],
        ['Empresa', empresaLabel],
        ['Total de Processos', String(total)],
        ['Propostas Enviadas', String(propostas.length)],
        ['Vitórias', String(vencidas.length)],
        ['Derrotas', String(perdidas.length)],
        ['Taxa de Vitória', `${taxa}%`],
        ['ROI Médio (Economia)', `${roi}%`],
        ['Valor Total Ganho', formatCurrency(valorGanho)],
      ];

      downloadPDF(
        `relatorio-gerencial-${ts}`,
        `Relatório Gerencial — PRAEFECTUS — ${periodoLabel}`,
        summaryHeaders,
        summaryRows
      );

      // Detailed list
      if (items.length > 0) {
        const detailHeaders = ['Nº', 'Órgão', 'Modalidade', 'Status', 'Vlr Estimado', 'Vlr Adjudicado', 'UF'];
        const detailRows = items.map(l => [
          l.numero,
          l.orgao.slice(0, 40),
          l.modalidade,
          l.status,
          l.valor_estimado ? formatCurrency(l.valor_estimado) : '—',
          l.valor_adjudicado ? formatCurrency(l.valor_adjudicado) : '—',
          l.uf || '—',
        ]);

        downloadPDF(
          `relatorio-processos-${ts}`,
          `Processos Licitatórios — ${periodoLabel}`,
          detailHeaders,
          detailRows
        );
      }

      toast.success('Relatórios gerados com sucesso!');
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar relatório.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs">
          <BarChart3 className="w-3.5 h-3.5" /> Relatório PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="w-5 h-5 text-accent" />
            Relatório Gerencial
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Período</label>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodos.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
            <p>O relatório inclui:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Resumo de KPIs (vitórias, derrotas, taxa, ROI)</li>
              <li>Valor total ganho no período</li>
              <li>Lista detalhada de processos</li>
              <li>Filtrado pela empresa ativa</li>
            </ul>
          </div>

          <Button onClick={handleGenerate} disabled={generating} className="w-full">
            {generating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando...</>
            ) : (
              <><Download className="w-4 h-4 mr-2" /> Gerar e Baixar PDF</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
