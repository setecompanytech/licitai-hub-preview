import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export interface AbaGestao {
  valor: string;
  rotulo: string;
  /** Número ao lado do rótulo — quantos registros a aba tem. */
  contagem?: number;
}

/**
 * AbasGestao — a fila de abas sublinhadas das referências: item ativo em verde
 * com filete embaixo, os demais em cinza, tudo sobre uma linha de 1px que
 * atravessa a largura.
 *
 * Rola de lado quando não cabe (Compras tem seis abas, o dossiê tem sete), e
 * a rolagem fica presa a esta fila — a página nunca rola de lado.
 */
export default function AbasGestao({
  abas,
  valor,
  aoMudar,
  className,
}: {
  abas: AbaGestao[];
  valor: string;
  aoMudar: (valor: string) => void;
  className?: string;
}) {
  return (
    <Tabs value={valor} onValueChange={aoMudar} className={cn('w-full', className)}>
      <TabsList
        className={cn(
          'h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-border bg-transparent p-0',
          '[scrollbar-width:thin]',
        )}
      >
        {abas.map((aba) => (
          <TabsTrigger
            key={aba.valor}
            value={aba.valor}
            className={cn(
              'g-corpo shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 font-medium text-muted-foreground shadow-none',
              'hover:text-foreground',
              'data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-primary data-[state=active]:shadow-none',
            )}
          >
            {aba.rotulo}
            {typeof aba.contagem === 'number' && (
              <span className="ml-1.5 tabular-nums opacity-70">({aba.contagem})</span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
