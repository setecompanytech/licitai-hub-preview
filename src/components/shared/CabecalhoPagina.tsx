import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * CabecalhoPagina — o topo padrão de toda tela interna (identidade 12/09).
 *
 * Anatomia, de cima para baixo:
 *   trilha (breadcrumb, 12/16, opcional)
 *   título 28/36 Manrope navy  ·  ação principal à direita
 *   descrição 16/24 secundária
 *   filtros (linha flexível, opcional)
 *
 * Substitui as faixas "herói" navy com foto que sete módulos tinham: a
 * linguagem nova é de fundo claro — navy só no texto, verde só na ação.
 * No celular a ação desce para baixo do título e os filtros embrulham.
 */
export interface TrilhaItem {
  rotulo: string;
  /** Sem `para`, o item é a página atual (não vira link). */
  para?: string;
}

interface CabecalhoPaginaProps {
  titulo: ReactNode;
  descricao?: ReactNode;
  /** Botões da ação principal (e secundárias), alinhados à direita. */
  acoes?: ReactNode;
  trilha?: TrilhaItem[];
  /** Linha de filtros/busca abaixo do título. */
  filtros?: ReactNode;
  /** Ícone do módulo, discreto, antes do título. */
  icone?: ReactNode;
  /** Conteúdo livre entre o título e os filtros (chips, contadores, tabs). */
  children?: ReactNode;
  className?: string;
}

export default function CabecalhoPagina({
  titulo,
  descricao,
  acoes,
  trilha,
  filtros,
  icone,
  children,
  className,
}: CabecalhoPaginaProps) {
  return (
    <header className={cn('mb-6 flex flex-col gap-4', className)}>
      {trilha && trilha.length > 0 && (
        <nav aria-label="Você está em" className="text-xs leading-4 text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1">
            {trilha.map((item, i) => {
              const ultimo = i === trilha.length - 1;
              return (
                <Fragment key={`${item.rotulo}-${i}`}>
                  <li>
                    {item.para && !ultimo ? (
                      <Link to={item.para} className="hover:text-foreground transition-colors">
                        {item.rotulo}
                      </Link>
                    ) : (
                      <span aria-current={ultimo ? 'page' : undefined} className={ultimo ? 'text-foreground font-medium' : undefined}>
                        {item.rotulo}
                      </span>
                    )}
                  </li>
                  {!ultimo && (
                    <li aria-hidden="true">
                      <ChevronRight className="w-3 h-3" />
                    </li>
                  )}
                </Fragment>
              );
            })}
          </ol>
        </nav>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-3 text-[1.75rem] leading-9 font-bold text-foreground">
            {icone && (
              <span aria-hidden="true" className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-tint text-primary [&>svg]:h-5 [&>svg]:w-5">
                {icone}
              </span>
            )}
            <span className="min-w-0">{titulo}</span>
          </h1>
          {descricao && (
            <p className="mt-1 max-w-3xl text-base leading-6 text-muted-foreground">{descricao}</p>
          )}
        </div>
        {acoes && (
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2 md:justify-end">{acoes}</div>
        )}
      </div>

      {children}

      {filtros && <div className="flex flex-wrap items-center gap-3">{filtros}</div>}
    </header>
  );
}
