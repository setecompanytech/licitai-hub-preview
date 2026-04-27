-- Configuração de NF-e por empresa (multi-provedor)
CREATE TABLE IF NOT EXISTS public.fin_config_nfe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  provedor TEXT NOT NULL DEFAULT 'focusnfe' CHECK (provedor IN ('focusnfe','nfeio','sefaz_direto')),
  ambiente TEXT NOT NULL DEFAULT 'homologacao' CHECK (ambiente IN ('homologacao','producao')),
  api_token TEXT,
  api_token_secundario TEXT,
  certificado_pfx_url TEXT,
  senha_certificado TEXT,
  serie_padrao INT DEFAULT 1,
  proximo_numero INT DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id)
);

ALTER TABLE public.fin_config_nfe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_config_nfe_select_member"
  ON public.fin_config_nfe FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "fin_config_nfe_admin_modify"
  ON public.fin_config_nfe FOR ALL
  USING (public.is_empresa_admin(auth.uid(), empresa_id))
  WITH CHECK (public.is_empresa_admin(auth.uid(), empresa_id));

CREATE TRIGGER trg_fin_config_nfe_updated
  BEFORE UPDATE ON public.fin_config_nfe
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cobranças PIX vinculadas a contas a receber
CREATE TABLE IF NOT EXISTS public.fin_pix_cobrancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  lancamento_id UUID,
  pessoa_id UUID,
  txid TEXT UNIQUE,
  valor NUMERIC(14,2) NOT NULL CHECK (valor > 0),
  descricao TEXT,
  chave_pix TEXT NOT NULL,
  beneficiario_nome TEXT NOT NULL,
  beneficiario_cidade TEXT NOT NULL DEFAULT 'BELEM',
  br_code TEXT NOT NULL,
  qr_code_image TEXT,
  tipo TEXT NOT NULL DEFAULT 'estatico' CHECK (tipo IN ('estatico','dinamico')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','expirado','cancelado')),
  data_expiracao TIMESTAMPTZ,
  data_pagamento TIMESTAMPTZ,
  webhook_payload JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fin_pix_empresa ON public.fin_pix_cobrancas(empresa_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fin_pix_lancamento ON public.fin_pix_cobrancas(lancamento_id);

ALTER TABLE public.fin_pix_cobrancas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_pix_select_member"
  ON public.fin_pix_cobrancas FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "fin_pix_insert_member"
  ON public.fin_pix_cobrancas FOR INSERT
  WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "fin_pix_update_member"
  ON public.fin_pix_cobrancas FOR UPDATE
  USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "fin_pix_delete_admin"
  ON public.fin_pix_cobrancas FOR DELETE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

CREATE TRIGGER trg_fin_pix_updated
  BEFORE UPDATE ON public.fin_pix_cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();