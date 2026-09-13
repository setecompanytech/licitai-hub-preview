import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Peças de interface que as três abas de Metas repetem.
 *
 * Os nomes dos meses moram em `./meses` — constante em módulo de componente
 * quebra o Fast Refresh.
 */

/**
 * Um filtro dentro da `BarraFiltros`: rótulo em cima, controle embaixo.
 *
 * O rótulo é um `<span>`, e não um `<label for>`, por um motivo concreto: a
 * `BarraFiltros` renderiza os filhos DUAS vezes — a fila do desktop
 * (`hidden md:flex`) e o painel do celular —, e as duas árvores coexistem no
 * DOM quando o painel abre. Com `id`/`htmlFor` isso produziria dois elementos
 * com o mesmo `id`, e a associação rótulo↔campo passaria a ser ambígua
 * justamente no celular. O nome acessível vem do `aria-label` que cada
 * controle carrega, com o MESMO texto do rótulo visível.
 */
export function CampoFiltro({
  rotulo,
  className,
  children,
}: {
  rotulo: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <span aria-hidden="true" className="g-meta text-muted-foreground">
        {rotulo}
      </span>
      {children}
    </div>
  );
}

/**
 * A linha que diz por qual DATA o número acima dela foi apurado.
 *
 * É o antídoto do "somar peras com maçãs": participados, ganhos, faturados e
 * quitados caem em meses diferentes porque cada um é definido por uma data
 * diferente (ver `lib/metas/apuracao.ts`). Sem isto escrito, a leitura natural
 * é comparar os quatro como se fossem etapas do mesmo lote — e não são.
 */
export function LinhaApuracao({
  curto,
  explicacao,
  className,
}: {
  curto: string;
  explicacao?: string;
  className?: string;
}) {
  return (
    <p className={cn('g-meta text-muted-foreground', className)} title={explicacao}>
      <span className="sr-only">Base de apuração: </span>
      {curto}
    </p>
  );
}
