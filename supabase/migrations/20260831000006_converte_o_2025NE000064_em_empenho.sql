-- ═══════════════════════════════════════════════════════════════════════════
-- O 2025NE000064 vira o empenho que ele é, com a vida que teve
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Dois "pedidos" do contrato 149/2024 são notas de empenho: 2025NE000064 e
-- 2024NE001805. Entraram como pedidos porque a bifurcação casava grafias
-- exatas contra um campo que a IA escreve livre — corrigido na 2026-08-31.29.
--
-- Enquanto figurarem como pedidos, eles consomem saldo de contrato sem que
-- entrega nenhuma tenha ocorrido, e o empenho não existe para autorizar as
-- entregas de verdade.
--
-- ── Os dados vêm do Portal da Transparência do Pará ─────────────────────────
--
-- https://www.sistemas.pa.gov.br/portaltransparencia/empenho/notas/detalhe/
--   310101000002025NE00006400001
--
-- E a aritmética do Portal fecha ao centavo, o que dá confiança na leitura:
--
--   reforços (10)   R$ 159.957,00
--   anulação  (1)   R$  24.722,00
--   ────────────────────────────────
--   líquido         R$ 135.235,00   ← exatamente o "Total" que o Portal exibe
--
--   pagamentos (9)  R$ 135.232,00
--
-- ── CORREÇÃO: a modalidade é ORDINÁRIO, não estimativo ─────────────────────
--
-- O Portal é explícito: "Modalidade: Ordinário". A conversa que precedeu esta
-- migration partiu de "dois empenhos na modalidade ESTIMATIVO", e o documento
-- oficial diz outra coisa.
--
-- O que se observa é um ordinário OPERADO como estimativo: nota inicial de
-- R$ 22,55 e dez reforços ao longo de 2025. Pelo Decreto 93.872/86 o ordinário
-- é para despesa de valor previamente conhecido e pagamento de uma só vez —
-- não é o que aconteceu aqui.
--
-- Isto NÃO se corrige no sistema. A classificação é ato do órgão, e o registro
-- tem de espelhar o documento, não o que a prática sugere. Fica `ordinario`,
-- com a observação registrando o que se viu — é assim que a divergência
-- permanece visível para quem for questionar.
--
-- ── Uma divergência de R$ 0,55 que fica anotada ─────────────────────────────
--
-- O Portal mostra o item com valor unitário 22,55 e valor total R$ 22,00. Os
-- dois não podem estar certos ao mesmo tempo. Adoto R$ 22,55, que é o valor
-- que o dono do produto confirmou e que bate com o unitário — mas a diferença
-- fica escrita aqui para quem conferir depois não achar que passou batido.

BEGIN;

-- ── 1. O que existe hoje, guardado antes ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bkp_pedidos_149_2024_20260831 AS
SELECT p.*
  FROM public.contrato_pedidos p
  JOIN public.contratos c ON c.id = p.contrato_id
 WHERE c.numero_contrato = '149/2024'
   AND (p.numero_pedido ILIKE '%NE000064%' OR p.numero_pedido ILIKE '%NE001805%');

-- ── 2. Títulos ligados a esses pedidos, se houver ───────────────────────────
-- Apagar o pedido com `contrato_pedido_id` apontando para ele deixaria o
-- lançamento órfão. Soltar ANTES é o que evita o vínculo pendurado — e o
-- lançamento continua no Financeiro, que é onde ele deve estar.
UPDATE public.financeiro_lancamentos l
   SET contrato_pedido_id = NULL
  FROM public.contrato_pedidos p
  JOIN public.contratos c ON c.id = p.contrato_id
 WHERE l.contrato_pedido_id = p.id
   AND c.numero_contrato = '149/2024'
   AND (p.numero_pedido ILIKE '%NE000064%' OR p.numero_pedido ILIKE '%NE001805%');

