
ALTER TABLE public.financeiro_lancamentos ALTER COLUMN origem_tipo SET DEFAULT 'manual';
ALTER TABLE public.financeiro_pessoas ALTER COLUMN origem_tipo SET DEFAULT 'manual';
ALTER TABLE public.financeiro_documentos_fiscais ALTER COLUMN origem_tipo SET DEFAULT 'manual';
ALTER TABLE public.financeiro_contas ALTER COLUMN origem_tipo SET DEFAULT 'manual';
ALTER TABLE public.financeiro_categorias ALTER COLUMN origem_tipo SET DEFAULT 'manual';
ALTER TABLE public.financeiro_centros_custo ALTER COLUMN origem_tipo SET DEFAULT 'manual';
ALTER TABLE public.financeiro_extratos_importados ALTER COLUMN origem_tipo SET DEFAULT 'importacao_ofx';
ALTER TABLE public.financeiro_extrato_movimentos ALTER COLUMN origem_tipo SET DEFAULT 'importacao_ofx';
ALTER TABLE public.financeiro_notas_importadas ALTER COLUMN origem_tipo SET DEFAULT 'importacao_xml';
ALTER TABLE public.financeiro_nfes_emitidas ALTER COLUMN origem_tipo SET DEFAULT 'manual';
ALTER TABLE public.financeiro_folha_pagamento ALTER COLUMN origem_tipo SET DEFAULT 'folha_pagamento';
ALTER TABLE public.financeiro_folha_itens ALTER COLUMN origem_tipo SET DEFAULT 'folha_pagamento';
