import { Link } from 'react-router-dom';
import { ArrowUpRight, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Tom do ícone. Semântico SÓ quando o ícone comunica estado real
 * (andamento/ganho/perda); o resto fica neutro — regra da auditoria de cor.
 * Cada tom é um par fundo-tinta da paleta (identidade 12/09), nunca cor
 * escrita à mão.
 */
export type StatTone = 'neutral' | 'primary' | 'success' | 'warning' | 'destructive';

const TONS: Record<StatTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary-tint text-primary',
  success: 'bg-success-tint text-success-ink',
  warning: 'bg-warning-tint text-warning-ink',
  destructive: 'bg-destructive-tint text-destructive-ink',
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
   * desconfiar do painel. Quando não houver destino equivalente, deixe
   * `para` de fora e explique em `motivoSemDestino`.
   */
  para?: string;
  /** Fica no `title` do cartão; não vira ruído na tela. */
  motivoSemDestino?: string;
};

export default function StatCard({
  label, value, razaoIndisponivel, change, changeType = 'neutral',
  icon: Icon, tone = 'primary', para, motivoSemDestino,
}: Props) {
  const conteudo = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Rótulo 14/20 e indicador 30/36 peso 600 — a régua tipográfica do
              comando. O cartão é compacto: são quatro numa fileira. */}
          <p className="truncate text-sm font-medium leading-5 text-muted-foreground">{label}</p>
          {value === null ? (
            <p
              className="mt-1 text-[1.875rem] font-semibold leading-9 text-muted-foreground"
              title={razaoIndisponivel}
            >
              —
            </p>
          ) : (
            /* `break-all` quebrava em QUALQUER ponto, inclusive no meio da
               palavra: "R$ 540 mil" virava "R$ 540 m" / "il". Valor de dinheiro
               não se parte — daí o nowrap, com a fonte tabular para os dígitos
               alinharem entre cartões. */
            <p className="mt-1 whitespace-nowrap text-[1.875rem] font-semibold leading-9 tabular-nums">
              {value}
            </p>
          )}
          {value === null && razaoIndisponivel && (
            <p className="mt-1 text-xs leading-4 text-muted-foreground">{razaoIndisponivel}</p>
          )}
          {value !== null && change && (
            <p
              className={cn(
                'mt-1 break-words text-xs leading-4',
                changeType === 'positive' && 'text-success',
                changeType === 'negative' && 'text-destructive',
                changeType === 'neutral' && 'text-muted-foreground',
              )}
            >
              {change}
            </p>
          )}
        </div>
        <div
          aria-hidden="true"
          className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md', TONS[tone])}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>
      {para && (
        // A seta é a pista de que o cartão leva a algum lugar. Sem ela, o
        // cartão clicável é indistinguível do que não é.
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium leading-5 text-primary">
          Ver na listagem
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
    </>
  );

  const pele = 'rounded-xl border border-border bg-card p-5 shadow-sm';

  if (para) {
    return (
      <Link
        to={para}
        aria-label={`${label}: ${value ?? 'não apurado'}. Abrir a listagem correspondente`}
        className={cn(
          pele,
          'block transition-colors hover:border-primary/40 hover:bg-muted/40',
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
