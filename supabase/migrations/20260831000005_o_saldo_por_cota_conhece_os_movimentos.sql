-- ═══════════════════════════════════════════════════════════════════════════
-- O saldo por cota passa a conhecer reforços e anulações
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Furo da 20260831000004: os movimentos foram criados, a função
-- `contrato_empenho_valor_vigente` os soma, e a tela os mostra — mas
-- `contrato_empenho_saldo_por_cota`, que é a função que a CHECAGEM DO PEDIDO
-- consulta, continuava calculando só o empenhado das linhas menos o consumido
-- dos pedidos.
--
-- O efeito seria o pior tipo de meio-conserto: registrar um reforço de
-- R$ 15.000 mostraria "empenhado hoje R$ 15.022,55" na tela do empenho, e o
-- pedido seguinte continuaria sendo barrado contra os R$ 22,55 originais. A
-- pessoa faria a coisa certa e o sistema a ignoraria.
--
-- ── Reforço e anulação NÃO são exclusivos do estimativo ─────────────────────
--
-- É a pergunta que revelou isto. Os três tipos podem ser reforçados e
-- anulados:
--
--   ORDINÁRIO   reforçado quando o valor se mostra insuficiente; anulado
--               quando a despesa não se realiza.
--   GLOBAL      reforçado junto com aditivo de valor; anulado no saldo não
--               utilizado.
--   ESTIMATIVO  reforçado como ROTINA — é a razão de ele existir.
--
-- E a anulação de fim de exercício vale para todos: o art. 38 da Lei 4.320/64
-- manda reverter à dotação a importância de despesa anulada, e empenho não
-- liquidado até o encerramento vira Restos a Pagar (art. 36) ou é cancelado.
--
-- O que É exclusivo do estimativo é o limite não BARRAR o pedido (`informativo`
-- em lib/contratos/cabimento.ts). Nos outros dois o número registrado é
-- confiável e pode decidir; no estimativo ele é sabidamente parcial.

-- ── O rateio do movimento entre as cotas ────────────────────────────────────
--
-- O movimento é do empenho inteiro; o saldo é por cota. Ratear pela proporção
-- do que cada cota tem empenhado é o único critério que não inventa:
-- distribuir igualmente mudaria a divisão do art. 48, III, e jogar tudo na
-- principal daria à reservada um saldo que o reforço não lhe deu.
--
-- Empenho SEM linhas por cota recebe tudo em 'principal', que é o mesmo
-- COALESCE que a função já usava.
CREATE OR REPLACE FUNCTION public.contrato_empenho_saldo_por_cota(p_empenho_id uuid)
RETURNS TABLE (
  cota             text,
  valor_empenhado  numeric,
  valor_consumido  numeric,
  saldo_valor      numeric,
  qtd_empenhada    numeric,
  qtd_consumida    numeric,
  saldo_qtd        numeric,
  pedidos          integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH empenhado AS (
    SELECT COALESCE(i.cota, 'principal') AS cota,
           SUM(i.valor_total) AS valor,
           SUM(i.quantidade)  AS qtd
      FROM public.contrato_empenho_itens i
     WHERE i.empenho_id = p_empenho_id
     GROUP BY 1
  ),
  consumido AS (
    SELECT COALESCE(p.cota, 'principal') AS cota,
           SUM(p.valor_total) AS valor,
           SUM(p.quantidade)  AS qtd,
           count(*)::int      AS n
      FROM public.contrato_pedidos p
     WHERE p.empenho_id = p_empenho_id
       AND p.status <> 'cancelado'
     GROUP BY 1
  ),
  -- Reforços menos anulações, do empenho inteiro.
  movimento AS (
    SELECT COALESCE(SUM(m.valor) FILTER (WHERE m.tipo = 'reforco'), 0)
         - COALESCE(SUM(m.valor) FILTER (WHERE m.tipo = 'anulacao'), 0) AS liquido
      FROM public.contrato_empenho_movimentos m
     WHERE m.empenho_id = p_empenho_id
  ),
  base AS (
    SELECT COALESCE(e.cota, c.cota) AS cota,
           COALESCE(e.valor, 0)     AS valor_emp,
           COALESCE(c.valor, 0)     AS valor_con,
           COALESCE(e.qtd, 0)       AS qtd_emp,
           COALESCE(c.qtd, 0)       AS qtd_con,
           COALESCE(c.n, 0)         AS n
      FROM empenhado e
      FULL OUTER JOIN consumido c ON c.cota = e.cota
  ),
  total AS (SELECT NULLIF(SUM(valor_emp), 0) AS soma FROM base)
  SELECT b.cota,
         -- O rateio: cada cota recebe do movimento a mesma fração que ela tem
         -- do empenhado. Sem linhas por cota, `soma` é nula e o movimento
         -- inteiro cai na única cota que existe.
         b.valor_emp + (m.liquido * COALESCE(b.valor_emp / t.soma, 1)),
         b.valor_con,
         b.valor_emp + (m.liquido * COALESCE(b.valor_emp / t.soma, 1)) - b.valor_con,
         b.qtd_emp,
         b.qtd_con,
         -- A QUANTIDADE não é tocada pelo movimento: reforço e anulação são
         -- atos de VALOR. Somar quantidade a partir de dinheiro exigiria um
         -- preço unitário que a nota de reforço não traz.
         b.qtd_emp - b.qtd_con,
         b.n
    FROM base b CROSS JOIN movimento m CROSS JOIN total t;
$$;

COMMENT ON FUNCTION public.contrato_empenho_saldo_por_cota(uuid) IS
  'O que resta de cada cota do empenho, já contando reforços e anulações. O '
  'movimento é do empenho inteiro e é rateado entre as cotas pela proporção do '
  'empenhado — distribuir igualmente mudaria a divisão do art. 48, III. A '
  'QUANTIDADE não é afetada: reforço e anulação são atos de valor, e derivar '
  'quantidade de dinheiro exigiria um preço unitário que a nota não traz.';

-- ── Conferência ─────────────────────────────────────────────────────────────
--
-- Antes e depois de lançar um reforço, o saldo em VALOR tem de mudar e o de
-- QUANTIDADE tem de ficar igual:
--
--   SELECT e.numero, e.tipo, s.*
--     FROM public.contrato_empenhos e
--    CROSS JOIN LATERAL public.contrato_empenho_saldo_por_cota(e.id) s
--    ORDER BY e.numero, s.cota;
--
-- E a soma das cotas tem de bater com o vigente do empenho:
--
--   SELECT e.numero,
--          (SELECT SUM(saldo_valor + valor_consumido)
--             FROM public.contrato_empenho_saldo_por_cota(e.id)) AS por_cota,
--          v.valor_vigente
--     FROM public.contrato_empenhos e
--    CROSS JOIN LATERAL public.contrato_empenho_valor_vigente(e.id) v;
--
-- As duas colunas devem ser iguais em todo empenho que tenha linhas por cota.
