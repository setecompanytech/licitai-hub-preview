-- =============================================================================
-- Bonificação: dois tipos novos de base de cálculo
--
--   percentual_faturamento  — percentual sobre o valor FATURADO (nota emitida)
--   percentual_nf_quitada   — percentual sobre o valor RECEBIDO (nota quitada)
--
-- A distinção importa em pagamento parcial: faturar R$ 100 e receber R$ 60 dá
-- bases diferentes, e quem configura escolhe qual vale.
--
-- A tabela nasceu com um CHECK fechado nos quatro tipos originais, então a
-- interface oferecia os novos e o banco recusava a gravação
-- ("comissoes_config_tipo_comissao_check"). Aqui a lista é ampliada — o CHECK
-- continua fechado de propósito: tipo inválido tem de ser recusado, e a
-- alternativa (coluna livre) transformaria erro de digitação em cálculo errado.
-- =============================================================================

ALTER TABLE public.comissoes_config
  DROP CONSTRAINT IF EXISTS comissoes_config_tipo_comissao_check;

ALTER TABLE public.comissoes_config
  ADD CONSTRAINT comissoes_config_tipo_comissao_check
  CHECK (tipo_comissao IN (
    'percentual_contrato',
    'percentual_lucro',
    'percentual_faturamento',
    'percentual_nf_quitada',
    'valor_fixo',
    'nota_fiscal'
  ));

COMMENT ON COLUMN public.comissoes_config.tipo_comissao IS
  'Base de cálculo da bonificação. Tipos iniciados por "percentual" usam o '
  'campo percentual sobre a base correspondente; os demais usam valor_fixo. '
  'Espelho no front: src/lib/equipe/bonificacao.ts (autoridade única).';
