-- =============================================================================
-- Quando a bonificação pode ser paga — política de CADA empresa
--
-- Cada empresa remunera de um jeito: há quem pague ao ganhar o contrato, quem
-- pague ao faturar e quem só pague depois que o cliente quita a nota. Nenhum
-- desses é "o certo" — é decisão comercial de quem assina o plano.
--
-- A primeira versão desta trava exigia quitação de todos, transformando a
-- política de um cliente em regra do produto. Aqui a exigência passa a ser
-- lida de `comissoes_config.evento_pagamento`, por colaborador.
--
-- O que a trava impede é o descompasso: paga-se antes do marco que a própria
-- empresa declarou. Nota faturada e nunca recebida virando bônus pago é
-- prejuízo silencioso — mas só para quem escolheu pagar no recebimento.
--
-- Sem configuração para o colaborador, não há política declarada e nada é
-- exigido: inventar uma barraria a empresa que ainda não configurou.
--
-- A trava é no TRÂNSITO para 'pago'. Lançar como pendente sempre vale — é a
-- fila do financeiro.
--
-- Idempotente: se a versão anterior desta migration já foi aplicada, colar
-- esta de novo substitui a função e afrouxa a exigência para a política certa.
-- =============================================================================

-- ── 1. A política, por colaborador ───────────────────────────────────────────
ALTER TABLE public.comissoes_config
  ADD COLUMN IF NOT EXISTS evento_pagamento text;

-- Configuração que nasceu antes desta coluna herda o marco que o próprio tipo
-- de cálculo já pressupõe — nada muda de comportamento sem alguém decidir.
UPDATE public.comissoes_config
   SET evento_pagamento = CASE
         WHEN tipo_comissao IN ('percentual_nf_quitada', 'nota_fiscal') THEN 'nf_quitada'
         WHEN tipo_comissao = 'percentual_faturamento'                  THEN 'nota_emitida'
         ELSE 'contrato_assinado'
       END
 WHERE evento_pagamento IS NULL;

ALTER TABLE public.comissoes_config
  ALTER COLUMN evento_pagamento SET DEFAULT 'contrato_assinado';

ALTER TABLE public.comissoes_config
  DROP CONSTRAINT IF EXISTS comissoes_config_evento_pagamento_check;

ALTER TABLE public.comissoes_config
  ADD CONSTRAINT comissoes_config_evento_pagamento_check
  CHECK (evento_pagamento IN ('contrato_assinado', 'nota_emitida', 'nf_quitada'));

COMMENT ON COLUMN public.comissoes_config.evento_pagamento IS
  'Marco a partir do qual a bonificação pode ser paga: contrato_assinado, '
  'nota_emitida ou nf_quitada. Política da empresa, não do produto. Distinto '
  'de tipo_comissao, que define a BASE do cálculo. Espelho no front: '
  'EVENTOS_PAGAMENTO em src/lib/equipe/bonificacao.ts.';

-- ── 2. A trava, obedecendo à política declarada ──────────────────────────────
CREATE OR REPLACE FUNCTION public.bonificacao_paga_so_apos_quitacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evento text;
  v_ok     boolean;
BEGIN
  IF NEW.status <> 'pago' OR COALESCE(OLD.status, '') = 'pago' THEN
    RETURN NEW;
  END IF;

  SELECT evento_pagamento INTO v_evento
    FROM public.comissoes_config
   WHERE empresa_id = NEW.empresa_id
     AND user_id = NEW.user_id
     AND ativo IS TRUE
   LIMIT 1;

  -- Empresa sem política declarada não é barrada por uma política inventada.
  IF v_evento IS NULL THEN
    RETURN NEW;
  END IF;

  v_ok := CASE v_evento
    WHEN 'nf_quitada' THEN EXISTS (
      SELECT 1 FROM public.contrato_pedidos cp
       WHERE cp.id = NEW.contrato_pedido_id
         AND cp.nf_quitada IS TRUE
    )
    WHEN 'nota_emitida' THEN EXISTS (
      SELECT 1 FROM public.contrato_pedidos cp
       WHERE cp.id = NEW.contrato_pedido_id
         AND cp.nota_fiscal IS NOT NULL
    )
    WHEN 'contrato_assinado' THEN EXISTS (
      -- O vínculo pode vir direto do contrato ou pelo pedido que o consome.
      SELECT 1 FROM public.contratos c
       WHERE c.data_assinatura IS NOT NULL
         AND (
           c.id = NEW.contrato_id
           OR c.id = (SELECT cp.contrato_id FROM public.contrato_pedidos cp
                       WHERE cp.id = NEW.contrato_pedido_id)
         )
    )
    ELSE true
  END;

  IF NOT v_ok THEN
    RAISE EXCEPTION
      'Bonificação só pode ser paga a partir do marco configurado para este colaborador (%). Vincule o lançamento ao contrato ou pedido correspondente.',
      v_evento
      USING ERRCODE = '23514';
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
  'Pedido que comprova o marco de pagamento (nota emitida ou NF-e quitada), '
  'conforme comissoes_config.evento_pagamento do colaborador.';
