import { useMemo } from 'react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, LayoutDashboard, Wallet,
} from 'lucide-react';
import { useResumoFinanceiro } from '@/hooks/useFinanceiro';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

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
 *
 * Identidade 12/09: o cartão navy virou cartão claro — a linguagem nova é de
 * fundo claro, com navy só no texto e verde só na ação.
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

const TOM_ICONE = {
  success: 'text-success',
  destructive: 'text-destructive',
  neutro: 'text-muted-foreground',
} as const;

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
      <div className="grid gap-4 lg:grid-cols-3" role="status" aria-label="Carregando resumo financeiro">
        <Skeleton className="h-48 rounded-lg lg:col-span-2" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  const kpis = [
    { rot: 'A receber', val: data?.aReceber ?? 0, ic: ArrowUpRight, tom: 'success' as const, ir: 'a_receber' },
    { rot: 'A pagar', val: data?.aPagar ?? 0, ic: ArrowDownRight, tom: 'destructive' as const, ir: 'a_pagar' },
    { rot: 'Realizado no mês', val: data?.realizadoMes ?? 0, ic: Wallet, tom: 'neutro' as const, ir: 'lancamentos' },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
      {/* Saldo + curva — o cartão de destaque, agora claro */}
      <div className="lg:col-span-2 rounded-lg border border-border bg-card p-6 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">
              Saldo em contas
            </p>
            <p className="mt-1 text-[2rem] leading-10 font-bold tabular-nums text-foreground">
              {brl(data?.saldoTotal ?? 0)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Projeção{' '}
              <span className="font-semibold text-foreground tabular-nums">{brl(projecao)}</span>{' '}
              <span>se tudo for liquidado</span>
            </p>
          </div>

          <Button variant="outline" onClick={() => onNavigate('panorama')}>
            <LayoutDashboard aria-hidden="true" />
            Painel completo
          </Button>
        </div>

        {/* Entradas e saídas dos últimos 6 meses. `realizado` e `conciliado`
            apenas — previsto não é fluxo de caixa, é intenção. */}
        <div className="h-28 mt-6 -mx-2">
          {fluxo.length === 0 ? (
            <p className="text-sm text-muted-foreground px-2">Sem movimento registrado nos últimos meses.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fluxo} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="fin-entrada" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fin-saida" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="rotulo"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
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
            type="button"
            onClick={() => onNavigate(ir)}
            className="text-left rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Icone className={`w-4 h-4 ${TOM_ICONE[tom]}`} aria-hidden="true" />
              {rot}
            </span>
            <span className="block text-2xl font-bold tabular-nums mt-1 text-foreground">{brlCompacto(val)}</span>
          </button>
        ))}

        {/* A faixa de alerta do protótipo só aparece quando há o que alertar.
            Faixa permanente vira paisagem e para de ser lida. */}
        {(data?.aPagar ?? 0) > (data?.saldoTotal ?? 0) && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-warning-line bg-warning-tint px-4 py-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-warning-ink" aria-hidden="true" />
            <p className="text-sm text-warning-ink">
              O total a pagar supera o saldo em contas. Confira o{' '}
              <button type="button" onClick={() => onNavigate('fluxo_caixa')} className="font-semibold underline underline-offset-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
