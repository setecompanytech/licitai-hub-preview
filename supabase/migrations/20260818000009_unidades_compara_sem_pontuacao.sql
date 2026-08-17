-- =============================================================================
-- Unidades: comparar ignorando pontuação e acento, como o front já fazia
--
-- A 20260818000008 comparou texto literal e deixou escapar `UND.` — o ponto
-- final bastou para não casar com `UND`. No front isso não acontece: a chave de
-- comparação remove pontuação e acento antes de olhar a tabela.
--
-- Ou seja: a lista em SQL era um espelho escrito à mão da regra em TypeScript, e
-- divergiu na primeira execução. Aqui o SQL passa a aplicar a MESMA regra —
-- maiúsculas, sem acento, sem pontuação — em vez de tentar antecipar cada
-- grafia possível.
--
-- O que continua de fora, e deve mesmo:
--   'Embalagem 2 L' (4) · 'Botijão 13 KG' (1) · 'Caixa 1 L' (1) — descrição de
--   embalagem no campo de unidade. Sem pontuação viram 'EMBALAGEM2L',
--   'BOTIJAO13KG', 'CAIXA1L': não casam com nada, e é o correto. Converter
--   exigiria adivinhar, e adivinhar apaga o que o edital trouxe.
--   'QCG' (1) — código que não reconhecemos. Fica como está.
-- =============================================================================

DO $$
DECLARE
  t text;
  mapa text[][] := ARRAY[
    ['UNIDADE', 'UN'], ['UND', 'UN'], ['UNID', 'UN'], ['U', 'UN'],
    ['CAIXA', 'CX'],
    ['QUILO', 'KG'], ['QUILOS', 'KG'], ['QUILOGRAMA', 'KG'],
    ['LITRO', 'L'], ['LITROS', 'L'],
    ['PACOTE', 'PCT'], ['PACOTES', 'PCT'],
    ['METRO', 'M'], ['METROS', 'M'],
    ['PECA', 'PC'],
    ['SACO', 'SC'], ['SACOS', 'SC'],
    ['FRASCO', 'FR'], ['FRC', 'FR'],
    ['LATA', 'LT'],
    ['DUZIA', 'DZ'],
    ['SERVICO', 'SERV'], ['SV', 'SERV'],
    ['HORA', 'HR'], ['HORAS', 'HR'],
    ['GRAMA', 'G'], ['GRAMAS', 'G'],
    ['TONELADA', 'TON'], ['TONELADAS', 'TON']
  ];
  par text[];
  tabelas text[] := ARRAY[
    'produtos', 'contrato_itens', 'licitacao_itens', 'edital_itens_extraidos',
    'catalogo_itens_precificados', 'pedido_itens', 'itens_pedido_compra',
    'nota_fiscal_itens', 'pre_nota_itens', 'quotation_items',
    'shopping_list_items', 'products_normalized', 'agent_itens_edital',
    'agent_historico_precos'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;

    FOREACH par SLICE 1 IN ARRAY mapa LOOP
      -- A chave: sem acento (translate), sem pontuação (regexp), maiúscula.
      -- Mesma regra de `chave()` em src/lib/unidades.ts.
      EXECUTE format(
        'UPDATE public.%I SET unidade = %L
          WHERE regexp_replace(
                  upper(translate(btrim(unidade),
                        ''ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç'',
                        ''AAAAAEEEEIIIIOOOOOUUUUCAAAAAEEEEIIIIOOOOOUUUUC'')),
                  ''[^A-Z0-9]'', '''', ''g'') = %L
            AND unidade <> %L',
        t, par[2], par[1], par[2]);
    END LOOP;
  END LOOP;
END $$;
