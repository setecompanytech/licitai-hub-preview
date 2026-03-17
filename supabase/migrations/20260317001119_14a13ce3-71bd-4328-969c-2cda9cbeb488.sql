
-- Contas bancárias da empresa
CREATE TABLE public.contas_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  banco_codigo text,
  banco_nome text NOT NULL,
  agencia text,
  conta text,
  tipo text DEFAULT 'corrente', -- corrente, poupanca, pagamento
  descricao text,
  saldo_inicial numeric DEFAULT 0,
  saldo_atual numeric DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.contas_bancarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own contas_bancarias"
  ON public.contas_bancarias FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Transações bancárias (importadas ou manuais)
CREATE TABLE public.transacoes_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conta_bancaria_id uuid REFERENCES public.contas_bancarias(id) ON DELETE CASCADE NOT NULL,
  data_transacao date NOT NULL,
  descricao text NOT NULL,
  valor numeric NOT NULL, -- positivo=crédito, negativo=débito
  tipo text DEFAULT 'debito', -- credito, debito
  categoria text,
  documento text, -- número do doc/cheque
  historico text, -- histórico bancário original
  
  -- Conciliação
  conciliado boolean DEFAULT false,
  conciliado_em timestamptz,
  conciliado_com_tipo text, -- nota_fiscal, pedido, custo, manual
  conciliado_com_id uuid,
  conciliado_por uuid,
  
  -- Importação
  origem text DEFAULT 'manual', -- manual, ofx, csv
  hash_transacao text, -- para evitar duplicatas na importação
  
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.transacoes_bancarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own transacoes_bancarias"
  ON public.transacoes_bancarias FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Contas a pagar
CREATE TABLE public.contas_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  fornecedor text,
  valor numeric NOT NULL DEFAULT 0,
  valor_pago numeric DEFAULT 0,
  data_vencimento date NOT NULL,
  data_pagamento date,
  status text DEFAULT 'pendente', -- pendente, pago, atrasado, cancelado
  categoria text, -- tributo, fornecedor, folha, aluguel, outros
  nota_fiscal text,
  conta_bancaria_id uuid REFERENCES public.contas_bancarias(id),
  recorrente boolean DEFAULT false,
  observacoes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own contas_pagar"
  ON public.contas_pagar FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Contas a receber
CREATE TABLE public.contas_receber (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  contrato_pedido_id uuid REFERENCES public.contrato_pedidos(id) ON DELETE SET NULL,
  nota_fiscal_id uuid REFERENCES public.notas_fiscais(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  cliente text,
  valor numeric NOT NULL DEFAULT 0,
  valor_recebido numeric DEFAULT 0,
  data_vencimento date NOT NULL,
  data_recebimento date,
  status text DEFAULT 'pendente', -- pendente, recebido, atrasado, cancelado
  categoria text, -- contrato, servico, outros
  numero_nf text,
  conta_bancaria_id uuid REFERENCES public.contas_bancarias(id),
  observacoes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.contas_receber ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own contas_receber"
  ON public.contas_receber FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Categorias financeiras customizáveis
CREATE TABLE public.categorias_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL, -- receita, despesa
  cor text DEFAULT '#6b7280',
  icone text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own categorias_financeiras"
  ON public.categorias_financeiras FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.transacoes_bancarias;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contas_pagar;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contas_receber;
