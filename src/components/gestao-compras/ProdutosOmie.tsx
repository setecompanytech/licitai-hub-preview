import { forwardRef } from 'react';
import CadastroProdutos, { type CadastroProdutosRef } from './CadastroProdutos';

/**
 * ProdutosOmie — a aba "Produtos" de `/gestao-compras`.
 *
 * O cadastro em si mora em `CadastroProdutos`: este arquivo existia como uma
 * SEGUNDA cópia completa dele (1069 linhas), divergindo de `src/pages/Produtos.tsx`
 * desde agosto. Agora é só a entrada embutida — sem moldura própria, porque
 * `GestaoCompras` já dá o `AppLayout`, o cabeçalho e as abas.
 *
 * O nome e o punho continuam: `GestaoCompras.tsx` importa deste caminho e o
 * `ProdutosOmieRef` é interface pública. Trocar qualquer um dos dois quebraria
 * a página mãe, que não faz parte desta leva.
 */
export type ProdutosOmieRef = CadastroProdutosRef;

const ProdutosOmie = forwardRef<ProdutosOmieRef, { aoMudar?: () => void }>(
  function ProdutosOmie({ aoMudar }, ref) {
    return <CadastroProdutos ref={ref} aoMudar={aoMudar} />;
  },
);

export default ProdutosOmie;
