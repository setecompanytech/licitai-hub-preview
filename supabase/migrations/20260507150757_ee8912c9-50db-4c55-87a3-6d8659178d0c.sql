
DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY[
    'financeiro_contas',
    'financeiro_categorias',
    'financeiro_centros_custo',
    'financeiro_extratos_importados',
    'financeiro_extrato_movimentos',
    'financeiro_notas_importadas',
    'financeiro_nfes_emitidas',
    'financeiro_folha_pagamento',
    'financeiro_folha_itens'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format('ALTER TABLE public.%I
      ADD COLUMN IF NOT EXISTS origem_tipo public.financeiro_origem_tipo,
      ADD COLUMN IF NOT EXISTS origem_lote_id uuid REFERENCES public.financeiro_origem_lotes(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS origem_job text,
      ADD COLUMN IF NOT EXISTS origem_usuario_id uuid,
      ADD COLUMN IF NOT EXISTS origem_timestamp timestamptz DEFAULT now(),
      ADD COLUMN IF NOT EXISTS origem_metadata jsonb DEFAULT ''{}''::jsonb', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_origem_tipo ON public.%I (origem_tipo)', t, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_origem_lote ON public.%I (origem_lote_id)', t, t);
  END LOOP;
END $$;
