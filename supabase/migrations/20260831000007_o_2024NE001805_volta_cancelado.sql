-- ═══════════════════════════════════════════════════════════════════════════
-- O 2024NE001805 volta, e volta CANCELADO
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A Administração cancelou o empenho, e por isso ele foi apagado do sistema.
-- Apagar é a resposta errada: o empenho EXISTIU, autorizou (ou deixou de
-- autorizar) e faz parte da história do contrato. Numa conferência sobre o
-- exercício de 2024, "não há registro" e "houve e foi cancelado" são respostas
-- diferentes, e só a segunda é verdadeira.
--
-- ── Cancelamento é anulação integral ────────────────────────────────────────
--
-- Não precisa de coluna nova. Cancelar um empenho é anulá-lo por inteiro — o
-- próprio Portal da Transparência rotula o movimento como "ANULACAO DE
-- EMPENHO", e o art. 38 da Lei 4.320/64 trata os dois pelo mesmo mecanismo:
-- reverte à dotação.
--
-- Com a anulação do valor total, `contrato_empenho_valor_vigente` devolve
-- zero, e o empenho deixa de autorizar qualquer coisa. O estado é DERIVADO dos
-- movimentos, não gravado — mesma razão de todos os outros saldos aqui.
--
-- Os dados saem do backup da 20260831000006, que é onde o registro apagado
-- ficou guardado.

BEGIN;

INSERT INTO public.contrato_empenhos
  (empresa_id, contrato_id, numero, tipo, tipo_origem, valor, quantidade,
   unidade, data_emissao, exercicio, observacao)
SELECT c.empresa_id, c.id, '2024NE001805',
       COALESCE(b.tipo_empenho, 'ordinario'),
       'manual',
       b.valor_total, b.quantidade, 'CX', b.data_pedido,
       COALESCE(EXTRACT(YEAR FROM b.data_pedido)::int, 2024),
       'CANCELADO PELA ADMINISTRAÇÃO. Mantido no sistema porque o empenho '
       || 'existiu e faz parte da história do contrato — apagá-lo faria a '
       || 'conferência do exercício de 2024 responder "não há registro" onde o '
       || 'correto é "houve e foi cancelado". Reconstituído a partir do backup '
       || 'bkp_pedidos_149_2024_20260831; valor, quantidade e espécie A '
       || 'CONFERIR no Portal da Transparência.'
  FROM public.bkp_pedidos_149_2024_20260831 b
  JOIN public.contratos c ON c.id = b.contrato_id
 WHERE b.numero_pedido ILIKE '%NE001805%'
ON CONFLICT (contrato_id, numero) DO NOTHING;

-- ── A anulação integral ─────────────────────────────────────────────────────
-- O valor é o do próprio empenho: cancelar é devolver tudo. Assim o vigente
-- fecha em zero e a tela pode dizer "cancelado" sem depender de ninguém ter
-- marcado uma caixinha.
INSERT INTO public.contrato_empenho_movimentos
  (empresa_id, empenho_id, tipo, numero, valor, data_movimento, observacao)
SELECT e.empresa_id, e.id, 'anulacao', NULL, e.valor,
       -- A data do cancelamento não é conhecida. Fica a da própria nota, e a
       -- observação diz que é provisória — data inventada que não se anuncia
       -- vira fato falso no dia em que alguém a citar.
       e.data_emissao,
       'Cancelamento integral pela Administração. DATA A CONFERIR: usada a da '
       || 'emissão do empenho porque a do cancelamento não foi informada.'
  FROM public.contrato_empenhos e
  JOIN public.contratos c ON c.id = e.contrato_id
 WHERE c.numero_contrato = '149/2024'
   AND e.numero = '2024NE001805'
   AND e.valor IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.contrato_empenho_movimentos m
      WHERE m.empenho_id = e.id AND m.tipo = 'anulacao'
   );

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────────
--
--   SELECT e.numero, e.tipo, e.exercicio, v.*
--     FROM public.contrato_empenhos e
--    CROSS JOIN LATERAL public.contrato_empenho_valor_vigente(e.id) v
--    WHERE e.numero IN ('2025NE000064','2024NE001805')
--    ORDER BY e.numero;
--
-- Agora devem vir DUAS linhas, e o 2024NE001805 com `valor_vigente` = 0,00 e
-- `anulacoes` igual ao `valor_original`.
