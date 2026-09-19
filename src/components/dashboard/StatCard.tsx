import { Link } from 'react-router-dom';
import { ArrowUpRight, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Tom do ícone. Semântico SÓ quando o ícone comunica estado real
 * (andamento/ganho/perda); o resto fica neutro. Cada tom é um par fundo-tinta
 * da paleta, nunca cor escrita à mão.
 */
export type StatTone = 'neutral' | 'primary' | 'success' | 'warning' | 'destructive' | 'info';

const TONS: Record<StatTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary-tint text-primary',
  success: 'bg-success-tint text-success-ink',
  warning: 'bg-warning-tint text-warning-ink',
  destructive: 'bg-destructive-tint text-destructive-ink',
  info: 'bg-info-tint text-info-ink',
};

type Props = {
  label: string;
  /**
   * O número já formatado. `null` quer dizer NÃO APURADO — e aí o cartão
   * mostra "—" com o motivo, nunca 0. Um zero inventado afirma um fato
   * ("nenhuma ganha", "nenhum edital vigente") que ninguém mediu.
   */
  value: string | null;
  /** Por que não há número. Obrigatório na prática quando `value` é `null`. */
  razaoIndisponivel?: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  /** 'neutral' = ícone no cinza de texto secundário (padrão para ícones sem estado). */
  tone?: StatTone;
  /**
   * Destino do clique — a listagem que REPRODUZ este número.
   *
   * Sem `para`, o cartão não é clicável, e isso é decisão, não esquecimento:
   * indicador que leva a uma lista com outra conta ensina a pessoa a
   * desconfiar do painel.
   */
  para?: string;
  /** Fica no `title` do cartão; não vira ruído na tela. */
  motivoSemDestino?: string;
};

/**
 * Cartão KPI do painel (Design System v3): 112–128px, rótulo em cima, valor
 * 28/36 em peso 600, ícone discreto no canto, linha de contexto embaixo. O
 * cartão inteiro é o alvo quando há destino; a seta é a pista.
 */
export default function StatCard({
  label, value, razaoIndisponivel, change, changeType = 'neutral',
  icon: Icon, tone = 'primary', para, motivoSemDestino,
}: Props) {
  const conteudo = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium leading-5 text-muted-foreground">{label}</p>
        <span
          aria-hidden="true"
          className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', TONS[tone])}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="min-w-0">
        {value === null ? (
          <p className="text-[1.75rem] font-semibold leading-9 text-muted-foreground" title={razaoIndisponivel}>
            —
          </p>
        ) : (
          /* Valor de dinheiro não se parte — nowrap, com dígitos tabulares. */
          <p className="whitespace-nowrap text-[1.75rem] font-semibold leading-9 tabular-nums text-foreground">
            {value}
          </p>
        )}
        {value === null && razaoIndisponivel && (
          <p className="mt-0.5 truncate text-xs leading-4 text-muted-foreground">{razaoIndisponivel}</p>
        )}
        {value !== null && change && (
          <p
            className={cn(
              'mt-0.5 truncate text-xs leading-4',
              changeType === 'positive' && 'text-success-ink',
              changeType === 'negative' && 'text-destructive-ink',
              changeType === 'neutral' && 'text-muted-foreground',
            )}
            title={change}
          >
            {change}
          </p>
        )}
        {value !== null && !change && para && (
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium leading-4 text-primary">
            Ver na listagem
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </p>
        )}
      </div>
    </>
  );

  const pele = 'flex min-h-[112px] flex-col justify-between gap-2 rounded-lg border border-border bg-card p-4 shadow-sm';

  if (para) {
    return (
      <Link
        to={para}
        aria-label={`${label}: ${value ?? 'não apurado'}. Abrir a listagem correspondente`}
        className={cn(
          pele,
          'transition-[border-color,box-shadow] duration-150 hover:border-primary/40 hover:shadow-md',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
      >
        {conteudo}
      </Link>
    );
  }

  return (
    <div className={pele} title={motivoSemDestino}>
      {conteudo}
    </div>
  );
}
