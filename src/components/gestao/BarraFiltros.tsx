import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * BarraFiltros — a linha entre os indicadores e a tabela, nas telas de Gestão.
 *
 * Desktop: busca larga à esquerda, filtros em fila, "Limpar filtros" quando há
 * algo aplicado, e a ação principal ancorada na direita. É a composição que se
 * repete em todas as referências de 13/09.
 *
 * Celular: a fila viraria oito selects empilhados empurrando a tabela para
 * fora da primeira tela. Então os filtros entram num painel que abre e fecha,
 * com o contador do que está aplicado no próprio botão — quem não filtra nada
 * nunca paga o espaço, e quem filtrou não perde de vista que filtrou. A busca
 * e a ação principal ficam sempre visíveis: são o que se usa sem pensar.
 */
interface BarraFiltrosProps {
  /** Texto da busca. Sem `aoBuscar`, o campo não aparece. */
  busca?: string;
  aoBuscar?: (valor: string) => void;
  placeholderBusca?: string;
  /** Selects, chips e intervalos de data. */
  children?: ReactNode;
  /** Quantos filtros estão aplicados agora — move o "Limpar" e o contador. */
  filtrosAplicados?: number;
  aoLimpar?: () => void;
  /** Ação principal do contexto, à direita. */
  acao?: ReactNode;
  className?: string;
}

export default function BarraFiltros({
  busca,
  aoBuscar,
  placeholderBusca = 'Buscar...',
  children,
  filtrosAplicados = 0,
  aoLimpar,
  acao,
  className,
}: BarraFiltrosProps) {
  const [abertoNoCelular, setAbertoNoCelular] = useState(false);
  const idPainel = useId();
  const temFiltros = Boolean(children);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* `items-end`, não `items-center`: a busca e a ação não têm rótulo, os
          filtros têm (rótulo em cima do campo). Centralizados, busca e botão
          ficavam 10 px acima da base dos campos — o desalinhamento apontado
          na tela de Documentos em 17/09. Pela base, tudo assenta na mesma linha. */}
      <div className="flex flex-wrap items-end gap-3">
        {aoBuscar && (
          <div className="relative min-w-0 flex-1 basis-64">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={busca ?? ''}
              onChange={(e) => aoBuscar(e.target.value)}
              placeholder={placeholderBusca}
              className="g-controle rounded-[var(--g-raio)] pl-9"
            />
          </div>
        )}

        {/* Fila de filtros — visível a partir de md; no celular vive no painel. */}
        {temFiltros && <div className="hidden flex-wrap items-end gap-3 md:flex">{children}</div>}

        {temFiltros && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setAbertoNoCelular((v) => !v)}
            aria-expanded={abertoNoCelular}
            aria-controls={idPainel}
            className="g-controle rounded-[var(--g-raio)] md:hidden"
          >
            <SlidersHorizontal aria-hidden="true" className="mr-2 h-4 w-4" />
            Filtros
            {filtrosAplicados > 0 && (
              <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold leading-none text-primary-foreground">
                {filtrosAplicados}
              </span>
            )}
            <ChevronDown
              aria-hidden="true"
              className={cn('ml-1 h-4 w-4 transition-transform', abertoNoCelular && 'rotate-180')}
            />
          </Button>
        )}

        {filtrosAplicados > 0 && aoLimpar && (
          <Button
            type="button"
            variant="ghost"
            onClick={aoLimpar}
            className="g-controle hidden rounded-[var(--g-raio)] text-primary md:inline-flex"
          >
            <X aria-hidden="true" className="mr-1.5 h-4 w-4" />
            Limpar filtros
          </Button>
        )}

        {acao && <div className="ml-auto flex shrink-0 items-center gap-2">{acao}</div>}
      </div>

      {temFiltros && abertoNoCelular && (
        <div id={idPainel} className="g-cartao flex flex-col gap-3 p-4 md:hidden">
          {children}
          {filtrosAplicados > 0 && aoLimpar && (
            <Button
              type="button"
              variant="ghost"
              onClick={aoLimpar}
              className="g-controle w-full rounded-[var(--g-raio)] text-primary"
            >
              <X aria-hidden="true" className="mr-1.5 h-4 w-4" />
              Limpar filtros
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
