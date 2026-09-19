import { Clock, DollarSign, Layers, Trophy, TrendingUp, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { AnalyticsKpis } from '@/hooks/useAnalyticsData';
import { destinoDoRecorte, type RecorteId } from '@/lib/licitacao/recortes-do-painel';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Variante densa do ResumoOperacional — usa KpiStrip (linha horizontal) em vez
 * de StatCard (grade de cartões). Mantém toda a lógica de navegação existente:
 * cada KPI clicável leva à listagem filtrada pelo mesmo predicado que o conta.
 *
 * Use em telas que precisam de densidade de informação maior (ex: painel
 * executivo, visão gerencial). O ResumoOperacional original permanece intacto.
 */

interface Props {
  kpis: AnalyticsKpis;
  carregando: boolean;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

interface KpiConfig {
  rotulo: string;
  valor: string | null;
  sub?: string;
  recorte?: RecorteId;
  clicavel: boolean;
}

export default function ResumoOperacionalKpiStrip({ kpis, carregando }: Props) {
  if (carregando) {
    return (
      <div className="ds-kpi-strip" role="status" aria-busy="true">
        <span className="sr-only">Carregando indicadores</span>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="ds-kpi">
            <Skeleton className="mb-2 h-3 w-24 rounded" />
            <Skeleton className="h-6 w-16 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const decididos = kpis.ganhas + kpis.perdidas;
  const taxaVitoria = decididos > 0
    ? `${((kpis.ganhas / decididos) * 100).toFixed(1)}%`
    : null;

  const itens: KpiConfig[] = [
    {
      rotulo: 'Total de processos',
      valor: kpis.totalProcessos.toLocaleString('pt-BR'),
      recorte: 'todos',
      clicavel: true,
    },
    {
      rotulo: 'Em andamento',
      valor: kpis.emAndamento.toLocaleString('pt-BR'),
      recorte: 'andamento',
      clicavel: true,
    },
    {
      rotulo: 'Ganhas',
      valor: kpis.ganhas.toLocaleString('pt-BR'),
      sub: taxaVitoria ? `${taxaVitoria} de vitória` : undefined,
      recorte: 'ganhas',
      clicavel: true,
    },
    {
      rotulo: 'Perdidas',
      valor: kpis.perdidas.toLocaleString('pt-BR'),
      recorte: 'perdidas',
      clicavel: true,
    },
    {
      rotulo: 'Taxa de vitória',
      valor: taxaVitoria ?? '—',
      sub: taxaVitoria ? undefined : 'Nenhum processo decidido',
      clicavel: false,
    },
    {
      rotulo: 'Valor ganho',
      valor: kpis.valorTotalGanho > 0 ? formatCurrency(kpis.valorTotalGanho) : '—',
      clicavel: false,
    },
  ];

  return (
    <div className="ds-kpi-strip" role="region" aria-label="Resumo operacional">
      {itens.map((item) => {
        if (item.clicavel && item.recorte) {
          const destino = destinoDoRecorte(item.recorte);
          return (
            <Link
              key={item.rotulo}
              to={destino}
              className={cn(
                'ds-kpi block transition-colors',
                'hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              )}
              aria-label={`${item.rotulo}: ${item.valor}. Ver na listagem`}
            >
              <div className="ds-kpi__label">{item.rotulo}</div>
              <div className="ds-kpi__value">{item.valor}</div>
              {item.sub && <div className="ds-kpi__sub">{item.sub}</div>}
            </Link>
          );
        }
        return (
          <div key={item.rotulo} className="ds-kpi">
            <div className="ds-kpi__label">{item.rotulo}</div>
            <div className="ds-kpi__value">{item.valor}</div>
            {item.sub && <div className="ds-kpi__sub">{item.sub}</div>}
          </div>
        );
      })}
    </div>
  );
}
