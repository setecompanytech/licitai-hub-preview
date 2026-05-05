
ALTER TABLE public.financeiro_contas
  ADD COLUMN IF NOT EXISTS data_saldo_inicial date,
  ADD COLUMN IF NOT EXISTS limite_credito numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conta_vinculada_id uuid REFERENCES public.financeiro_contas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS considerar_resumo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS observacao text,
  ADD COLUMN IF NOT EXISTS gerente_nome text,
  ADD COLUMN IF NOT EXISTS gerente_email text,
  ADD COLUMN IF NOT EXISTS gerente_ddd text,
  ADD COLUMN IF NOT EXISTS gerente_telefone text,
  ADD COLUMN IF NOT EXISTS endereco_logradouro text,
  ADD COLUMN IF NOT EXISTS endereco_numero text,
  ADD COLUMN IF NOT EXISTS endereco_bairro text,
  ADD COLUMN IF NOT EXISTS endereco_complemento text,
  ADD COLUMN IF NOT EXISTS endereco_estado text,
  ADD COLUMN IF NOT EXISTS endereco_cidade text,
  ADD COLUMN IF NOT EXISTS endereco_cep text;
