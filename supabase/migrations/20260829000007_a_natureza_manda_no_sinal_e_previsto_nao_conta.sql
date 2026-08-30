-- ═══════════════════════════════════════════════════════════════════════════
-- A natureza manda no sinal, e o que é previsto não entra no saldo
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O Banpará PJ da ETHOS mostrava R$ 3.523.216,96. O saldo real na conta é
-- R$ 1.914,89. Sobra de R$ 3.521.302,07.
--
-- A decomposição do saldo bateu ao centavo com a fórmula — ou seja, ela estava
-- somando exatamente o que mandei somar. O defeito é o que mandei.
--
-- ── Defeito 1: transferência não respeitava o status ────────────────────────
--
-- Erro meu, introduzido na 20260827000002. `a_receber` e `a_pagar` só entram
-- quando `realizado` ou `conciliado`. `transferencia` não tinha essa condição:
--
--     WHEN tipo = 'transferencia' AND natureza IN ('despesa','receita') THEN ...
--
-- Sem filtro de status, transferência PREVISTA — que ainda não aconteceu —
-- mexia no saldo como se tivesse acontecido. No Banpará são 9 lançamentos
-- previstos, somando −R$ 2.464.000,00.
--
-- Saldo é o dinheiro que ESTÁ na conta. Previsão pertence ao fluxo de caixa,
-- que é outra tela e outra pergunta.
--
-- ── Defeito 2: o tipo decidia o sinal, ignorando a natureza ─────────────────
--
--     WHEN tipo = 'a_receber' AND status IN (...) THEN  valor
--     WHEN tipo = 'a_pagar'   AND status IN (...) THEN -valor
--
-- O sinal vinha do TIPO do documento, não da direção do dinheiro. E existem,
-- no Banpará, 5 lançamentos `a_receber` com natureza `despesa` — somando
-- R$ 1.744.123,37, entre eles "NF 728 – CARNE MOIDA" (R$ 1.343.620,57) e
-- "NF 727 – CARNE MOIDA" (R$ 373.015,11). São compras lançadas como conta a
-- receber.
--
-- A fórmula somava esses R$ 1,74 milhão ao saldo. Deveria subtrair. O erro de
-- uma linha assim é 2× o valor dela.
--
-- A regra passa a ser a mesma em todo lugar: **`natureza` diz para onde o
-- dinheiro foi; `tipo` diz que documento é.** É como `movimento_bancario` e a
-- perna espelhada de transferência já funcionavam — faltava valer para os
-- títulos.
--
-- ── Defeito 3: duplicata de importação (NÃO corrigido aqui) ─────────────────
--
-- A mesma conta tem 17 grupos de lançamentos repetidos: "MOVIMENTAÇÃO" de
-- R$ 300.000,00 em 17/06 aparece 3 vezes; três TEDs de R$ 250.000,00 aparecem
-- 2 vezes cada; "TAR PIX EXTE EMISSAO" de R$ 12,00 em 02/01 aparece 6 vezes.
-- Somam mais de R$ 1,3 milhão em excesso.
--
-- Isso é dado, não fórmula, e apagar lançamento é irreversível: fica como
-- decisão de quem conhece o extrato. O roteiro está no fim deste arquivo.

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
      -- ── Nada previsto entra no saldo ──────────────────────────────────────
      -- Saldo é o dinheiro que ESTÁ na conta. Previsão é fluxo de caixa, que é
      -- outra tela. Cancelado idem.
      WHEN status NOT IN ('realizado','conciliado') THEN 0

      -- ── Transferência espelhada: a natureza diz o lado ────────────────────
      -- Age só na própria conta_id; a outra perna cuida da outra conta.
      WHEN tipo = 'transferencia' AND natureza IN ('despesa','receita') THEN
        CASE WHEN conta_id = p_conta_id
             THEN CASE WHEN natureza = 'despesa' THEN -valor ELSE valor END
             ELSE 0 END

      -- ── Transferência de linha única: sai da origem, entra no destino ─────
      WHEN tipo = 'transferencia' AND conta_id = p_conta_id         THEN -valor
      WHEN tipo = 'transferencia' AND conta_destino_id = p_conta_id THEN  valor

      -- Daqui para baixo, só conta o que é DESTA conta.
      WHEN conta_id IS DISTINCT FROM p_conta_id THEN 0

      -- ── Título e movimento de extrato: a NATUREZA manda no sinal ──────────
      -- Antes o sinal vinha do TIPO — `a_receber` somava, `a_pagar` subtraía —
      -- e 5 compras lançadas como "a receber" entraram somando R$ 1.744.123,37
      -- numa conta só. `tipo` diz que documento é; `natureza` diz para onde o
      -- dinheiro foi, e é a direção que o saldo precisa.
      --
      -- `movimentacao` continua não contando: não diz direção, e somar por
      -- omissão já produziu R$ 48.907,10 de saldo inexistente em agosto.
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
  'saldo_atual = saldo_inicial + o que de fato entrou e saiu. Duas regras '
  'governam tudo: só entra o que está realizado ou conciliado (previsto é '
  'fluxo de caixa, não saldo), e quem decide o sinal é a NATUREZA, não o tipo '
  'do documento — 5 compras lançadas como "a receber" somavam R$ 1.744.123,37 '
  'ao saldo do Banpará em vez de subtrair. `movimentacao` não conta, porque '
  'não diz direção.';

