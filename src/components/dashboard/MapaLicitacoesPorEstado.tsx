import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { CONTORNOS_UF, MAPA_VIEWBOX } from './mapa-brasil-contornos';

interface VolumePorUF {
  uf: string;
  total: number;
}

interface Props {
  /** Volume por unidade da federação. Vem de `useAnalyticsData().ufBreakdown`. */
  dados: VolumePorUF[];
  /** Quantos estados a lista ao lado do mapa exibe. */
  limite?: number;
}

/**
 * Mapa de calor de licitações por estado — a silhueta do Brasil ao lado do
 * ranking dos estados de maior volume.
 *
 * A intensidade sai da escala `--map-1..6` de `index.css`. Os seis degraus são
 * distribuídos por FAIXA do maior volume, não por posição no ranking: um estado
 * com metade do volume do primeiro cai no meio da escala, e não no segundo tom.
 * É o que faz a concentração aparecer — sem isso, seis estados quaisquer
 * pintariam os seis tons e o mapa diria que todos são parecidos.
 */
export default function MapaLicitacoesPorEstado({ dados, limite = 6 }: Props) {
  const porUF = new Map(dados.map((d) => [d.uf, d.total]));
  const maior = Math.max(0, ...dados.map((d) => d.total));

  const ranking = [...dados]
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limite);

  const nomeDe = (uf: string) => CONTORNOS_UF.find((c) => c.uf === uf)?.nome ?? uf;

  /** Em qual dos seis degraus este volume cai. Zero fica fora da escala. */
  const degrau = (total: number) => {
    if (!total || maior <= 0) return null;
    const passo = Math.ceil((total / maior) * 6);
    return Math.min(6, Math.max(1, passo));
  };

  return (
    <Card className="p-5 sm:p-6">
      <h3 className="text-lg font-semibold mb-4">Licitações por estado</h3>

      {ranking.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhuma licitação com estado informado ainda.
        </p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr] lg:items-center [&>*]:min-w-0">
          <div>
            <ul className="flex flex-col">
              {ranking.map((e) => (
                <li
                  key={e.uf}
                  className="flex items-baseline justify-between gap-4 py-2 border-b border-border/60 last:border-0"
                >
                  <span className="text-sm truncate">{nomeDe(e.uf)}</span>
                  <span className="text-sm tabular-nums text-muted-foreground shrink-0">
                    {e.total.toLocaleString('pt-BR')}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              to="/analytics"
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-accent hover:underline"
            >
              Ver mais
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>

          <div className="max-w-[420px] w-full mx-auto">
            <svg
              viewBox={MAPA_VIEWBOX}
              className="w-full h-auto"
              role="img"
              aria-label="Mapa do Brasil com o volume de licitações por estado"
            >
              {CONTORNOS_UF.map((c) => {
                const total = porUF.get(c.uf) ?? 0;
                const passo = degrau(total);
                return (
                  <path
                    key={c.uf}
                    d={c.d}
                    style={{
                      fill: passo ? `hsl(var(--map-${passo}))` : 'hsl(var(--muted))',
                      stroke: 'hsl(var(--card))',
                    }}
                    strokeWidth={1}
                  >
                    <title>
                      {c.nome}: {total.toLocaleString('pt-BR')}
                    </title>
                  </path>
                );
              })}
            </svg>
          </div>
        </div>
      )}
    </Card>
  );
}
