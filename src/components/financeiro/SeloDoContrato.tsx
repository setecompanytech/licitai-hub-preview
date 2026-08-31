import { FileSignature } from 'lucide-react';
import type { VinculoDeContrato } from '@/hooks/useVinculosDeContrato';

/**
 * O que este título sustenta na Gestão de Contratos.
 *
 * Conciliar é decidir se um movimento do banco corresponde a um lançamento — e
 * a decisão fica melhor sabendo o que está em jogo do outro lado. "R$
 * 30.960,00, FORN. NFE 125" e "R$ 30.960,00, FORN. NFE 125 · quita o pedido
 * 003 do contrato 008/2026" são a mesma linha com consequências muito
 * diferentes: a segunda diz que conciliar aqui vai marcar uma entrega como
 * paga lá.
 *
 * Isso deixou de ser detalhe quando a quitação passou a ser recalculada por
 * gatilho (20260831000001): conciliar agora TEM efeito na Gestão, e efeito que
 * a tela não anuncia é efeito que ninguém confere.
 */

type Props = {
  vinculo: VinculoDeContrato | undefined;
  /**
   * O status para onde o lançamento vai. Só com `realizado`/`conciliado` a
   * frase é "quita"; antes disso o título apenas pertence ao pedido, e dizer
   * "quita" seria anunciar um efeito que ainda não aconteceu.
   */
  statusFuturo?: string | null;
};

export default function SeloDoContrato({ vinculo, statusFuturo }: Props) {
  if (!vinculo) return null;

  const quita = statusFuturo === 'realizado' || statusFuturo === 'conciliado';
  const contrato = vinculo.numero_contrato ?? 'contrato sem número';

  return (
    <p className="text-xs mt-0.5 flex items-start gap-1 text-primary">
      <FileSignature className="w-3 h-3 mt-0.5 shrink-0" />
      <span>
        {vinculo.numero_pedido
          ? <>{quita ? 'Quita o' : 'Do'} pedido <b>{vinculo.numero_pedido}</b> do contrato <b>{contrato}</b></>
          : <>Do contrato <b>{contrato}</b> — sem pedido vinculado</>}
      </span>
    </p>
  );
}
