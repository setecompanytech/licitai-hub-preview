import { Clock, DollarSign, Layers, Trophy, TrendingUp, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import StatCard, { type StatTone } from './StatCard';
import type { AnalyticsKpis } from '@/hooks/useAnalyticsData';
import { destinoDoRecorte, type RecorteId } from '@/lib/licitacao/recortes-do-painel';

/**
 * Resumo operacional — os números da operação, cada um levando à listagem que
 * o reproduz.
 *
 * ── POR QUE ALGUNS CARTÕES CLICAM E OUTROS NÃO ───────────────────────────
 *
 * O comando pede "cada indicador clicável abre a listagem com o filtro
 * correspondente". A armadilha é ligar um número a um filtro que dá OUTRA
 * conta: a pessoa clica em "Ganhas 12", a lista abre com 9 linhas, e o painel
 * perde a credibilidade inteira.
 *
 * Por isso os quatro cartões de processo apontam para a listagem do painel com
 * `?recorte=`, e o recorte é o MESMO predicado que conta o cartão
 * (`lib/licitacao/recortes-do-painel`).
 *
 * Os dois cartões que NÃO clicam:
 *
 *   Taxa de vitória — é uma razão entre dois conjuntos, não um conjunto.
 *   Valor ganho — é uma soma; a listagem totaliza `valor_estimado`, não
 *     `valor_adjudicado || estimado`, e o total sairia diferente.
 *
 * E a taxa de vitória NÃO é 0% quando não há processo decidido: é indivisível.
 */

interface Props {
  kpis: AnalyticsKpis;
  carregando: boolean;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

/** Seis cartões numa fileira só no desktop largo; três no tablet; dois no celular. */
const GRADE = 'grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6 [&>*]:min-w-0';

export default function ResumoOperacional({ kpis, carregando }: Props) {
  if (carregando) {
    return (
      <div role="status" aria-busy="true" className={GRADE}>
        <span className="sr-only">Carregando os indicadores</span>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[112px] w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const decididos = kpis.ganhas + kpis.perdidas;

  const processos: {
    rotulo: string;
    valor: number;
    icone: typeof Layers;
    tom: StatTone;
    recorte: RecorteId;
  }[] = [
    { rotulo: 'Processos da empresa', valor: kpis.totalProcessos, icone: Layers, tom: 'neutral', recorte: 'todos' },
    { rotulo: 'Em andamento', valor: kpis.emAndamento, icone: Clock, tom: 'info', recorte: 'andamento' },
    { rotulo: 'Ganhas', valor: kpis.ganhas, icone: Trophy, tom: 'success', recorte: 'ganhas' },
    { rotulo: 'Perdidas', valor: kpis.perdidas, icone: XCircle, tom: 'destructive', recorte: 'perdidas' },
  ];

  return (
    <div className={GRADE}>
      {processos.map((p) => (
        <StatCard
          key={p.rotulo}
          label={p.rotulo}
          value={p.valor.toLocaleString('pt-BR')}
          icon={p.icone}
          tone={p.tom}
          para={destinoDoRecorte(p.recorte)}
        />
      ))}
      <StatCard
        label="Taxa de vitória"
        value={decididos > 0 ? `${kpis.taxaVitoria.toLocaleString('pt-BR')}%` : null}
        razaoIndisponivel={decididos > 0 ? undefined : 'Nenhum processo decidido ainda'}
        change={decididos > 0 ? `${kpis.ganhas} de ${decididos} decididos` : undefined}
        icon={TrendingUp}
        tone="neutral"
        motivoSemDestino="Razão entre dois conjuntos — não há listagem que mostre um percentual"
      />
      <StatCard
        label="Valor ganho"
        value={formatCurrency(kpis.valorTotalGanho)}
        change="Adjudicado, ou estimado quando não há adjudicado"
        icon={DollarSign}
        tone="primary"
        motivoSemDestino="Soma: a listagem de ganhos totaliza o valor estimado, e o total sairia diferente deste"
      />
    </div>
  );
}
