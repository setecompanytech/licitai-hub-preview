import { Link } from 'react-router-dom';
import { ArrowRight, Database, Radar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { carimboDeAtualizacao } from '@/lib/datas/carimbo';

/**
 * Oportunidades — o que entrou e o que está aberto.
 *
 * ── A DISTINÇÃO QUE FALTAVA ──────────────────────────────────────────────
 *
 * O painel antigo punha lado a lado, com a mesma cara, "Monitoradas" (tabela
 * `licitacoes`, processos DA EMPRESA) e "Editais vigentes" (cache do PNCP,
 * base PÚBLICA do país inteiro). São coisas de natureza diferente: um número é
 * o trabalho da empresa, o outro é o tamanho do mercado. Somá-los mentalmente
 * — que é o que a grade convidava a fazer — não significa nada.
 *
 * Agora cada bloco declara DE ONDE vem o número, e a base externa carrega o
 * carimbo de quando foi atualizada.
 *
 * ── O CARIMBO DE SYNC ────────────────────────────────────────────────────
 *
 * Ele mostrava só `HH:mm`. Uma sincronização de três dias atrás aparecia como
 * "Sync: 14:20" e passava por recente — o pior tipo de erro num dado de
 * frescor, porque a pessoa decide o dia com base nele. Agora vem a data, e a
 * distância em dias quando não é de hoje.
 */

export interface Oportunidade {
  rotulo: string;
  /** Já formatado. `null` = não apurado — mostra "—", nunca 0. */
  valor: string | null;
  /** Por que não há número. */
  razaoIndisponivel?: string;
  /** Para onde o cartão leva. */
  para: string;
  /** Fundo tingido — o realce do primeiro número de cada bloco. */
  destaque?: boolean;
}

export interface BlocoDeOportunidades {
  titulo: string;
  /** De onde vem o dado, em uma linha. É o que separa empresa de base externa. */
  origem: string;
  /** 'empresa' = trabalho da sua operação; 'externa' = base pública. */
  natureza: 'empresa' | 'externa';
  /** ISO da última atualização da fonte, quando existir. */
  atualizadoEm?: string | null;
  /** Texto quando não há carimbo nenhum. */
  semAtualizacao?: string;
  itens: Oportunidade[];
}

interface Props {
  blocos: BlocoDeOportunidades[];
}

export default function OportunidadesPainel({ blocos }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
      {blocos.map((bloco) => (
        <section
          key={bloco.titulo}
          className="rounded-xl border border-border bg-card p-5 shadow-sm"
          aria-label={bloco.titulo}
        >
          <div className="mb-4 flex items-start gap-3">
            <span
              aria-hidden="true"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
            >
              {bloco.natureza === 'empresa'
                ? <Radar className="h-[18px] w-[18px]" />
                : <Database className="h-[18px] w-[18px]" />}
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-semibold leading-6 text-foreground">{bloco.titulo}</h3>
              <p className="text-sm leading-5 text-muted-foreground">{bloco.origem}</p>
              {bloco.natureza === 'externa' && (
                <p className="mt-1 text-xs leading-4 text-muted-foreground">
                  {bloco.atualizadoEm
                    ? `Atualizado ${carimboDeAtualizacao(bloco.atualizadoEm)}`
                    : bloco.semAtualizacao ?? 'Sem sincronização registrada'}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
            {bloco.itens.map((o) => (
              /* O cartão inteiro é o alvo: quem mira um número de 30px não
                 mira a legenda de 14 embaixo dele. O link cobre o cartão
                 (`after:absolute after:inset-0`) sem aninhar link em link nem
                 trocar o cartão por um <div> com onClick, que ficaria fora da
                 navegação por teclado. */
              <Card
                key={o.rotulo}
                className={cn(
                  'relative rounded-xl p-4 transition-colors hover:bg-muted/40',
                  o.destaque && 'border-primary/20 bg-primary-tint hover:bg-primary-tint',
                )}
              >
                <p className="text-sm leading-5 text-muted-foreground">{o.rotulo}</p>
                {o.valor === null ? (
                  <p
                    className="mt-1 text-[1.875rem] font-semibold leading-9 text-muted-foreground"
                    title={o.razaoIndisponivel}
                  >
                    —
                  </p>
                ) : (
                  <p className="mt-1 text-[1.875rem] font-semibold leading-9 tabular-nums">{o.valor}</p>
                )}
                {o.valor === null && o.razaoIndisponivel && (
                  <p className="mt-1 text-xs leading-4 text-muted-foreground">{o.razaoIndisponivel}</p>
                )}
                <Link
                  to={o.para}
                  className="group/link mt-2 inline-flex items-center gap-1 text-sm font-medium leading-5 text-primary after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="group-hover/link:underline">Visualizar</span>
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-200 group-hover/link:translate-x-0.5 motion-reduce:transform-none"
                    aria-hidden="true"
                  />
                </Link>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
