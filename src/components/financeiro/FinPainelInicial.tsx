import { useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  ArrowDownCircle, ArrowRight, ArrowUpCircle, CalendarClock,
  CheckCheck, FileText, LayoutDashboard, Plus, QrCode, Search, Sparkles, Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useResumoFinanceiro, useResumoVisorFinanceiro, useProximasMovimentacoes } from '@/hooks/useFinanceiro';
import { formatBRL, formatDate, statusLabel, tipoLabel } from '@/lib/financeiro/formatters';
import FinConferencia from './FinConferencia';
import { HUB_ITEMS } from './FinHomeHub';

/**
 * O painel inicial do Financeiro (13/09/2026, referência do protótipo
 * `data-view="financeiro"`): faixa de KPIs, fluxo de caixa × o que vence nos
 * próximos dias, a conferência, as movimentações mais próximas e o atalho
 * direto para a operação do dia a dia.
 *
 * ADITIVO sobre o hub: entra ACIMA do `FinHomeHub`, que continua inteiro
 * logo abaixo — é ele que dá acesso às 49 subtelas por pasta/busca. Reescrevê
 * -lo para caber aqui trocaria uma busca e favoritos que funcionam por only
 * estética. Cada número aqui vem de `useResumoFinanceiro`/`useResumoVisorFinanceiro`
 * /`useProximasMovimentacoes` — nenhum dado ilustrativo.
 */

const STATUS_VARIANTE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'muted'> = {
  previsto: 'warning',
  realizado: 'success',
  conciliado: 'success',
  cancelado: 'muted',
  em_atraso: 'danger',
};

const ACOES_RAPIDAS = [
  { id: 'lancamentos', label: 'Novo lançamento', icon: Plus, primary: true },
  { id: 'conciliacao', label: 'Conciliar', icon: CheckCheck },
  { id: 'importar_ofx', label: 'Importar OFX', icon: Upload },
  { id: 'emissor_nfe', label: 'Emitir NF-e', icon: FileText },
  { id: 'pix_cobranca', label: 'Cobrança PIX', icon: QrCode },
  { id: 'baixa_lote', label: 'Baixa em lote', icon: Sparkles },
];

const mesCurto = (iso: string) => {
  const [ano, mes] = iso.split('-');
  return new Date(Number(ano), Number(mes) - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '');
};

interface Props {
  onNavigate: (id: string) => void;
}

