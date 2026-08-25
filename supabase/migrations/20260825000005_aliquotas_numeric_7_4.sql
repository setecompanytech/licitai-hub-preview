-- ─────────────────────────────────────────────────────────────────────────────
-- financeiro_config_tributaria: as alíquotas não cabiam na própria coluna
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Nove colunas foram criadas como `numeric(5,4)` — precisão 5, escala 4, ou
-- seja, teto de 9,9999. E receberam DEFAULT em ponto percentual: IRPJ 15,
-- adicional 10, ICMS 18. Nenhum desses três cabe.
--
-- O CREATE TABLE passou porque o Postgres não avalia a expressão de DEFAULT na
-- criação. O INSERT é que não passa — e não passa nem quando OMITE as colunas,
-- porque é justamente aí que o default é avaliado. Resultado: a tabela nasceu
-- em abril e nunca recebeu uma linha. Zero, em todas as empresas.
--
-- A consequência não era uma tela de erro; era pior. Sem linha, o hook caía no
-- DEFAULT_CONFIG do código, cujo `regime` é 'simples' — e foi esse padrão de
-- código, e não uma escolha de ninguém, que apurou uma empresa de Lucro
-- Presumido pela tabela do Simples Nacional. Salvar a configuração certa era
-- impossível: o upsert estourava em silêncio no toast e a tela seguia
-- mostrando os mesmos padrões.
--
-- Aqui as nove viram `numeric(7,4)`: até 999,9999, com as quatro casas que a
-- alíquota efetiva exige. E ganham CHECK 0..100, porque alíquota tributária é
-- percentual transcrito de texto legal e essa faixa é real (ver CLAUDE.md — o
-- CHECK vale para estas, não por varredura de nome: `aliquota_st_mva` passa de
-- 100 legitimamente e não está aqui).
--
-- A sequência é DROP DEFAULT → ALTER TYPE → SET DEFAULT de propósito: mudar o
-- tipo com o default pendurado faz o Postgres tentar converter a expressão, e
-- é exatamente a conversão que estoura.

DO $$
DECLARE
  col text;
  padrao text;
  colunas constant text[][] := ARRAY[
    ['aliquota_pis',        '0.65'],
    ['aliquota_cofins',     '3.00'],
    ['aliquota_pis_nc',     '1.65'],
    ['aliquota_cofins_nc',  '7.60'],
    ['aliquota_irpj',      '15.00'],
    ['adicional_irpj',     '10.00'],
    ['aliquota_csll',       '9.00'],
    ['aliquota_iss',        '5.00'],
    ['aliquota_icms',      '18.00']
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(colunas, 1) LOOP
    col    := colunas[i][1];
    padrao := colunas[i][2];

    EXECUTE format('ALTER TABLE public.financeiro_config_tributaria ALTER COLUMN %I DROP DEFAULT', col);
    EXECUTE format('ALTER TABLE public.financeiro_config_tributaria ALTER COLUMN %I TYPE numeric(7,4)', col);
    EXECUTE format('ALTER TABLE public.financeiro_config_tributaria ALTER COLUMN %I SET DEFAULT %s', col, padrao);

    EXECUTE format('ALTER TABLE public.financeiro_config_tributaria DROP CONSTRAINT IF EXISTS %I', 'chk_' || col || '_faixa');
    EXECUTE format(
      'ALTER TABLE public.financeiro_config_tributaria ADD CONSTRAINT %I CHECK (%I IS NULL OR (%I >= 0 AND %I <= 100))',
      'chk_' || col || '_faixa', col, col, col);
  END LOOP;
END $$;

COMMENT ON TABLE public.financeiro_config_tributaria IS
  'Alíquotas e presunções da empresa, em ponto percentual (0–100). A coluna '
  '`regime` é ESPELHO de empresas.regime_tributario — quem decide o regime é o '
  'cadastro. Nasceu em 2026-04 com nove colunas numeric(5,4) que não comportavam '
  'os próprios defaults, e por isso ficou vazia até 2026-08.';

-- ── Conferência ──────────────────────────────────────────────────────────────
--   SELECT column_name, numeric_precision, numeric_scale, column_default
--     FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'financeiro_config_tributaria'
--      AND (column_name LIKE 'aliquota%' OR column_name = 'adicional_irpj')
--    ORDER BY column_name;
--
-- Depois disto, salvar a configuração tributária pela tela passa a funcionar —
-- e é o que cria a primeira linha da tabela.
