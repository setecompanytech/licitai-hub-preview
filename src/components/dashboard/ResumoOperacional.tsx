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
 * perde a credibilidade inteira — não só naquele cartão.
 *
 * Por isso os quatro cartões de processo apontam para a listagem do painel com
 * `?recorte=`, e o recorte é o MESMO predicado que conta o cartão
 * (`lib/licitacao/recortes-do-painel`). Não são duas contas parecidas: é a
 * mesma função aplicada aos mesmos dados, então o número e a quantidade de
 * linhas não podem divergir.
 *
 * Os dois cartões que NÃO clicam:
 *
 *   Taxa de vitória — é uma razão entre dois conjuntos, não um conjunto.
 *     Nenhuma listagem "mostra 43,5%".
 *   Valor ganho — é uma soma. A listagem filtrada mostra os mesmos processos,
 *     mas totaliza `valor_estimado`, não `valor_adjudicado || estimado`: o
 *     total da tela de destino sairia diferente do número do cartão.
 *
 * E a taxa de vitória NÃO é 0% quando não há processo decidido: é indivisível.
 * Zero afirmaria que a empresa perdeu tudo o que disputou.
 */

interface Props {
  kpis: AnalyticsKpis;
  carregando: boolean;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

export default function ResumoOperacional({ kpis, carregando }: Props) {
  if (carregando) {
    return (
      <div role="status" aria-busy="true" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <span className="sr-only">Carregando os indicadores</span>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[120px] w-full rounded-xl" />
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
    { rotulo: 'Em andamento', valor: kpis.emAndamento, icone: Clock, tom: 'warning', recorte: 'andamento' },
    { rotulo: 'Ganhas', valor: kpis.ganhas, icone: Trophy, tom: 'success', recorte: 'ganhas' },
    { rotulo: 'Perdidas', valor: kpis.perdidas, icone: XCircle, tom: 'destructive', recorte: 'perdidas' },
  ];

  return (
    <div className="space-y-4">
      {/* Quatro colunas quando há espaço, duas no tablet e no celular — a
          grade que o comando fixou. Os cartões são compactos justamente para
          caberem quatro sem encolher o número. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 [&>*]:min-w-0">
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
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
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
          tone="neutral"
          motivoSemDestino="Soma: a listagem de ganhos totaliza o valor estimado, e o total sairia diferente deste"
        />
      </div>
    </div>
  );
}