-- ── 3. O empenho 2025NE000064 ───────────────────────────────────────────────
INSERT INTO public.contrato_empenhos
  (empresa_id, contrato_id, numero, tipo, tipo_origem, valor, quantidade,
   unidade, data_emissao, exercicio, observacao)
SELECT c.empresa_id, c.id,
       '2025NE000064',
       -- O que o Portal diz. Ver a nota sobre modalidade no cabeçalho.
       'ordinario',
       'documento',
       22.55,
       2802,
       'CX',
       DATE '2025-01-01',   -- o Portal não exibe a data de emissão da nota
       2025,
       'Convertido de lançamento que estava como pedido. Dados do Portal da '
       || 'Transparência do Pará (310101000002025NE00006400001). O Portal '
       || 'classifica como ORDINÁRIO, mas a nota foi operada como estimativa: '
       || 'valor inicial de R$ 22,55 e dez reforços ao longo de 2025. O Portal '
       || 'exibe o item com unitário 22,55 e total R$ 22,00 — adotado 22,55.'
  FROM public.contratos c
 WHERE c.numero_contrato = '149/2024'
ON CONFLICT (contrato_id, numero) DO NOTHING;

-- ── 4. O item ───────────────────────────────────────────────────────────────
INSERT INTO public.contrato_empenho_itens
  (empresa_id, empenho_id, contrato_item_id, cota, descricao, quantidade,
   unidade, valor_unitario, valor_total)
SELECT c.empresa_id, e.id,
       -- O item do contrato, se a descrição casar. Nulo é melhor do que um
       -- vínculo errado: o saldo por item passaria a contar o produto errado.
       (SELECT i.id FROM public.contrato_itens i
         WHERE i.contrato_id = c.id
           AND i.descricao ILIKE '%AGUA MINERAL%'
         LIMIT 1),
       NULL,   -- o Portal não indica divisão em cotas nesta nota
       '#1#142778# AGUA MINERAL 48 COPOS C/ 200ML',
       2802, 'CX', 22.55, 22.55
  FROM public.contratos c
  JOIN public.contrato_empenhos e
    ON e.contrato_id = c.id AND e.numero = '2025NE000064'
 WHERE c.numero_contrato = '149/2024'
   AND NOT EXISTS (
     SELECT 1 FROM public.contrato_empenho_itens x WHERE x.empenho_id = e.id
   );

-- ── 5. A vida do empenho: dez reforços e uma anulação ───────────────────────
INSERT INTO public.contrato_empenho_movimentos
  (empresa_id, empenho_id, tipo, numero, valor, data_movimento, observacao)
SELECT c.empresa_id, e.id, m.tipo, m.numero, m.valor, m.data,
       'Portal da Transparência do Pará'
  FROM public.contratos c
  JOIN public.contrato_empenhos e
    ON e.contrato_id = c.id AND e.numero = '2025NE000064'
 CROSS JOIN (VALUES
    ('reforco',  '2025NE000068', 13462.00, DATE '2025-02-04'),
    ('reforco',  '2025NE000418', 11250.00, DATE '2025-03-14'),
    ('reforco',  '2025NE000435', 11275.00, DATE '2025-03-18'),
    ('reforco',  '2025NE000623', 22500.00, DATE '2025-04-17'),
    ('reforco',  '2025NE001241', 13500.00, DATE '2025-07-21'),
    ('reforco',  '2025NE001291', 13530.00, DATE '2025-07-29'),
    ('reforco',  '2025NE002118',  4510.00, DATE '2025-09-16'),
    ('reforco',  '2025NE002134',  6765.00, DATE '2025-09-17'),
    -- A anulação é do MESMO dia de um reforço. Não é erro de leitura: o órgão
    -- ajustou nos dois sentidos em 18/09.
    ('anulacao', '2025NE002164', 24722.00, DATE '2025-09-18'),
    ('reforco',  '2025NE002381',  6765.00, DATE '2025-10-15'),
    ('reforco',  '2025NE002851', 56400.00, DATE '2025-11-11')
  ) AS m(tipo, numero, valor, data)
 WHERE c.numero_contrato = '149/2024'
   AND NOT EXISTS (
     SELECT 1 FROM public.contrato_empenho_movimentos x
      WHERE x.empenho_id = e.id AND x.numero = m.numero
   );

