-- ═══════════════════════════════════════════════════════════════════════════
-- Prazo de pagamento — a última ponta, e a que fecha o ciclo do fornecedor
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A 20260829000004 trouxe três prazos: entregar, onde entregar, e em quanto
-- tempo o órgão recebe e atesta. Faltava o quarto, que é o único que interessa
-- ao caixa: **em quanto tempo a Administração paga.**
--
-- É cláusula obrigatória. Lei 14.133/2021, art. 92, V: o contrato deve conter
-- "o preço e as condições de pagamento, os critérios, a data-base e a
-- periodicidade do reajustamento de preços". Não é praxe nem costume — está
-- escrito no instrumento, como os outros três.
--
-- ── Por que faz diferença aqui ──────────────────────────────────────────────
--
-- 1. O Contas a Receber projeta entrada de dinheiro. Sem o prazo do contrato,
--    a data dessa projeção é chute — e um fluxo de caixa montado sobre chute
--    parece planejamento e não é.
--
-- 2. O atraso tem consequência que a lei nomeia. Art. 137, §2º, IV: a
--    contratada pode pedir a extinção do contrato quando houver "atraso
--    superior a 2 (dois) meses, contado da emissão da nota fiscal, dos
--    pagamentos ou de parcelas de pagamentos devidos pela Administração".
--    Quem não acompanha o prazo não sabe que o direito nasceu.
--
-- ── Mesma modelagem dos outros prazos ───────────────────────────────────────
-- Dias, unidade e a cláusula literal. "30 dias úteis" e "30 dias corridos" são
-- coisas diferentes, e a frase de origem é o que permite conferir o número sem
-- reabrir o PDF.
--
-- E o marco também é dado: pagamento contado do quê? Do ateste, da emissão da
-- nota, ou do protocolo? Contratos usam os três, e supor um deles desloca a
-- previsão em semanas.

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS prazo_pagamento_dias     integer,
  ADD COLUMN IF NOT EXISTS prazo_pagamento_unidade  text,
  ADD COLUMN IF NOT EXISTS prazo_pagamento_marco    text,
  ADD COLUMN IF NOT EXISTS prazo_pagamento_clausula text;

COMMENT ON COLUMN public.contratos.prazo_pagamento_dias IS
  'Prazo da Administração para pagar, em dias, contado do marco da cláusula. '
  'Cláusula obrigatória (Lei 14.133/2021, art. 92, V). Nulo significa que '
  'ninguém registrou — a projeção do Contas a Receber fica sem base.';

COMMENT ON COLUMN public.contratos.prazo_pagamento_unidade IS
  'uteis | corridos. Pela mesma razão dos demais prazos: em dezembro a '
  'diferença entre as duas leituras passa de uma semana.';

COMMENT ON COLUMN public.contratos.prazo_pagamento_marco IS
  'De onde o prazo é contado: ateste | nota_fiscal | protocolo | entrega. '
  'Contratos usam os quatro, e supor um deles desloca a previsão de entrada em '
  'semanas. Nulo quando a cláusula não diz.';

COMMENT ON COLUMN public.contratos.prazo_pagamento_clausula IS
  'A frase literal de onde o prazo saiu — o que permite conferir o número sem '
  'reabrir o PDF.';

ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS chk_prazo_pagamento_unidade;
ALTER TABLE public.contratos
  ADD CONSTRAINT chk_prazo_pagamento_unidade
  CHECK (
    prazo_pagamento_unidade IS NULL
    OR (prazo_pagamento_unidade IN ('uteis','corridos') AND prazo_pagamento_dias IS NOT NULL)
  ) NOT VALID;

ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS chk_prazo_pagamento_marco;
ALTER TABLE public.contratos
  ADD CONSTRAINT chk_prazo_pagamento_marco
  CHECK (
    prazo_pagamento_marco IS NULL
    OR prazo_pagamento_marco IN ('ateste','nota_fiscal','protocolo','entrega')
  ) NOT VALID;

ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS chk_prazo_pagamento_plausivel;
ALTER TABLE public.contratos
  ADD CONSTRAINT chk_prazo_pagamento_plausivel
  CHECK (prazo_pagamento_dias IS NULL OR prazo_pagamento_dias BETWEEN 1 AND 365)
  NOT VALID;

-- ── Conferência ─────────────────────────────────────────────────────────────
--
--   SELECT numero_contrato,
--          prazo_entrega_dias, prazo_entrega_unidade,
--          prazo_recebimento_dias,
--          prazo_pagamento_dias, prazo_pagamento_unidade, prazo_pagamento_marco
--     FROM public.contratos
--    ORDER BY prazo_pagamento_dias NULLS FIRST;
--
-- Vem tudo nulo até o próximo reprocessamento do PDF ou preenchimento manual.
