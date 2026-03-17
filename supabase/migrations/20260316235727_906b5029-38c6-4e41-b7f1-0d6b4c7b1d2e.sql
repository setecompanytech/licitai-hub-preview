
-- Tabela principal de notas fiscais (NF-e e NFS-e)
CREATE TABLE public.notas_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  contrato_pedido_id uuid REFERENCES public.contrato_pedidos(id) ON DELETE SET NULL,
  
  -- Tipo e modelo
  tipo text NOT NULL DEFAULT 'nfe', -- nfe, nfse
  modelo text DEFAULT '55', -- 55=NF-e, 65=NFC-e
  
  -- Dados da NF
  numero_nf text,
  serie text DEFAULT '1',
  chave_acesso text, -- 44 dígitos
  protocolo_autorizacao text,
  data_emissao timestamptz DEFAULT now(),
  
  -- Valores
  valor_total numeric DEFAULT 0,
  valor_produtos numeric DEFAULT 0,
  valor_servicos numeric DEFAULT 0,
  valor_icms numeric DEFAULT 0,
  valor_iss numeric DEFAULT 0,
  valor_pis numeric DEFAULT 0,
  valor_cofins numeric DEFAULT 0,
  valor_frete numeric DEFAULT 0,
  valor_desconto numeric DEFAULT 0,
  base_calculo_icms numeric DEFAULT 0,
  
  -- Destinatário
  destinatario_cnpj text,
  destinatario_razao_social text,
  destinatario_nome_fantasia text,
  destinatario_endereco text,
  destinatario_uf text,
  destinatario_municipio text,
  destinatario_ie text,
  
  -- Natureza da operação
  natureza_operacao text DEFAULT 'Venda de mercadoria',
  cfop text,
  
  -- Status e controle
  status text DEFAULT 'rascunho', -- rascunho, enviada, autorizada, rejeitada, cancelada, inutilizada
  motivo_rejeicao text,
  xml_envio text,
  xml_retorno text,
  pdf_danfe_path text,
  
  -- Integração Nuvem Fiscal
  nuvem_fiscal_id text,
  nuvem_fiscal_status text,
  
  -- Metadados
  observacoes text,
  informacoes_complementares text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notas_fiscais"
  ON public.notas_fiscais FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Itens da nota fiscal
CREATE TABLE public.nota_fiscal_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_fiscal_id uuid REFERENCES public.notas_fiscais(id) ON DELETE CASCADE NOT NULL,
  numero_item integer DEFAULT 1,
  codigo_produto text,
  descricao text NOT NULL,
  ncm text,
  cfop text,
  unidade text DEFAULT 'UN',
  quantidade numeric DEFAULT 1,
  valor_unitario numeric DEFAULT 0,
  valor_total numeric DEFAULT 0,
  
  -- Impostos por item
  icms_aliquota numeric DEFAULT 0,
  icms_valor numeric DEFAULT 0,
  ipi_aliquota numeric DEFAULT 0,
  ipi_valor numeric DEFAULT 0,
  pis_aliquota numeric DEFAULT 0,
  pis_valor numeric DEFAULT 0,
  cofins_aliquota numeric DEFAULT 0,
  cofins_valor numeric DEFAULT 0,
  iss_aliquota numeric DEFAULT 0,
  iss_valor numeric DEFAULT 0,
  
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.nota_fiscal_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage nota_fiscal_itens via parent"
  ON public.nota_fiscal_itens FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.notas_fiscais nf WHERE nf.id = nota_fiscal_itens.nota_fiscal_id AND (nf.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.notas_fiscais nf WHERE nf.id = nota_fiscal_itens.nota_fiscal_id AND (nf.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );

-- Configuração da API Nuvem Fiscal por empresa
CREATE TABLE public.nuvem_fiscal_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  api_key_encrypted text, -- chave da API
  ambiente text DEFAULT 'homologacao', -- homologacao, producao
  certificado_path text,
  certificado_validade date,
  ativo boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, empresa_id)
);

ALTER TABLE public.nuvem_fiscal_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own nuvem_fiscal_config"
  ON public.nuvem_fiscal_config FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Realtime para notas_fiscais
ALTER PUBLICATION supabase_realtime ADD TABLE public.notas_fiscais;