export default function FinPainelInicial({ onNavigate }: Props) {
  const { data: resumo, isLoading: carregandoResumo } = useResumoFinanceiro();
  const { data: visor, isLoading: carregandoVisor } = useResumoVisorFinanceiro();
  const { data: proximas, isLoading: carregandoProximas } = useProximasMovimentacoes(5);
  const [buscaOperacao, setBuscaOperacao] = useState('');

  const fluxo = useMemo(
    () => (resumo?.fluxo ?? []).map((f) => ({ ...f, rotulo: mesCurto(f.mes) })),
    [resumo?.fluxo],
  );

  const saldoProjetado = (resumo?.saldoTotal ?? 0) + (resumo?.aReceber ?? 0) - (resumo?.aPagar ?? 0);
  const emAtraso = (visor?.hojePagar.atraso ?? 0) + (visor?.hojeReceber.atraso ?? 0);

  // Próximos 7 dias = hoje + 6, direto de `proximos10Dias` (10 posições, uma
  // por dia): net de entradas menos saídas previstas no período.
  const proximos7 = (visor?.proximos10Dias ?? []).slice(0, 7);
  const totalPagar7 = proximos7.reduce((s, d) => s + d.previstoPagar, 0);
  const totalReceber7 = proximos7.reduce((s, d) => s + d.previstoReceber, 0);
  const saldoInsuficiente = (visor?.saldoTotal ?? 0) < totalPagar7;

  const itensOperacao = useMemo(() => {
    const q = buscaOperacao.trim().toLowerCase();
    const base = HUB_ITEMS.filter((i) => i.group === 'operacao');
    if (!q) return base;
    return base.filter((i) => i.label.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
  }, [buscaOperacao]);

  const kpis = [
    {
      rotulo: 'Saldo disponível', valor: resumo?.saldoTotal ?? 0,
      sub: 'Saldo bancário consolidado', tom: 'neutro' as const,
    },
    {
      rotulo: 'Saldo projetado', valor: saldoProjetado,
      sub: 'Se tudo for liquidado', tom: saldoProjetado >= (resumo?.saldoTotal ?? 0) ? 'success' as const : 'destructive' as const,
    },
    {
      rotulo: 'A receber', valor: resumo?.aReceber ?? 0,
      sub: 'Em aberto', tom: 'success' as const, onClick: () => onNavigate('a_receber'),
    },
    {
      rotulo: 'A pagar', valor: resumo?.aPagar ?? 0,
      sub: 'Em aberto', tom: 'destructive' as const, onClick: () => onNavigate('a_pagar'),
    },
    {
      rotulo: 'Resultado no mês', valor: resumo?.realizadoMes ?? 0,
      sub: 'Realizado até hoje', tom: (resumo?.realizadoMes ?? 0) >= 0 ? 'success' as const : 'destructive' as const,
    },
    {
      rotulo: 'Em atraso', valor: emAtraso,
      sub: emAtraso > 0 ? 'Pagar + receber' : 'Nenhuma pendência', tom: emAtraso > 0 ? 'warning' as const : 'neutro' as const,
      onClick: () => onNavigate('panorama'),
    },
  ];

  const TOM_TEXTO: Record<string, string> = {
    neutro: 'text-foreground',
    success: 'text-success',
    destructive: 'text-destructive',
    warning: 'text-warning',
  };

  return (
    <div className="space-y-4">
      {/* ============ Faixa de KPIs ============ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <button
            key={k.rotulo}
            type="button"
            disabled={!k.onClick}
            onClick={k.onClick}
            className={cn(
              'min-w-0 rounded-lg border border-border bg-card p-3 text-left transition-colors',
              k.onClick && 'hover:border-primary/40 hover:bg-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <p className="truncate text-xs font-medium text-muted-foreground">{k.rotulo}</p>
            {carregandoResumo || carregandoVisor ? (
              <Skeleton className="mt-1.5 h-6 w-3/4" />
            ) : (
              <p className={cn('mt-0.5 truncate text-xl font-bold tabular-nums', TOM_TEXTO[k.tom])}>
                {formatBRL(k.valor)}
              </p>
            )}
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{k.sub}</p>
          </button>
        ))}
      </div>

      {/* ============ Fluxo de caixa + Hoje e próximos dias ============ */}
      <div className="grid gap-3 lg:grid-cols-[2fr_1fr] [&>*]:min-w-0">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-[15px] font-semibold text-foreground">Fluxo de caixa</h3>
            <span className="text-xs text-muted-foreground">Entradas e saídas por mês</span>
          </div>
          {carregandoResumo ? (
            <Skeleton className="h-56 w-full" />
          ) : fluxo.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Sem movimento registrado nos últimos meses.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={fluxo} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="rotulo" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }}
                  formatter={(v: number, n: string) => [formatBRL(v), n === 'entrada' ? 'Entradas' : 'Saídas']}
                />
                <Legend
                  formatter={(v) => (v === 'entrada' ? 'Entradas' : 'Saídas')}
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="entrada" name="entrada" fill="hsl(var(--success))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="saida" name="saida" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[15px] font-semibold text-foreground">Hoje e próximos dias</h3>
            <span className="text-xs text-muted-foreground">{formatDate(new Date())}</span>
          </div>

          {carregandoVisor ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onNavigate('a_receber')}
                className="flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ArrowDownCircle className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Receber hoje</p>
                  <p className="truncate text-sm font-semibold tabular-nums text-foreground">{formatBRL(visor?.hojeReceber.total ?? 0)}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('a_pagar')}
                className="flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ArrowUpCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Pagar hoje</p>
                  <p className="truncate text-sm font-semibold tabular-nums text-foreground">{formatBRL(visor?.hojePagar.total ?? 0)}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('calendario_financeiro')}
                className="flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">A pagar nos próximos 7 dias</p>
                  <p className="truncate text-sm font-semibold tabular-nums text-foreground">{formatBRL(totalPagar7)}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>

              {saldoInsuficiente && (
                <div className="rounded-lg border border-warning-line bg-warning-tint px-3 py-2.5">
                  <p className="text-xs font-semibold text-warning-ink">Atenção ao caixa disponível</p>
                  <p className="mt-0.5 text-xs text-warning-ink">
                    O saldo atual é inferior ao total a pagar nos próximos sete dias.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ============ Central de conferência ============ */}
      <FinConferencia onNavigate={onNavigate} />

      {/* ============ Próximas movimentações + Ações rápidas ============ */}
      <div className="grid gap-3 lg:grid-cols-[2fr_1fr] [&>*]:min-w-0">
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h3 className="text-[15px] font-semibold text-foreground">Próximas movimentações</h3>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('lancamentos')}>
              Ver todos <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
          {carregandoProximas ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : !proximas || proximas.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma movimentação prevista.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Data</th>
                    <th className="px-4 py-2 font-medium">Descrição</th>
                    <th className="px-4 py-2 font-medium">Tipo</th>
                    <th className="px-4 py-2 text-right font-medium">Valor</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {proximas.map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0">
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatDate(m.dataVencimento)}</td>
                      <td className="min-w-0 max-w-[220px] truncate px-4 py-2.5 font-medium text-foreground">{m.descricao}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{tipoLabel[m.tipo] ?? m.tipo}</td>
                      <td className={cn(
                        'whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums',
                        m.tipo === 'a_receber' ? 'text-success' : 'text-destructive',
                      )}>
                        {m.tipo === 'a_receber' ? '+ ' : '- '}{formatBRL(m.valor)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <Badge variant={STATUS_VARIANTE[m.status] ?? 'muted'}>{statusLabel[m.status] ?? m.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-[15px] font-semibold text-foreground">Ações rápidas</h3>
          <div className="grid grid-cols-2 gap-2">
            {ACOES_RAPIDAS.map((a) => (
              <Button
                key={a.id}
                variant={a.primary ? 'default' : 'outline'}
                size="sm"
                className={cn('justify-start', a.primary && 'col-span-2')}
                onClick={() => onNavigate(a.id)}
              >
                <a.icon className="h-4 w-4" aria-hidden="true" />
                {a.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* ============ Operação financeira (atalhos do dia a dia) ============ */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold text-foreground">Operação financeira</h3>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('panorama')}>
            <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" /> Painel completo
          </Button>
        </div>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Buscar funcionalidade: conciliação, NF-e, bonificação..."
            value={buscaOperacao}
            onChange={(e) => setBuscaOperacao(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {itensOperacao.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className="flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-tint text-primary">
                <item.icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
                <p className="truncate text-xs text-muted-foreground">{item.description}</p>
              </div>
            </button>
          ))}
          {itensOperacao.length === 0 && (
            <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
              Nada corresponde a "{buscaOperacao.trim()}".
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
