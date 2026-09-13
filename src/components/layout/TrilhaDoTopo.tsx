import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { trilhaDaRota } from '@/lib/navegacao/paginas';
import { useTrilhaDaPagina } from './contexto-trilha';
import { cn } from '@/lib/utils';

/**
 * TrilhaDoTopo — o breadcrumb da faixa superior branca (13/09/2026).
 *
 * A trilha saiu do corpo da página e subiu para a faixa, como nas referências:
 * "Gestão › Contratos › ATA022/2024" à esquerda, contexto e perfil à direita.
 * A tela ganhou uma linha de altura e, mais importante, o caminho de volta
 * passou a ficar sempre no mesmo lugar — antes ele nascia dentro de cada
 * cabeçalho e sumia nas telas de detalhe, que são justamente as que precisam.
 *
 * Os dois primeiros degraus vêm do registro `paginas.ts`; o terceiro, quando a
 * tela é o detalhe de um registro, é passado por quem conhece o número dele —
 * o roteador não sabe que `/processo/abc-123` se chama "Pregão 90014/2025".
 *
 * No celular só o último degrau aparece: é onde a pessoa está, e é o único que
 * cabe ao lado do botão da gaveta.
 */
export interface DegrauDaTrilha {
  rotulo: string;
  para?: string;
}

export default function TrilhaDoTopo({
  extra,
  className,
}: {
  /** Degraus além dos do registro — o identificador do registro aberto. */
  extra?: DegrauDaTrilha[];
  className?: string;
}) {
  const { pathname } = useLocation();
  // Trilha declarada pela própria página vence a derivada da rota: quem sabe
  // que `/gestao-contratos?contrato=x` se chama "ATA 022/2024" é a tela, não o
  // roteador. Sem declaração, a rota resolve.
  const daPagina = useTrilhaDaPagina();
  // O primeiro degrau do registro é sempre "Painel"; na faixa ele é redundante
  // com a marca, que já leva ao painel e fica dois centímetros à esquerda.
  const base = daPagina ?? trilhaDaRota(pathname);
  const doRegistro = base[0]?.rotulo === 'Painel' ? base.slice(1) : base;
  const degraus = [...doRegistro, ...(extra ?? [])];

  if (degraus.length === 0) return null;
  const ultimo = degraus[degraus.length - 1];

  return (
    <nav aria-label="Trilha de navegação" className={cn('min-w-0', className)}>
      {/* Celular: só onde estou. */}
      <span className="g-corpo block truncate font-semibold text-foreground md:hidden">
        {ultimo.rotulo}
      </span>

      <ol className="hidden min-w-0 items-center gap-1.5 md:flex">
        {degraus.map((degrau, i) => {
          const derradeiro = i === degraus.length - 1;
          return (
            <Fragment key={`${degrau.rotulo}-${i}`}>
              {i > 0 && (
                <ChevronRight
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                />
              )}
              <li className="min-w-0">
                {degrau.para && !derradeiro ? (
                  <Link
                    to={degrau.para}
                    className="g-corpo block truncate rounded text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {degrau.rotulo}
                  </Link>
                ) : (
                  <span
                    aria-current={derradeiro ? 'page' : undefined}
                    className={cn(
                      'g-corpo block truncate',
                      derradeiro ? 'font-semibold text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {degrau.rotulo}
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
