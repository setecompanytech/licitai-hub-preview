import { useCallback, useEffect, useRef, useState, type DependencyList, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * TabelaGestao — a tabela padrão do módulo, e a sua tradução para o celular.
 *
 * Duas regras do comando de 13/09 moldam o componente:
 *
 *  1. "Linhas de tabela com altura mínima de 44px" e "números alinhados à
 *     direita". A altura é alvo de toque, não estética: 44px é o mínimo que
 *     um dedo acerta. O alinhamento à direita é o que deixa comparar
 *     R$ 1.250,00 com R$ 980,00 sem ler dígito por dígito — junto de
 *     `tabular-nums`, que impede a coluna de dançar entre renderizações.
 *
 *  2. "Não reproduzir o desktop em miniatura". Uma tabela de oito colunas em
 *     390px não é uma tabela: é uma barra de rolagem. Então no celular cada
 *     registro vira um cartão com as colunas marcadas `prioridade: 'sempre'`,
 *     e o resto se consulta abrindo o detalhe — que é para onde a linha já
 *     levava no desktop.
 *
 * A rolagem horizontal fica presa ao contêiner da tabela (`overflow-x-auto`),
 * nunca na página: o comando proíbe a página inteira rolar de lado.
 */
export interface ColunaGestao<T> {
  chave: string;
  titulo: ReactNode;
  render: (item: T) => ReactNode;
  /** Número vai à direita. O padrão é esquerda. */
  alinhamento?: 'esquerda' | 'direita' | 'centro';
  ordenavel?: boolean;
  /** `sempre` sobrevive ao celular; `desktop` só aparece na tabela larga. */
  prioridade?: 'sempre' | 'desktop';
  /** Largura fixa da coluna, quando ela precisa de uma. */
  largura?: string;
  /** Rótulo curto para o cartão do celular, quando o título é longo. */
  tituloCurto?: string;
}

export interface OrdenacaoTabela {
  chave: string;
  direcao: 'asc' | 'desc';
}

interface TabelaGestaoProps<T> {
  colunas: ColunaGestao<T>[];
  itens: T[];
  chaveDoItem: (item: T) => string;
  /** Abre o detalhe do registro. Sem isto, as linhas não são clicáveis. */
  aoSelecionar?: (item: T) => void;
  /** Registro em foco — recebe a tarja verde à esquerda, como nas referências. */
  selecionado?: (item: T) => boolean;
  ordenacao?: OrdenacaoTabela;
  aoOrdenar?: (chave: string) => void;
  carregando?: boolean;
  /** Mostrado no lugar do corpo quando não há itens. */
  vazio?: ReactNode;
  /** Linha de rodapé: contagem, paginação. */
  rodape?: ReactNode;
  /** Rótulo acessível da tabela. */
  descricao: string;
  className?: string;
}

/**
 * Há conteúdo escondido à esquerda ou à direita da tabela?
 *
 * A rolagem horizontal fica presa ao contêiner (a página nunca rola de lado),
 * e a barra de rolagem mora no FIM da tabela — numa lista longa, fora da tela.
 * Sem um sinal na borda, coluna escondida parece coluna cortada: foi assim que
 * "Valor" e "Pendência principal" sumiram de duas telas em 14/09/2026 sem que
 * nada indicasse que bastava rolar.
 *
 * `dependencias` existe porque a tabela só monta depois de carregar: sem reler
 * quando ela aparece, o observador ficaria preso a um contêiner que não existia.
 */
function useSombraDeRolagem(dependencias: DependencyList) {
  const ref = useRef<HTMLDivElement>(null);
  const [sombra, setSombra] = useState({ esquerda: false, direita: false });

  const medir = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const esquerda = el.scrollLeft > 1;
    const direita = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setSombra((s) => (s.esquerda === esquerda && s.direita === direita ? s : { esquerda, direita }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    medir();
    el.addEventListener('scroll', medir, { passive: true });
    window.addEventListener('resize', medir);
    const observador = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    observador?.observe(el);
    if (el.firstElementChild) observador?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', medir);
      window.removeEventListener('resize', medir);
      observador?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medir, ...dependencias]);

  return { ref, sombra };
}

const ALINHAMENTO = {
  esquerda: 'text-left',
  direita: 'text-right tabular-nums',
  centro: 'text-center',
} as const;

export default function TabelaGestao<T>({
  colunas,
  itens,
  chaveDoItem,
  aoSelecionar,
  selecionado,
  ordenacao,
  aoOrdenar,
  carregando,
  vazio,
  rodape,
  descricao,
  className,
}: TabelaGestaoProps<T>) {
  const noCelular = useIsMobile();
  const { ref: caixaDeRolagem, sombra } = useSombraDeRolagem([carregando, noCelular, itens.length, colunas.length]);

  if (carregando) {
    return (
      <div className={cn('g-cartao overflow-hidden', className)}>
        <div className="flex flex-col gap-px bg-border">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 bg-card px-4 py-3">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (itens.length === 0 && vazio) {
    return <div className={cn('g-cartao', className)}>{vazio}</div>;
  }

  if (noCelular) {
    const essenciais = colunas.filter((c) => c.prioridade !== 'desktop');
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {itens.map((item) => {
          const ativo = selecionado?.(item) ?? false;
          const Elemento = aoSelecionar ? 'button' : 'div';
          return (
            <Elemento
              key={chaveDoItem(item)}
              {...(aoSelecionar
                ? { type: 'button' as const, onClick: () => aoSelecionar(item) }
                : {})}
              className={cn(
                'g-cartao flex w-full items-start gap-3 p-4 text-left',
                ativo && 'border-primary ring-1 ring-primary/30',
              )}
            >
              <div className="grid min-w-0 flex-1 gap-1.5">
                {essenciais.map((coluna) => (
                  <div key={coluna.chave} className="flex min-w-0 items-baseline gap-2">
                    <span className="g-meta w-24 shrink-0 text-muted-foreground">
                      {coluna.tituloCurto ?? coluna.titulo}
                    </span>
                    <span className="g-corpo min-w-0 flex-1 text-foreground">
                      {coluna.render(item)}
                    </span>
                  </div>
                ))}
              </div>
              {aoSelecionar && (
                <ChevronRight
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                />
              )}
            </Elemento>
          );
        })}
        {rodape && <div className="g-corpo px-1 py-2 text-muted-foreground">{rodape}</div>}
      </div>
    );
  }

  return (
    <div className={cn('g-cartao overflow-hidden', className)}>
      <div className="relative">
      <div ref={caixaDeRolagem} className="overflow-x-auto">
        <table className="w-full border-collapse">
          <caption className="sr-only">{descricao}</caption>
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {colunas.map((coluna) => {
                const ativa = ordenacao?.chave === coluna.chave;
                return (
                  <th
                    key={coluna.chave}
                    scope="col"
                    style={coluna.largura ? { width: coluna.largura } : undefined}
                    className={cn(
                      'g-meta px-3 py-3 font-semibold uppercase tracking-wide text-muted-foreground',
                      ALINHAMENTO[coluna.alinhamento ?? 'esquerda'],
                    )}
                    aria-sort={
                      ativa ? (ordenacao!.direcao === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                  >
                    {coluna.ordenavel && aoOrdenar ? (
                      <button
                        type="button"
                        onClick={() => aoOrdenar(coluna.chave)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          coluna.alinhamento === 'direita' && 'flex-row-reverse',
                        )}
                      >
                        {coluna.titulo}
                        {ativa ? (
                          ordenacao!.direcao === 'asc' ? (
                            <ChevronUp aria-hidden="true" className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
                          )
                        ) : (
                          <ChevronsUpDown aria-hidden="true" className="h-3.5 w-3.5 opacity-50" />
                        )}
                      </button>
                    ) : (
                      coluna.titulo
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => {
              const ativo = selecionado?.(item) ?? false;
              return (
                <tr
                  key={chaveDoItem(item)}
                  {...(aoSelecionar
                    ? {
                        onClick: () => aoSelecionar(item),
                        tabIndex: 0,
                        role: 'button',
                        onKeyDown: (e: React.KeyboardEvent) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            aoSelecionar(item);
                          }
                        },
                      }
                    : {})}
                  aria-current={ativo ? 'true' : undefined}
                  className={cn(
                    'border-b border-border last:border-0 transition-colors',
                    aoSelecionar &&
                      'cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/40',
                    // A tarja verde à esquerda do registro em foco, das referências.
                    ativo && 'bg-primary-tint/60 shadow-[inset_3px_0_0_0_hsl(var(--primary))]',
                  )}
                >
                  {colunas.map((coluna) => (
                    <td
                      key={coluna.chave}
                      className={cn(
                        'g-corpo h-[var(--g-linha)] px-3 py-2.5 align-middle text-foreground',
                        ALINHAMENTO[coluna.alinhamento ?? 'esquerda'],
                      )}
                    >
                      {coluna.render(item)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* A sombra diz "tem mais para este lado". Só aparece quando tem. */}
      {sombra.esquerda && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-card to-transparent" />
      )}
      {sombra.direita && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card via-card/70 to-transparent" />
      )}
      </div>
      {rodape && (
        <div className="g-corpo flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-muted-foreground">
          {rodape}
        </div>
      )}
    </div>
  );
}
