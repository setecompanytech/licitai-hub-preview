import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
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

const DEGRAUS = 6;

/**
 * Mapa de calor de licitações por estado — a malha oficial do IBGE ao lado do
 * ranking dos estados de maior volume.
 *
 * A intensidade sai da escala `--map-1..6` de `index.css`. Os seis degraus são
 * distribuídos por FAIXA do maior volume, não por posição no ranking: um estado
 * com metade do volume do primeiro cai no meio da escala, e não no segundo tom.
 * É o que faz a concentração aparecer — sem isso, seis estados quaisquer
 * pintariam os seis tons e o mapa diria que todos são parecidos.
 *
 * Rampa de um matiz só, do claro ao escuro: é a forma certa para GRANDEZA.
 * Escala categórica (uma cor por estado) diria que os estados são categorias
 * diferentes, quando o que muda entre eles é quanto — não o quê.
 *
 * Passar o cursor acende o estado no mapa E a linha na lista, nos dois
 * sentidos. Sem essa ligação, quem lê "São Paulo 22" na lista precisa procurar
 * São Paulo no mapa a olho.
 */
export default function MapaLicitacoesPorEstado({ dados, limite = 6 }: Props) {
  const [ufFoco, setUfFoco] = useState<string | null>(null);

  const { porUF, maior, ranking, semEstado } = useMemo(() => {
    /* "N/I" não é estado: é licitação sem UF preenchida. Ela não tem contorno
       para pintar, e listá-la entre os estados a faz parecer um — no painel de
       ontem ela aparecia em segundo lugar, acima do Pará. Sai do ranking e vira
       nota, que é o que ela é: um buraco no cadastro, não um lugar. */
    const validos = dados.filter((d) => CONTORNOS_UF.some((c) => c.uf === d.uf));
    const perdidos = dados
      .filter((d) => !CONTORNOS_UF.some((c) => c.uf === d.uf))
      .reduce((s, d) => s + d.total, 0);

    return {
      porUF: new Map(validos.map((d) => [d.uf, d.total])),
      maior: Math.max(0, ...validos.map((d) => d.total)),
      ranking: [...validos].filter((d) => d.total > 0).sort((a, b) => b.total - a.total).slice(0, limite),
      semEstado: perdidos,
    };
  }, [dados, limite]);

  const nomeDe = (uf: string) => CONTORNOS_UF.find((c) => c.uf === uf)?.nome ?? uf;

  /** Em qual dos seis degraus este volume cai. Zero fica fora da escala. */
  const degrau = (total: number) => {
    if (!total || maior <= 0) return null;
    return Math.min(DEGRAUS, Math.max(1, Math.ceil((total / maior) * DEGRAUS)));
  };

  const focoTotal = ufFoco ? porUF.get(ufFoco) ?? 0 : null;
  const vazio = ranking.length === 0;

  return (
    <Card className="p-5 sm:p-6">
      {vazio ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhuma licitação com estado informado ainda.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-center [&>*]:min-w-0">
          <div>
            <ul className="flex flex-col list-none m-0 p-0">
              {ranking.map((e) => {
                const aceso = ufFoco === e.uf;
                const passo = degrau(e.total);
                return (
                  <li key={e.uf}>
                    <button
                      type="button"
                      onMouseEnter={() => setUfFoco(e.uf)}
                      onMouseLeave={() => setUfFoco(null)}
                      onFocus={() => setUfFoco(e.uf)}
                      onBlur={() => setUfFoco(null)}
                      className={cn(
                        'w-full flex items-center gap-3 px-2 -mx-2 py-2 rounded-lg text-left transition-colors',
                        'border-b border-border/60 last:border-0 rounded-b-none',
                        aceso && 'bg-muted/70',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="w-2.5 h-2.5 rounded-sm shrink-0 ring-1 ring-inset ring-border/50"
                        style={{ background: passo ? `hsl(var(--map-${passo}))` : 'hsl(var(--muted))' }}
                      />
                      <span className="text-sm truncate flex-1">{nomeDe(e.uf)}</span>
                      <span className="text-sm tabular-nums text-muted-foreground shrink-0">
                        {e.total.toLocaleString('pt-BR')}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {semEstado > 0 && (
              /* Honestidade do gráfico: se um terço dos processos não entra no
                 mapa, dizer isso vale mais que pintar um estado a mais. */
              <p className="text-xs text-muted-foreground mt-3 flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
                <span>
                  <strong className="text-foreground font-medium">{semEstado.toLocaleString('pt-BR')}</strong>{' '}
                  {semEstado === 1 ? 'processo está' : 'processos estão'} sem estado informado e
                  {semEstado === 1 ? ' fica' : ' ficam'} fora do mapa.
                </span>
              </p>
            )}

            <Link
              to="/analytics"
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-accent hover:underline"
            >
              Ver mais
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>

          <div className="w-full">
            {/* Legenda da escala. Sem ela o degradê é decoração: nada diz que
                azul-escuro é "mais". */}
            <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
              <span className="shrink-0">Menos</span>
              <div className="flex flex-1 max-w-[160px] h-2 rounded-full overflow-hidden ring-1 ring-inset ring-border/60">
                {Array.from({ length: DEGRAUS }, (_, i) => (
                  <span key={i} className="flex-1" style={{ background: `hsl(var(--map-${i + 1}))` }} />
                ))}
              </div>
              <span className="shrink-0">Mais</span>
              <span className="ml-auto tabular-nums shrink-0">até {maior.toLocaleString('pt-BR')}</span>
            </div>

            <div className="max-w-[440px] w-full mx-auto">
              <svg
                viewBox={MAPA_VIEWBOX}
                className="w-full h-auto overflow-visible"
                role="img"
                aria-label="Mapa do Brasil com o volume de licitações por estado"
              >
                {CONTORNOS_UF.map((c) => {
                  const total = porUF.get(c.uf) ?? 0;
                  const passo = degrau(total);
                  const aceso = ufFoco === c.uf;
                  return (
                    <path
                      key={c.uf}
                      d={c.d}
                      onMouseEnter={() => setUfFoco(c.uf)}
                      onMouseLeave={() => setUfFoco(null)}
                      className="transition-[fill,stroke] duration-150 cursor-default"
                      style={{
                        fill: passo ? `hsl(var(--map-${passo}))` : 'hsl(var(--muted) / 0.7)',
                        stroke: aceso ? 'hsl(var(--foreground))' : 'hsl(var(--card))',
                        strokeWidth: aceso ? 1.6 : 0.8,
                        strokeLinejoin: 'round',
                        paintOrder: 'stroke',
                      }}
                    >
                      <title>{c.nome}: {total.toLocaleString('pt-BR')}</title>
                    </path>
                  );
                })}

                {/* Siglas só nos estados que comportam o texto. Em AL, SE, DF ou
                    RJ a sigla ficaria maior que o próprio estado. */}
                {CONTORNOS_UF.filter((c) => c.area > 900).map((c) => (
                  <text
                    key={`r-${c.uf}`}
                    x={c.cx}
                    y={c.cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="pointer-events-none select-none"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      fill: (degrau(porUF.get(c.uf) ?? 0) ?? 0) >= 5
                        ? 'hsl(var(--card))'
                        : 'hsl(var(--muted-foreground))',
                    }}
                  >
                    {c.uf}
                  </text>
                ))}
              </svg>
            </div>

            {/* Legenda do foco. Altura fixa para o cartão não pular quando o
                cursor entra e sai do mapa. */}
            <p className="text-sm text-center mt-2 h-5" aria-live="polite">
              {ufFoco ? (
                <>
                  <span className="font-medium">{nomeDe(ufFoco)}</span>
                  <span className="text-muted-foreground">
                    {' · '}
                    {focoTotal === 0
                      ? 'nenhuma licitação'
                      : `${focoTotal?.toLocaleString('pt-BR')} ${focoTotal === 1 ? 'licitação' : 'licitações'}`}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">Passe o cursor para ver o estado</span>
              )}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
