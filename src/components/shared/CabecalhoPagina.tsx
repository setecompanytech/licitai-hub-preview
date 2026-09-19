import { createElement, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { padraoDaRota } from '@/lib/navegacao/paginas';
import { useRegistrarTrilha } from '@/components/layout/contexto-trilha';

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
  /**
   * Densidade de sistema — a escala do módulo Gestão (26/34 no título, 14/20
   * na descrição), fixada pelo comando de 13/09.
   *
   * É uma prop e não o padrão porque as duas escalas são deliberadas e servem
   * a leituras diferentes: a de leitura (28/36 e 16/24) subiu em 10/09 porque
   * o dono do produto achou a anterior "pequena e difícil"; a de sistema desce
   * de novo porque tabela de dez colunas, painel lateral e indicadores na mesma
   * dobra não cabem naquela. Mudar o padrão aqui mexeria nas 56 telas que usam
   * este cabeçalho, incluindo as que a reclamação original nomeava.
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

  // A trilha sobe para a faixa branca em vez de ser desenhada aqui (13/09).
  // Renderizá-la nos dois lugares dava DUAS trilhas por tela, uma sobre a
  // outra, dizendo a mesma coisa — a navegação duplicada que o comando de
  // reestruturação proíbe. A faixa resolve sozinha as telas que são item de
  // menu; o que ela não sabe é o degrau final das telas de detalhe, e é isso
  // que este registro entrega.
  useRegistrarTrilha(trilha);

  return (
    <header className={cn('mb-4 flex flex-col gap-2', className)}>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="min-w-0 flex-1">
          <h1
            className={cn(
              'flex items-center gap-2 font-semibold text-foreground',
              denso ? 'g-titulo-pagina' : 'text-[1.15rem] leading-7',
            )}
          >
            {iconeFinal && (
              <span
                aria-hidden="true"
                className={cn(
                  'inline-flex flex-shrink-0 items-center justify-center bg-primary-tint text-primary',
                  denso
                    ? 'h-9 w-9 rounded-[var(--g-raio)] [&>svg]:h-[18px] [&>svg]:w-[18px]'
                    : 'h-7 w-7 rounded-lg [&>svg]:h-4 [&>svg]:w-4',
                )}
              >
                {iconeFinal}
              </span>
            )}
            <span className="min-w-0">{tituloFinal}</span>
          </h1>
          {descricaoFinal && (
            <p
              className={cn(
                'mt-0.5 max-w-3xl truncate text-muted-foreground',
                denso ? 'g-corpo' : 'text-[13px] leading-5',
              )}
            >
              {descricaoFinal}
            </p>
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
