import { Banknote, Clock, FileText, Gavel, Layers, Percent, Trophy, XCircle } from 'lucide-react';
import FaixaIndicadores, { type Indicador } from '@/components/gestao/FaixaIndicadores';
import type { AnalyticsKpis } from '@/hooks/useAnalyticsData';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

type Props = { kpis: AnalyticsKpis };

/**
 * Os oito números do Analytics no cartão KPI do Design System v3
 * (`FaixaIndicadores`): rótulo em cima, valor de 24px tabular, linha de
 * detalhe embaixo, grade `auto-fit`. Era a faixa `ds-kpi-strip` com quatro
 * colunas fixas por `style` inline e um `text-[17px]` fora da escala para
 * valores longos — a moeda compacta ("R$ 1,2 mi") já cabe sem encolher.
 * Mesmos rótulos, mesmos valores, mesma ordem.
 */
export default function AnalyticsKpiCards({ kpis }: Props) {
  const itens: Indicador[] = [
    { rotulo: 'Ganhas',          valor: kpis.ganhas,               detalhe: `Pregões: ${kpis.pregoesGanhos} · Dispensas: ${kpis.dispensasGanhas}`, icone: Trophy, tom: 'ok' },
    { rotulo: 'Perdidas',        valor: kpis.perdidas,             icone: XCircle, tom: 'critico' },
    { rotulo: 'Em andamento',    valor: kpis.emAndamento,          detalhe: `${fmt(kpis.valorEmDisputa)} em disputa`, icone: Clock, tom: 'info' },
    { rotulo: 'Taxa de vitória', valor: `${kpis.taxaVitoria}%`,    icone: Percent },
    { rotulo: 'Valor ganho',     valor: fmt(kpis.valorTotalGanho), detalhe: 'Adjudicado', icone: Banknote, tom: 'ok' },
    { rotulo: 'Pregões',         valor: kpis.pregoes,              icone: Gavel },
    { rotulo: 'Dispensas',       valor: kpis.dispensas,            icone: FileText },
    { rotulo: 'Total processos', valor: kpis.totalProcessos,       icone: Layers },
  ];

  return <FaixaIndicadores itens={itens} />;
}
