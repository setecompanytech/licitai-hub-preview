import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useLarguraMinima, LARGURA_PAINEL_LATERAL } from '@/hooks/useLarguraMinima';
import { cn } from '@/lib/utils';

/**
 * AreaComPainel — tabela à esquerda, detalhe do registro selecionado à direita.
 *
 * É a composição que o comando de 13/09 pede para Estratégicas, Compromissos,
 * Histórico, Contratos, Produtos, Estoque e NF-e: selecionar uma linha abre o
 * painel sem tirar a pessoa da lista, e fechá-lo devolve a tabela inteira.
 *
 * O painel tem 384px — meio da faixa 360–420 do comando — e só existe a partir
 * de 1280px. A regra que decide isso está no próprio comando: a área principal
 * precisa continuar legível. Abaixo disso, uma tabela de oito colunas espremida
 * contra um painel de 384px deixa as duas ilegíveis, e o detalhe passa a abrir
 * em gaveta sobreposta — no celular, tela inteira.
 *
 * A escolha entre os dois invólucros é feita em JavaScript, não com
 * `hidden xl:block`, porque o painel é montado UMA vez: duas árvores vivas ao
 * mesmo tempo significam dois formulários com os mesmos ids, e o que se digita
 * na cópia visível não existe na outra.
 */
interface AreaComPainelProps {
  /** Tabela, quadro ou o que mais ocupe a área principal. */
  children: ReactNode;
  /** Conteúdo do painel. `null`/`undefined` = nada selecionado, painel fora. */
  painel?: ReactNode;
  /** Título do painel — cabeçalho da gaveta e rótulo acessível da coluna. */
  tituloPainel?: string;
  aoFechar?: () => void;
  className?: string;
}

export default function AreaComPainel({
  children,
  painel,
  tituloPainel = 'Detalhes',
  aoFechar,
  className,
}: AreaComPainelProps) {
  const aberto = Boolean(painel);
  const cabeAoLado = useLarguraMinima(LARGURA_PAINEL_LATERAL);
  const emColuna = aberto && cabeAoLado;

  return (
    <>
      <div
        className={cn(
          'flex min-w-0 flex-col gap-4',
          emColuna && 'grid grid-cols-[minmax(0,1fr)_var(--g-painel)] items-start gap-4',
          className,
        )}
      >
        <div className="min-w-0">{children}</div>

        {emColuna && (
          <aside
            aria-label={tituloPainel}
            className="g-cartao sticky top-[calc(var(--g-topo)+1rem)] max-h-[calc(100vh-var(--g-topo)-3rem)] overflow-y-auto p-4"
          >
            {aoFechar && (
              <div className="mb-2 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={aoFechar}
                  aria-label="Fechar detalhes"
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            {painel}
          </aside>
        )}
      </div>

      <Sheet open={aberto && !cabeAoLado} onOpenChange={(v) => !v && aoFechar?.()}>
        <SheetContent side="right" className="w-full overflow-y-auto p-4 sm:max-w-[var(--g-painel)]">
          <SheetHeader className="mb-3 text-left">
            <SheetTitle className="g-titulo-secao">{tituloPainel}</SheetTitle>
          </SheetHeader>
          {!cabeAoLado && painel}
        </SheetContent>
      </Sheet>
    </>
  );
}
