import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingDown, ShieldCheck, ShieldAlert, ShieldQuestion, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import EstadoVazio from '@/components/shared/EstadoVazio';
import type { EstatisticasPlanilha } from './PlanilhaCustosEdital';

/* REBRAND — os dois gráficos que o protótipo pede na Precificação
   ("Economia por Item" e "Confiança das Cotações").

   Os dois leem DADO REAL da planilha aberta, sem consulta nova: a varredura que
   já apurava os cartões do topo passou a devolver também o detalhe por item e a
   contagem de fontes. Nenhuma tarja de exemplo aqui — não há número inventado.

   Duas decisões de forma vieram de medição, não de gosto:

   1. A confiança NÃO é barra empilhada. Os três status naturais (verde/laranja/
      vermelho) reprovam separação: #B91C1C e #B45309 ficam a ΔE 9,1 para visão
      normal e 4,9 na deuteranopia — encostados numa pilha, são a mesma faixa.
   2. Nem virou rampa de verde. O passo claro necessário para a rampa respirar
      (#8DCEA5) dá 1,78:1 contra o fundo claro: invisível.

   Então a identidade saiu da cor e foi para o RÓTULO — quatro linhas nomeadas,
   cada uma com contagem e proporção. A cor só reforça, e o gráfico continua
   legível em preto e branco, na deuteranopia e com a folha impressa. */

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const TOOLTIP_STYLE = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: 12,
  color: 'hsl(var(--foreground))',
};

function encurtar(s: string, n = 30) {
  const limpo = s.trim();
  return limpo.length > n ? `${limpo.slice(0, n - 1)}…` : limpo;
}

interface Props {
  stats: EstatisticasPlanilha;
}

export default function PrecoGraficos({ stats }: Props) {
  const dadosEconomia = useMemo(
    () => stats.economiaPorItem.map((i) => ({
      nome: encurtar(i.descricao),
      completo: i.descricao,
      economia: Math.round(i.economia),
      referencia: i.referencia,
      cotado: i.cotado,
    })),
    [stats.economiaPorItem],
  );

  const niveis = useMemo(() => {
    const c = stats.confianca;
    const total = c.tresOuMais + c.duas + c.uma + c.semCotacao;
    return {
      total,
      linhas: [
        { chave: 'alta', rotulo: 'Três ou mais fontes', n: c.tresOuMais, icone: ShieldCheck, barra: 'bg-success', texto: 'text-success-ink' },
        { chave: 'media', rotulo: 'Duas fontes', n: c.duas, icone: ShieldCheck, barra: 'bg-success-line', texto: 'text-muted-foreground' },
        { chave: 'baixa', rotulo: 'Uma fonte só', n: c.uma, icone: ShieldAlert, barra: 'bg-warning', texto: 'text-warning-ink' },
        { chave: 'sem', rotulo: 'Sem cotação', n: c.semCotacao, icone: ShieldQuestion, barra: 'bg-foreground-tertiary', texto: 'text-muted-foreground' },
      ],
    };
  }, [stats.confianca]);

  const semEconomia = dadosEconomia.length === 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* ── Economia por item ─────────────────────────────────────────────
          Uma série só, então sem legenda: o título já a nomeia. Barra
          horizontal porque descrição de item de edital é texto longo — em
          barra vertical o rótulo vira diagonal ilegível. */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm lg:col-span-3">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-base font-semibold leading-6 text-foreground">
            <TrendingDown className="h-5 w-5 text-success-ink" aria-hidden="true" />
            Economia por item
          </h3>
          <Badge variant="muted">
            Referência do edital × cotado
          </Badge>
        </div>

        {semEconomia ? (
          <EstadoVazio
            tamanho="compacto"
            icone={<Info />}
            titulo="Nenhum item cotado abaixo da referência ainda"
            descricao="O gráfico aparece quando um item tiver valor de referência e valor cotado, e o cotado for menor."
          />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={Math.max(180, dadosEconomia.length * 34)}>
              <BarChart data={dadosEconomia} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }} barCategoryGap={6}>
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v: number) => formatBRL(v)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="nome"
                  width={170}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.4 }}
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number) => [formatBRL(v), 'Economia']}
                  labelFormatter={(_, p) => p?.[0]?.payload?.completo ?? ''}
                />
                <Bar dataKey="economia" radius={[0, 4, 4, 0]} fill="hsl(var(--chart-1))" />
              </BarChart>
            </ResponsiveContainer>
            {stats.economiaPorItem.length === 10 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Dez maiores economias da planilha.
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Confiança das cotações ────────────────────────────────────────
          Quatro linhas nomeadas. A contagem e a proporção estão escritas,
          então quem não distingue as cores lê o mesmo que todo mundo. */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm lg:col-span-2">
        <h3 className="mb-1 flex items-center gap-2 text-base font-semibold leading-6 text-foreground">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Confiança das cotações
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Quantas fontes independentes sustentam o preço de cada item.
        </p>

        {niveis.total === 0 ? (
          <EstadoVazio tamanho="compacto" titulo="Planilha vazia." />
        ) : (
          <ul className="space-y-3.5 list-none m-0 p-0">
            {niveis.linhas.map((l) => {
              const pct = niveis.total > 0 ? Math.round((l.n / niveis.total) * 100) : 0;
              const Icone = l.icone;
              return (
                <li key={l.chave}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <Icone className={`h-4 w-4 shrink-0 ${l.texto}`} aria-hidden="true" />
                    <span className="text-sm text-foreground">{l.rotulo}</span>
                    <span className="ml-auto text-sm tabular-nums text-muted-foreground">
                      <span className="font-semibold text-foreground">{l.n}</span> · {pct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-sm bg-muted">
                    <div
                      className={`h-full rounded-sm ${l.barra} transition-[width] duration-500 motion-reduce:transition-none`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
          A Lei 14.133/2021 (art. 23) trata a pesquisa de preços como conjunto de
          fontes. Item com uma fonte só sustenta menos a estimativa.
        </p>
      </div>
    </div>
  );
}
