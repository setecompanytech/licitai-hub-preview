import { useMemo } from 'react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, LayoutDashboard, Wallet,
} from 'lucide-react';
import { useResumoFinanceiro } from '@/hooks/useFinanceiro';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Herói do Financeiro — o bloco de saldo, os quatro números do dia e a curva
 * dos últimos meses, como no protótipo (`data-view="financeiro"`, o `.hero` e
 * a `.kpi-fin`).
 *
 * ADITIVO de propósito: entra ACIMA do FinHomeHub, que continua inteiro. O hub
 * tem 748 linhas de busca, favoritos e recentes que funcionam; reescrevê-lo
 * para encaixar um cabeçalho seria trocar risco por estética.
 *
 * TUDO AQUI É DADO REAL. `useResumoFinanceiro` já é chamado pelo módulo e
 * devolve saldoTotal, aPagar, aReceber e o fluxo de 6 meses — então o gráfico
 * não custa consulta nova. Foi o que decidiu esta tela ser a primeira: o
 * desenho do protótipo e os dados que o app já tem coincidem.
 */

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const brlCompacto = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

const mesCurto = (iso: string) => {
  const [ano, mes] = iso.split('-');
  return new Date(Number(ano), Number(mes) - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '');
};

interface Props {
  onNavigate: (id: string) => void;
}

export default function FinHeroPainel({ onNavigate }: Props) {
  const { data, isLoading } = useResumoFinanceiro();

  const fluxo = useMemo(
    () => (data?.fluxo ?? []).map((f) => ({ ...f, rotulo: mesCurto(f.mes) })),
    [data?.fluxo],
  );

  /* Projeção = o que está em caixa mais o que entra menos o que sai. Não é
     previsão estatística, e o rótulo diz isso: "se tudo for liquidado". */
  const projecao = (data?.saldoTotal ?? 0) + (data?.aReceber ?? 0) - (data?.aPagar ?? 0);

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Skeleton className="h-[196px] rounded-2xl lg:col-span-2" />
        <Skeleton className="h-[196px] rounded-2xl" />
      </div>
    );
  }

  const kpis = [
    { rot: 'A receber', val: data?.aReceber ?? 0, ic: ArrowUpRight, tom: 'success' as const, ir: 'a_receber' },
    { rot: 'A pagar', val: data?.aPagar ?? 0, ic: ArrowDownRight, tom: 'destructive' as const, ir: 'a_pagar' },
    { rot: 'Realizado no mês', val: data?.realizadoMes ?? 0, ic: Wallet, tom: 'neutro' as const, ir: 'lancamentos' },
  ];

  return (
    <div className="mb-4 grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
      {/* Saldo + curva — o cartão navy do protótipo */}
      <div className="lg:col-span-2 rounded-2xl bg-gradient-dark text-white p-5 sm:p-6 shadow-md overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-white/60">
              Saldo em contas
            </p>
            <p className="text-3xl sm:text-4xl font-bold tabular-nums leading-none mt-2">
              {brl(data?.saldoTotal ?? 0)}
            </p>
            <p className="text-sm text-white/70 mt-2">
              Projeção{' '}
              <span className="font-semibold text-white tabular-nums">{brl(projecao)}</span>{' '}
              <span className="text-white/50">se tudo for liquidado</span>
            </p>
          </div>

          <button
            onClick={() => onNavigate('panorama')}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider bg-white/10 hover:bg-white/20 border border-white/20 px-3.5 py-2 rounded-lg transition-colors"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Painel completo
          </button>
        </div>

        {/* Entradas e saídas dos últimos 6 meses. `realizado` e `conciliado`
            apenas — previsto não é fluxo de caixa, é intenção. */}
        <div className="h-[104px] mt-5 -mx-2">
          {fluxo.length === 0 ? (
            <p className="text-sm text-white/50 px-2">Sem movimento registrado nos últimos meses.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fluxo} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="fin-entrada" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fin-saida" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.10)" vertical={false} />
                <XAxis
                  dataKey="rotulo"
                  tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.55)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 10,
                    fontSize: 12,
                    color: 'hsl(var(--foreground))',
                  }}
                  formatter={(v: number, n: string) => [brl(v), n === 'entrada' ? 'Entradas' : 'Saídas']}
                />
                <Area type="monotone" dataKey="entrada" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#fin-entrada)" />
                <Area type="monotone" dataKey="saida" stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#fin-saida)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Os três números do dia */}
      <div className="grid gap-3 content-start">
        {kpis.map(({ rot, val, ic: Icone, tom, ir }) => (
          <button
            key={rot}
            onClick={() => onNavigate(ir)}
            className="text-left rounded-xl border border-border bg-card p-4 hover:border-accent transition-colors"
          >
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Icone
                className="w-3.5 h-3.5"
                style={tom === 'neutro' ? undefined : { color: `hsl(var(--${tom}))` }}
                aria-hidden="true"
              />
              {rot}
            </span>
            <span className="block text-2xl font-bold tabular-nums mt-1.5">{brlCompacto(val)}</span>
          </button>
        ))}

        {/* A faixa de alerta do protótipo só aparece quando há o que alertar.
            Faixa permanente vira paisagem e para de ser lida. */}
        {(data?.aPagar ?? 0) > (data?.saldoTotal ?? 0) && (
          <div className="flex items-start gap-2 rounded-xl border border-warning-line bg-warning-tint px-4 py-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-warning-ink" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-warning-ink">
              O total a pagar supera o saldo em contas. Confira o{' '}
              <button onClick={() => onNavigate('fluxo_caixa')} className="font-bold underline underline-offset-2">
                fluxo de caixa
              </button>{' '}
              antes de novos compromissos.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
