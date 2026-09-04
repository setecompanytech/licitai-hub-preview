import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingDown, ShieldCheck, ShieldAlert, ShieldQuestion, Info } from 'lucide-react';
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
        { chave: 'alta', rotulo: 'Três ou mais fontes', n: c.tresOuMais, icone: ShieldCheck, barra: 'bg-success', texto: 'text-success' },
        { chave: 'media', rotulo: 'Duas fontes', n: c.duas, icone: ShieldCheck, barra: 'bg-success/55', texto: 'text-muted-foreground' },
        { chave: 'baixa', rotulo: 'Uma fonte só', n: c.uma, icone: ShieldAlert, barra: 'bg-warning', texto: 'text-warning' },
        { chave: 'sem', rotulo: 'Sem cotação', n: c.semCotacao, icone: ShieldQuestion, barra: 'bg-muted-foreground/35', texto: 'text-muted-foreground' },
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
      <div className="lg:col-span-3 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-success" aria-hidden="true" />
            Economia por item
          </h3>
          <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
            Referência do edital × cotado
          </span>
        </div>

        {semEconomia ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
            <Info className="w-6 h-6 text-muted-foreground/50" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Nenhum item cotado abaixo da referência ainda.</p>
            <p className="text-xs text-muted-foreground/80 max-w-xs">
              O gráfico aparece quando um item tiver valor de referência e valor cotado, e o cotado for menor.
            </p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={Math.max(180, dadosEconomia.length * 34)}>
              <BarChart data={dadosEconomia} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }} barCategoryGap={6}>
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v: number) => formatBRL(v)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="nome"
                  width={170}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.4 }}
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number) => [formatBRL(v), 'Economia']}
                  labelFormatter={(_, p) => p?.[0]?.payload?.completo ?? ''}
                />
                <Bar dataKey="economia" radius={[0, 4, 4, 0]} fill="hsl(var(--success))" />
              </BarChart>
            </ResponsiveContainer>
            {stats.economiaPorItem.length === 10 && (
              <p className="text-xs text-muted-foreground mt-2">
                Dez maiores economias da planilha.
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Confiança das cotações ────────────────────────────────────────
          Quatro linhas nomeadas. A contagem e a proporção estão escritas,
          então quem não distingue as cores lê o mesmo que todo mundo. */}
      <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-1">
          <ShieldCheck className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          Confiança das cotações
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Quantas fontes independentes sustentam o preço de cada item.
        </p>

        {niveis.total === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Planilha vazia.</p>
        ) : (
          <ul className="space-y-3.5 list-none m-0 p-0">
            {niveis.linhas.map((l) => {
              const pct = niveis.total > 0 ? Math.round((l.n / niveis.total) * 100) : 0;
              const Icone = l.icone;
              return (
                <li key={l.chave}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icone className={`w-3.5 h-3.5 shrink-0 ${l.texto}`} aria-hidden="true" />
                    <span className="text-xs text-foreground">{l.rotulo}</span>
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      <span className="font-semibold text-foreground">{l.n}</span> · {pct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${l.barra} transition-[width] duration-500 motion-reduce:transition-none`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border/60 leading-relaxed">
          A Lei 14.133/2021 (art. 23) trata a pesquisa de preços como conjunto de
          fontes. Item com uma fonte só sustenta menos a estimativa.
        </p>
      </div>
    </div>
  );
}