-- ── A invariante: tipo e natureza precisam concordar ────────────────────────
-- Conta a receber com natureza de despesa é dado incoerente. A fórmula agora
-- resolve pelo lado seguro, mas o lugar de barrar isso é a entrada.
--
-- NOT VALID: as 5 linhas do Banpará (e o que houver nas outras contas)
-- continuam existindo para poderem ser conferidas e corrigidas. O roteiro
-- está no fim.
ALTER TABLE public.financeiro_lancamentos
  DROP CONSTRAINT IF EXISTS chk_titulo_natureza_coerente;
ALTER TABLE public.financeiro_lancamentos
  ADD CONSTRAINT chk_titulo_natureza_coerente
  CHECK (
    tipo NOT IN ('a_receber','a_pagar')
    OR (tipo = 'a_receber' AND natureza = 'receita')
    OR (tipo = 'a_pagar'   AND natureza = 'despesa')
  ) NOT VALID;

COMMENT ON CONSTRAINT chk_titulo_natureza_coerente ON public.financeiro_lancamentos IS
  'Conta a receber é receita; conta a pagar é despesa. A combinação trocada '
  'existia e somava ao saldo o que deveria subtrair.';

-- Recalcula tudo com a fórmula corrigida.
SELECT public.financeiro_recalcular_saldo_conta(id) FROM public.financeiro_contas;

-- ── Roteiro ─────────────────────────────────────────────────────────────────
--
-- 1. Os títulos com tipo e natureza trocados, em todas as empresas. São eles
--    que o CHECK acima recusaria:
--
--    SELECT e.razao_social, c.nome AS conta, l.data_competencia, l.descricao,
--           l.tipo, l.natureza, l.status, l.valor
--      FROM public.financeiro_lancamentos l
--      JOIN public.financeiro_contas c ON c.id = l.conta_id
--      JOIN public.empresas e ON e.id = l.empresa_id
--     WHERE (l.tipo = 'a_receber' AND l.natureza <> 'receita')
--        OR (l.tipo = 'a_pagar'   AND l.natureza <> 'despesa')
--     ORDER BY l.valor DESC;
--
--    Corrigido cada um (trocar o tipo ou a natureza — só quem conhece a nota
--    pode dizer qual), valide:
--      ALTER TABLE public.financeiro_lancamentos
--        VALIDATE CONSTRAINT chk_titulo_natureza_coerente;
--
-- 2. As duplicatas. Esta lista mostra os grupos e quanto sobra em cada um:
--
--    SELECT c.nome AS conta, l.data_competencia, l.descricao, l.valor,
--           count(*) AS vezes, (count(*) - 1) * l.valor AS excesso
--      FROM public.financeiro_lancamentos l
--      JOIN public.financeiro_contas c ON c.id = l.conta_id
--     GROUP BY 1,2,3,4
--    HAVING count(*) > 1
--     ORDER BY (count(*) - 1) * l.valor DESC;
--
--    NÃO apague sem conferir o extrato: pagamento repetido de mesmo valor no
--    mesmo dia existe (tarifa por operação, por exemplo, e "TAR PIX EXTE
--    EMISSAO" de R$ 12,00 seis vezes num dia pode ser real). Duplicata de
--    importação é a que tem o mesmo valor E a mesma descrição E não aparece
--    duas vezes no extrato do banco.
--
-- 3. Depois de limpar, confira contra o extrato:
--
--    SELECT nome, saldo_inicial, saldo_atual FROM public.financeiro_contas
--     WHERE empresa_id = (SELECT id FROM public.empresas WHERE razao_social ILIKE 'ETHOS%')
--     ORDER BY nome;
