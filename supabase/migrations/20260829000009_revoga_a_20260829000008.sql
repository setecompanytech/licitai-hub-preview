-- ═══════════════════════════════════════════════════════════════════════════
-- Revoga a 20260829000008 — a premissa dela era falsa
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A 20260829000008 trocou o discriminador do ramo de transferência:
--
--     antes:  WHEN tipo = 'transferencia' AND natureza IN ('despesa','receita')
--     depois: WHEN tipo = 'transferencia' AND conta_destino_id IS NULL
--
-- Escrevi que perna espelhada tem `conta_destino_id` nulo. Não verifiquei isso
-- contra os dados. Escrevi a migration, escrevi o comentário longo explicando
-- o raciocínio, e nada disso torna a premissa verdadeira.
--
-- ── O que aconteceu ao aplicar ──────────────────────────────────────────────
--
--   Banpará PJ            2.498.970,22 →  2.132.030,48
--   Bradesco PJ                    ok  →    −10.415,90
--   Caixinha                       ok  →    −70.119,00
--   Inter PJ                       ok  →   −223.671,64
--   Itaú PJ                        ok  → −2.975.953,63
--
-- Quatro contas negativas. `useCasarTransferencia` cria transferência de LINHA
-- ÚNICA com `natureza = 'movimentacao'` E `conta_destino_id` preenchido — e a
-- regra nova mandava linhas com destino preenchido para o ramo de linha única
-- independentemente de já existir a outra perna, contando o mesmo dinheiro
-- duas vezes.
--
-- ── A lição, que é a mesma de sempre ────────────────────────────────────────
--
-- Cada correção desta semana veio de conferir a fórmula contra os dados. Esta
-- veio de olhar a fórmula e raciocinar sobre ela — e o raciocínio estava certo
-- em tese e errado na base. Fórmula de saldo não se corrige por dedução; se
-- corrige medindo antes e depois.
--
-- Este arquivo devolve a fórmula da 20260829000007, que continua valendo:
--   • só entra o que está realizado ou conciliado;
--   • quem decide o sinal é a natureza, não o tipo do documento.
--
-- ── O que fica em aberto ────────────────────────────────────────────────────
--
-- O defeito que a 20260829000008 tentava corrigir É REAL: no Banpará, em
-- 19/03, duas pernas da mesma transferência de R$ 12.000,00 subtraem cada uma.
-- Continua errado, e a conferência segue acusando "transferência sem par".
--
-- Corrigir exige primeiro saber como as duas formas realmente convivem na
-- base. A consulta que responde:
--
--   SELECT natureza,
--          count(*) FILTER (WHERE conta_destino_id IS NULL)     AS sem_destino,
--          count(*) FILTER (WHERE conta_destino_id IS NOT NULL) AS com_destino
--     FROM public.financeiro_lancamentos
--    WHERE tipo = 'transferencia'
--    GROUP BY 1 ORDER BY 1;

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
      -- Saldo é o dinheiro que ESTÁ na conta.
      WHEN status NOT IN ('realizado','conciliado') THEN 0

      -- Perna espelhada: age só na própria conta_id.
      WHEN tipo = 'transferencia' AND natureza IN ('despesa','receita') THEN
        CASE WHEN conta_id = p_conta_id
             THEN CASE WHEN natureza = 'despesa' THEN -valor ELSE valor END
             ELSE 0 END

      -- Linha única: sai da origem, entra no destino.
      WHEN tipo = 'transferencia' AND conta_id = p_conta_id         THEN -valor
      WHEN tipo = 'transferencia' AND conta_destino_id = p_conta_id THEN  valor

      WHEN conta_id IS DISTINCT FROM p_conta_id THEN 0

      -- A natureza manda no sinal.
      WHEN tipo IN ('a_receber','a_pagar','movimento_bancario') THEN
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
  'saldo_atual = saldo_inicial + o que de fato entrou e saiu. Só entra o que '
  'está realizado ou conciliado, e quem decide o sinal é a NATUREZA, não o '
  'tipo do documento. O ramo de transferência ainda conta duas vezes a perna '
  'espelhada cuja natureza é `movimentacao` — defeito conhecido, R$ 12.000,00 '
  'no Banpará em 19/03/2026; a tentativa de corrigi-lo pelo destino nulo '
  '(20260829000008) partiu de premissa falsa e foi revogada.';

SELECT public.financeiro_recalcular_saldo_conta(id) FROM public.financeiro_contas;