-- ── 6. O empenho 2024NE001805 ───────────────────────────────────────────────
-- Sem página do Portal para esta nota. Entra com o que o próprio registro
-- errado guardava, e a observação diz o que falta — melhor um empenho
-- incompleto e VISÍVEL do que um pedido que consome saldo indevidamente.
INSERT INTO public.contrato_empenhos
  (empresa_id, contrato_id, numero, tipo, tipo_origem, valor, quantidade,
   unidade, data_emissao, exercicio, observacao)
SELECT c.empresa_id, c.id, '2024NE001805',
       COALESCE(p.tipo_empenho, 'ordinario'),
       'manual',
       p.valor_total, p.quantidade, 'CX',
       p.data_pedido,
       COALESCE(EXTRACT(YEAR FROM p.data_pedido)::int, 2024),
       'Convertido de lançamento que estava como pedido. FALTA CONFERIR no '
       || 'Portal da Transparência: valor, quantidade, espécie e os reforços '
       || 'e anulações do exercício de 2024.'
  FROM public.contrato_pedidos p
  JOIN public.contratos c ON c.id = p.contrato_id
 WHERE c.numero_contrato = '149/2024'
   AND p.numero_pedido ILIKE '%NE001805%'
 LIMIT 1
ON CONFLICT (contrato_id, numero) DO NOTHING;

-- ── 7. Os pedidos saem ──────────────────────────────────────────────────────
-- Não representam entrega nenhuma. O backup do passo 1 permite refazer.
DELETE FROM public.contrato_pedidos p
 USING public.contratos c
 WHERE c.id = p.contrato_id
   AND c.numero_contrato = '149/2024'
   AND (p.numero_pedido ILIKE '%NE000064%' OR p.numero_pedido ILIKE '%NE001805%');

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────────
--
-- 1. O vigente do 2025NE000064 tem de dar R$ 135.257,55:
--       22,55 + 159.957,00 − 24.722,00
--
--    SELECT e.numero, e.tipo, e.exercicio, v.*
--      FROM public.contrato_empenhos e
--     CROSS JOIN LATERAL public.contrato_empenho_valor_vigente(e.id) v
--     WHERE e.numero IN ('2025NE000064','2024NE001805');
--
--    `reforcos` deve dar 159.957,00, `anulacoes` 24.722,00 e `movimentos` 11.
--
-- 2. O líquido dos movimentos tem de bater com o "Total" do Portal:
--
--    SELECT SUM(valor) FILTER (WHERE tipo = 'reforco')
--         - SUM(valor) FILTER (WHERE tipo = 'anulacao') AS liquido
--      FROM public.contrato_empenho_movimentos m
--      JOIN public.contrato_empenhos e ON e.id = m.empenho_id
--     WHERE e.numero = '2025NE000064';
--
--    Esperado: 135235.00
--
-- 3. O contrato 149/2024 deve perder o consumo que os pedidos falsos criavam:
--
--    SELECT numero_contrato, valor_global, valor_consumido, saldo_remanescente
--      FROM public.contratos WHERE numero_contrato = '149/2024';
--
-- ── Para desfazer ───────────────────────────────────────────────────────────
--
--   INSERT INTO public.contrato_pedidos
--   SELECT * FROM public.bkp_pedidos_149_2024_20260831;
--   DELETE FROM public.contrato_empenhos
--    WHERE numero IN ('2025NE000064','2024NE001805');
--
-- Itens e movimentos saem junto, por ON DELETE CASCADE. Os títulos soltos no
-- passo 2 NÃO voltam a apontar sozinhos — se houver algum, o vínculo se refaz
-- pelo ícone de elo no Financeiro.
