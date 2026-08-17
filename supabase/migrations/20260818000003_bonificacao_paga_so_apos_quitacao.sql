-- =============================================================================
-- Bonificação só é paga depois que o cliente quita a NF-e
--
-- Regra do negócio, decidida pelo dono: o bônus acompanha o dinheiro que
-- entrou, não a nota emitida nem o contrato assinado. Sem ela, uma nota
-- faturada e nunca paga geraria bonificação paga — prejuízo silencioso, e
-- irreversível depois que o valor sai.
--
-- O caminho automático (marcar NF quitada em contrato_pedidos) já nascia certo:
-- só cria lançamento no ato da quitação. Os dois caminhos manuais não — pediam
-- valor base digitado, sem apontar qual quitação autorizava o pagamento.
--
-- A trava é no TRÂNSITO para 'pago', não na criação: lançar como pendente
-- enquanto a nota está em aberto é legítimo e serve de fila do financeiro.
--
-- `contrato_pedido_id` é a prova: aponta o pedido cuja NF-e foi quitada.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.bonificacao_paga_so_apos_quitacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pago' AND COALESCE(OLD.status, '') <> 'pago' THEN
    IF NOT EXISTS (
      SELECT 1
        FROM public.contrato_pedidos cp
       WHERE cp.id = NEW.contrato_pedido_id
         AND cp.nf_quitada IS TRUE
    ) THEN
      RAISE EXCEPTION
        'Bonificação só pode ser paga após a quitação da NF-e pelo cliente. Vincule o lançamento ao pedido cuja nota foi quitada.'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bonificacao_paga_so_apos_quitacao ON public.comissoes_lancamentos;

CREATE TRIGGER trg_bonificacao_paga_so_apos_quitacao
  BEFORE UPDATE ON public.comissoes_lancamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.bonificacao_paga_so_apos_quitacao();

COMMENT ON COLUMN public.comissoes_lancamentos.contrato_pedido_id IS
  'Pedido cuja NF-e quitada autoriza a bonificação. Obrigatório para o '
  'lançamento chegar a status "pago" (trigger trg_bonificacao_paga_so_apos_quitacao).';
