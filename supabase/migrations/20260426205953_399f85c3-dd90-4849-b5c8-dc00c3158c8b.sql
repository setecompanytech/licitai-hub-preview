ALTER TABLE public.financeiro_pessoas
  ADD COLUMN IF NOT EXISTS ie text,
  ADD COLUMN IF NOT EXISTS im text,
  ADD COLUMN IF NOT EXISTS ind_ie_dest smallint DEFAULT 9,
  ADD COLUMN IF NOT EXISTS cnae_principal text,
  ADD COLUMN IF NOT EXISTS regime_tributario text,
  ADD COLUMN IF NOT EXISTS site text,
  ADD COLUMN IF NOT EXISTS contato_secundario jsonb,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS limite_credito numeric(15,2),
  ADD COLUMN IF NOT EXISTS prazo_padrao_dias integer DEFAULT 30;

COMMENT ON COLUMN public.financeiro_pessoas.ind_ie_dest IS '1=Contribuinte ICMS, 2=Isento, 9=Não contribuinte';
COMMENT ON COLUMN public.financeiro_pessoas.regime_tributario IS 'simples_nacional | lucro_presumido | lucro_real | mei | imune';
COMMENT ON COLUMN public.financeiro_pessoas.contato_secundario IS '{nome, telefone, email, cargo}';
COMMENT ON COLUMN public.financeiro_pessoas.endereco IS '{logradouro, numero, complemento, bairro, cep, municipio, uf, cod_municipio_ibge}';
COMMENT ON COLUMN public.financeiro_pessoas.dados_bancarios IS '{banco, agencia, conta, tipo_conta, pix_chave, pix_tipo, titular}';

CREATE INDEX IF NOT EXISTS idx_fp_tags ON public.financeiro_pessoas USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_fp_regime ON public.financeiro_pessoas(empresa_id, regime_tributario) WHERE ativo = true;