import { createElement, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { padraoDaRota } from '@/lib/navegacao/paginas';
import { useRegistrarTrilha } from '@/components/layout/contexto-trilha';

/**
 * CabecalhoPagina — o topo padrão de toda tela interna (Design System v3).
 *
 * Anatomia, de cima para baixo:
 *   [trilha — desenhada pelo AppLayout, registrada daqui]
 *   ícone do módulo · título 28/36 · ação principal à direita
 *   descrição 14/20 secundária
 *   conteúdo livre (chips, contadores, abas)
 *   filtros (linha flexível, opcional)
 *
 * Fundo claro, navy só no texto, verde só na ação. No celular a ação desce
 * para baixo do título e os filtros embrulham.
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
  /**
   * Densidade de sistema — título 24/32 em vez de 28/36, para telas em que
   * tabela de dez colunas, painel lateral e indicadores dividem a dobra.
   */
  denso?: boolean;
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
  denso = false,
  children,
  className,
}: CabecalhoPaginaProps) {
  // Sem `rota`, cai no caminho da própria URL: a tela de um item de menu não
  // precisa se identificar duas vezes.
  const { pathname } = useLocation();
  const padrao = padraoDaRota(rota ?? pathname);

  const tituloFinal = titulo ?? padrao?.titulo ?? '';
  const descricaoFinal = descricao ?? padrao?.descricao;
  const iconeFinal = icone ?? (padrao ? createElement(padrao.icone) : undefined);

  // A trilha é desenhada UMA vez, pelo AppLayout; aqui ela só é registrada.
  useRegistrarTrilha(trilha);

  return (
    <header className={cn('mb-6 flex flex-col gap-3', className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {iconeFinal && (
            <span
              aria-hidden="true"
              className={cn(
                'hidden shrink-0 items-center justify-center rounded-md bg-primary-tint text-primary sm:inline-flex',
                denso ? 'mt-0.5 h-9 w-9 [&>svg]:h-[18px] [&>svg]:w-[18px]' : 'mt-0.5 h-10 w-10 [&>svg]:h-5 [&>svg]:w-5',
              )}
            >
              {iconeFinal}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1
              className={cn(
                'min-w-0 font-semibold tracking-tight text-foreground',
                denso ? 'text-2xl leading-8' : 'text-[1.75rem] leading-9',
              )}
            >
              {tituloFinal}
            </h1>
            {descricaoFinal && (
              <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">{descricaoFinal}</p>
            )}
          </div>
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
