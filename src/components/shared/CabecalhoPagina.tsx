import { Fragment, createElement, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { padraoDaRota, trilhaDaRota } from '@/lib/navegacao/paginas';

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
  /**
   * Rota do menu. Com ela, título, descrição, ícone e trilha vêm do registro
   * `lib/navegacao/paginas.ts` — a tela não repete o que já está padronizado.
   * Omitida, o componente usa só o que for passado à mão (telas de detalhe,
   * que não são item de menu). Qualquer prop explícita vence o registro.
   */
  rota?: string;
  titulo?: ReactNode;
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
  rota,
  titulo,
  descricao,
  acoes,
  trilha,
  filtros,
  icone,
  children,
  className,
}: CabecalhoPaginaProps) {
  // Sem `rota`, cai no caminho da própria URL: a tela de um item de menu não
  // precisa se identificar duas vezes.
  const { pathname } = useLocation();
  const padrao = padraoDaRota(rota ?? pathname);

  const tituloFinal = titulo ?? padrao?.titulo ?? '';
  const descricaoFinal = descricao ?? padrao?.descricao;
  const trilhaFinal = trilha ?? (padrao ? trilhaDaRota(rota ?? pathname) : undefined);
  const iconeFinal = icone ?? (padrao ? createElement(padrao.icone) : undefined);

  return (
    <header className={cn('mb-6 flex flex-col gap-4', className)}>
      {trilhaFinal && trilhaFinal.length > 0 && (
        <nav aria-label="Você está em" className="text-xs leading-4 text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1">
            {trilhaFinal.map((item, i) => {
              const ultimo = i === trilhaFinal.length - 1;
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
            {iconeFinal && (
              <span aria-hidden="true" className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-tint text-primary [&>svg]:h-5 [&>svg]:w-5">
                {iconeFinal}
              </span>
            )}
            <span className="min-w-0">{tituloFinal}</span>
          </h1>
          {descricaoFinal && (
            <p className="mt-1 max-w-3xl text-base leading-6 text-muted-foreground">{descricaoFinal}</p>
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
