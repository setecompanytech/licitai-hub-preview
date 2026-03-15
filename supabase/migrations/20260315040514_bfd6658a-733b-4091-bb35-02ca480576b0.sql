
-- Itens do contrato (quantidade, unidade, valores, saldos)
CREATE TABLE public.contrato_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  descricao TEXT NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'UN',
  quantidade_contratada NUMERIC NOT NULL DEFAULT 0,
  valor_unitario NUMERIC NOT NULL DEFAULT 0,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  quantidade_consumida NUMERIC NOT NULL DEFAULT 0,
  saldo_quantitativo NUMERIC NOT NULL DEFAULT 0,
  saldo_financeiro NUMERIC NOT NULL DEFAULT 0,
  codigo_item TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contrato_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own contrato_itens"
  ON public.contrato_itens FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Pedidos / Ordens de fornecimento
CREATE TABLE public.contrato_pedidos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  contrato_item_id UUID REFERENCES public.contrato_itens(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  numero_pedido TEXT NOT NULL,
  descricao TEXT,
  quantidade NUMERIC NOT NULL DEFAULT 0,
  valor_unitario NUMERIC NOT NULL DEFAULT 0,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  data_pedido DATE DEFAULT CURRENT_DATE,
  data_entrega DATE,
  status TEXT NOT NULL DEFAULT 'pendente',
  nota_fiscal TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contrato_pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own contrato_pedidos"
  ON public.contrato_pedidos FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Custos e despesas do contrato
CREATE TABLE public.contrato_custos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  contrato_pedido_id UUID REFERENCES public.contrato_pedidos(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'custo_direto',
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  data_lancamento DATE DEFAULT CURRENT_DATE,
  categoria TEXT,
  nota_fiscal TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contrato_custos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own contrato_custos"
  ON public.contrato_custos FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger to auto-update saldos on item when pedido is inserted/updated/deleted
CREATE OR REPLACE FUNCTION public.atualizar_saldo_item_contrato()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_item_id UUID;
  v_contrato_id UUID;
  v_total_qty NUMERIC;
  v_total_val NUMERIC;
BEGIN
  -- Determine which item_id and contrato_id to update
  IF TG_OP = 'DELETE' THEN
    v_item_id := OLD.contrato_item_id;
    v_contrato_id := OLD.contrato_id;
  ELSE
    v_item_id := NEW.contrato_item_id;
    v_contrato_id := NEW.contrato_id;
  END IF;

  -- Update item saldos if linked to an item
  IF v_item_id IS NOT NULL THEN
    SELECT COALESCE(SUM(quantidade), 0), COALESCE(SUM(valor_total), 0)
    INTO v_total_qty, v_total_val
    FROM public.contrato_pedidos
    WHERE contrato_item_id = v_item_id AND status != 'cancelado';

    UPDATE public.contrato_itens
    SET quantidade_consumida = v_total_qty,
        saldo_quantitativo = quantidade_contratada - v_total_qty,
        saldo_financeiro = valor_total - v_total_val,
        updated_at = now()
    WHERE id = v_item_id;
  END IF;

  -- Update contrato valor_consumido and saldo
  SELECT COALESCE(SUM(valor_total), 0) INTO v_total_val
  FROM public.contrato_pedidos
  WHERE contrato_id = v_contrato_id AND status != 'cancelado';

  UPDATE public.contratos
  SET valor_consumido = v_total_val,
      saldo_remanescente = valor_global - v_total_val,
      updated_at = now()
  WHERE id = v_contrato_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_atualizar_saldo_pedido
AFTER INSERT OR UPDATE OR DELETE ON public.contrato_pedidos
FOR EACH ROW EXECUTE FUNCTION public.atualizar_saldo_item_contrato();
