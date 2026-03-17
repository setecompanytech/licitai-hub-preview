
-- Pré-Notas Fiscais: solicitações do comercial para o financeiro
CREATE TABLE public.pre_notas_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
  
  -- Status do fluxo: rascunho -> pendente -> em_revisao -> aprovada -> rejeitada -> devolvida
  status TEXT NOT NULL DEFAULT 'pendente',
  
  -- Dados da operação (preenchidos pelo comercial)
  natureza_operacao TEXT NOT NULL,
  observacoes TEXT,
  justificativa TEXT,
  
  -- Transporte
  frete_modalidade TEXT DEFAULT '9',
  frete_valor NUMERIC DEFAULT 0,
  transportadora TEXT,
  endereco_entrega TEXT,
  
  -- Totais
  valor_total NUMERIC NOT NULL DEFAULT 0,
  
  -- Revisão pelo financeiro
  revisado_por UUID REFERENCES auth.users(id),
  data_revisao TIMESTAMPTZ,
  motivo_rejeicao TEXT,
  motivo_devolucao TEXT,
  
  -- NF gerada (após aprovação)
  nota_fiscal_id UUID REFERENCES public.notas_fiscais(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Itens da pré-nota (faturamento parcial)
CREATE TABLE public.pre_nota_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pre_nota_id UUID NOT NULL REFERENCES public.pre_notas_fiscais(id) ON DELETE CASCADE,
  contrato_pedido_id UUID REFERENCES public.contrato_pedidos(id) ON DELETE SET NULL,
  contrato_item_id UUID REFERENCES public.contrato_itens(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  unidade TEXT DEFAULT 'UN',
  quantidade NUMERIC NOT NULL DEFAULT 0,
  valor_unitario NUMERIC NOT NULL DEFAULT 0,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.pre_notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pre_nota_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own pre_notas" ON public.pre_notas_fiscais
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_empresa_member(auth.uid(), empresa_id))
  WITH CHECK (user_id = auth.uid() OR public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "Users can manage pre_nota_itens via pre_nota" ON public.pre_nota_itens
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pre_notas_fiscais pn WHERE pn.id = pre_nota_id AND (pn.user_id = auth.uid() OR public.is_empresa_member(auth.uid(), pn.empresa_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pre_notas_fiscais pn WHERE pn.id = pre_nota_id AND (pn.user_id = auth.uid() OR public.is_empresa_member(auth.uid(), pn.empresa_id))));

-- Trigger updated_at
CREATE TRIGGER update_pre_notas_fiscais_updated_at
  BEFORE UPDATE ON public.pre_notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pre_notas_fiscais;
