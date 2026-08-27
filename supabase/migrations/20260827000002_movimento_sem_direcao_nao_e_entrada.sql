-- ═══════════════════════════════════════════════════════════════════════════
-- Movimento de extrato sem direção declarada não pode virar entrada
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Defeito meu, introduzido em 25/08 na 20260825000002 e agravado na
-- 20260825000006. A fórmula do saldo fazia:
--
--     WHEN tipo = 'movimento_bancario' ... THEN
--       CASE WHEN natureza = 'despesa' THEN -valor ELSE valor END
--
-- Ela assume que `natureza` é `receita` OU `despesa`. Mas o enum
-- `financeiro_natureza` tem TRÊS valores, e o terceiro — `movimentacao` — caía
-- no ELSE e virava entrada.
--
-- ── O que isso custou, em número fechado ────────────────────────────────────
-- No Banpará PJ do GRUPO SANTA ROSA há dois lançamentos "PAGTO PIX EXTERNO"
-- com natureza `movimentacao`: R$ 9.874,99 e R$ 14.578,56, somando
-- R$ 24.453,55. São pagamentos — saída, sem ambiguidade.
--
--   saldo gravado    R$ 50.821,99
--   saldo no banco   R$  1.914,89
--   diferença        R$ 48.907,10  =  2 × 24.453,55
--
-- O dobro é a assinatura de sinal invertido: somar +X onde deveria −X erra
-- por 2X. E a tela de Lançamentos usava a régua oposta (`natureza <> 'receita'`
-- → saída), então os cartões mostravam o resultado certo enquanto o saldo
-- mostrava o errado. Duas leituras do mesmo campo, com sinais contrários — o
-- defeito que esta semana inteira se dedicou a remover, e que eu reintroduzi.
--
-- ── A regra nova ────────────────────────────────────────────────────────────
-- A fórmula deixa de adivinhar. Movimento de extrato só entra no saldo quando
-- a natureza diz a direção; `movimentacao` não diz, então NÃO CONTA e a
-- conferência acusa. Contar errado é pior do que não contar: o saldo errado
-- parece resposta, e o saldo incompleto pede conferência.

CREATE OR REPLACE FUNCTION public.financeiro_recalcular_saldo_conta(p_conta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_inicial numeric(15,2);
  v_movimento numeric(15,2);
BEGIN
  SELECT saldo_inicial INTO v_saldo_inicial FROM public.financeiro_contas WHERE id = p_conta_id;

  SELECT COALESCE(SUM(
    CASE
      -- Perna de transferência espelhada: a natureza diz o lado, e ela só age
      -- na própria conta_id. A outra perna cuida da outra conta.
      WHEN tipo = 'transferencia' AND natureza IN ('despesa','receita') THEN
        CASE WHEN conta_id = p_conta_id
             THEN CASE WHEN natureza = 'despesa' THEN -valor ELSE valor END
             ELSE 0 END

      -- Transferência de linha única: sai da origem, entra no destino.
      WHEN tipo = 'transferencia' AND conta_id = p_conta_id         THEN -valor
      WHEN tipo = 'transferencia' AND conta_destino_id = p_conta_id THEN  valor

      -- Daqui para baixo, só conta o que é DESTA conta.
      WHEN conta_id IS DISTINCT FROM p_conta_id THEN 0

      WHEN tipo = 'a_receber' AND status IN ('realizado','conciliado') THEN  valor
      WHEN tipo = 'a_pagar'   AND status IN ('realizado','conciliado') THEN -valor

      -- Movimento de extrato: a natureza tem de dizer a direção. `receita`
      -- entra, `despesa` sai, e `movimentacao` NÃO CONTA — porque não diz nada,
      -- e somar por omissão foi o que produziu R$ 48.907,10 de saldo
      -- inexistente numa conta só. A conferência acusa os que ficarem de fora.
      WHEN tipo = 'movimento_bancario' AND status IS DISTINCT FROM 'cancelado' THEN
        CASE natureza
          WHEN 'receita' THEN  valor
          WHEN 'despesa' THEN -valor
          ELSE 0
        END

      ELSE 0
    END
  ), 0) INTO v_movimento
  FROM public.financeiro_lancamentos
  WHERE conta_id = p_conta_id OR conta_destino_id = p_conta_id;

  UPDATE public.financeiro_contas
  SET saldo_atual = COALESCE(v_saldo_inicial,0) + COALESCE(v_movimento,0), updated_at = now()
  WHERE id = p_conta_id;
END;
$$;

COMMENT ON FUNCTION public.financeiro_recalcular_saldo_conta(uuid) IS
  'saldo_atual = saldo_inicial + movimentos desta conta. Movimento de extrato '
  'só entra quando a natureza diz a direção: receita entra, despesa sai, '
  'movimentacao NÃO conta — somar por omissão produziu R$ 48.907,10 de saldo '
  'inexistente numa conta em 2026-08. Transferência vem em dois formatos: '
  'perna espelhada (age só na própria conta_id) e linha única (sai da origem, '
  'entra no destino).';

-- ── A invariante, para não voltar ───────────────────────────────────────────
-- Movimento de extrato é sempre entrada ou saída — o banco não tem terceira
-- opção. Quem grava sem direção está gravando dado incompleto, e o lugar de
-- barrar isso é a entrada, não o relatório.
--
-- NOT VALID: as linhas que já existem continuam, para a migration não travar
-- em dado torto. O roteiro de correção está no fim.
ALTER TABLE public.financeiro_lancamentos
  DROP CONSTRAINT IF EXISTS chk_movimento_bancario_tem_direcao;
ALTER TABLE public.financeiro_lancamentos
  ADD CONSTRAINT chk_movimento_bancario_tem_direcao
  CHECK (tipo <> 'movimento_bancario' OR natureza IN ('receita','despesa')) NOT VALID;

COMMENT ON CONSTRAINT chk_movimento_bancario_tem_direcao ON public.financeiro_lancamentos IS
  'Movimento de extrato precisa dizer se entrou ou saiu. Com natureza '
  '`movimentacao` ele não diz, e a fórmula do saldo o somava por omissão.';

-- Recalcula todas as contas com a fórmula corrigida.
SELECT public.financeiro_recalcular_saldo_conta(id) FROM public.financeiro_contas;

-- ── Roteiro ─────────────────────────────────────────────────────────────────
--
-- 1. Quem está sem direção, em todas as empresas:
--
--    SELECT e.razao_social, c.nome AS conta, l.data_competencia, l.descricao,
--           l.valor, l.origem
--      FROM public.financeiro_lancamentos l
--      JOIN public.financeiro_contas c ON c.id = l.conta_id
--      JOIN public.empresas e ON e.id = c.empresa_id
--     WHERE l.tipo = 'movimento_bancario'
--       AND l.natureza NOT IN ('receita','despesa')
--     ORDER BY e.razao_social, l.data_competencia;
--
-- 2. Corrigido o sentido de cada um (só quem conhece o extrato pode dizer),
--    valide a restrição:
--
--    ALTER TABLE public.financeiro_lancamentos
--      VALIDATE CONSTRAINT chk_movimento_bancario_tem_direcao;
