-- =============================================================================
-- Normaliza as unidades já gravadas
--
-- O levantamento mostrou o mesmo conceito escrito de três formas:
--   UNIDADE (23) · UND (15) · Unidade (15)  →  53 registros, contados como três
--   caixa (9) · CAIXA (3)                   →  12 registros, contados como dois
--
-- Não vieram do cadastro de produto: vieram da extração de editais e contratos,
-- que grava o que o órgão escreveu. A normalização na entrada foi para o código
-- no mesmo commit; isto resolve o que já está no banco, para relatório parar de
-- contar o mesmo item duas vezes.
--
-- O que NÃO é tocado, de propósito:
--   • 'Embalagem 2 L' e similares — é descrição de embalagem no campo errado.
--     Converter exigiria adivinhar (embalagem? litro? 2 litros?), e adivinhar
--     aqui apaga a informação que o edital trouxe. Fica para revisão humana.
--   • qualquer código que já esteja canônico.
--
-- Só as equivalências que são inequívocas. Na dúvida, não mexer: unidade errada
-- em item de contrato vira quantidade errada na entrega.
-- =============================================================================

DO $$
DECLARE
  t text;
  -- (grafia gravada, código canônico) — espelho de src/lib/unidades.ts
  mapa text[][] := ARRAY[
    ['UNIDADE', 'UN'], ['UND', 'UN'], ['UNID', 'UN'], ['UNID.', 'UN'], ['U', 'UN'],
    ['CAIXA', 'CX'], ['CX.', 'CX'],
    ['QUILO', 'KG'], ['QUILOS', 'KG'], ['KG.', 'KG'],
    ['LITRO', 'L'], ['LITROS', 'L'],
    ['PACOTE', 'PCT'], ['PACOTES', 'PCT'],
    ['METRO', 'M'], ['METROS', 'M'],
    ['PECA', 'PC'], ['PEÇA', 'PC'],
    ['SACO', 'SC'], ['SACOS', 'SC'],
    ['FRASCO', 'FR'], ['FRC', 'FR'],
    ['LATA', 'LT'],
    ['DUZIA', 'DZ'], ['DÚZIA', 'DZ'],
    ['SERVICO', 'SERV'], ['SERVIÇO', 'SERV'], ['SV', 'SERV'],
    ['HORA', 'HR'], ['HORAS', 'HR']
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
    -- Tabela que não existir neste ambiente é ignorada, não derruba a migration.
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;

    FOREACH par SLICE 1 IN ARRAY mapa LOOP
      EXECUTE format(
        'UPDATE public.%I SET unidade = %L
          WHERE upper(btrim(unidade)) = upper(%L) AND unidade <> %L',
        t, par[2], par[1], par[2]);
    END LOOP;
  END LOOP;
END $$;

-- Conferência (rode depois; o esperado é uma linha por código canônico):
--   SELECT unidade, count(*) FROM public.contrato_itens
--    WHERE unidade IS NOT NULL GROUP BY 1 ORDER BY 2 DESC;
