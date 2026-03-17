
-- Add parcelamento and juros/multa columns to contas_pagar
ALTER TABLE public.contas_pagar 
  ADD COLUMN IF NOT EXISTS parcela_numero integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parcela_total integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parcela_grupo_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS juros_percentual numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS multa_percentual numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_juros numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_multa numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_desconto numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recorrente boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS conta_bancaria_id uuid REFERENCES public.contas_bancarias(id) ON DELETE SET NULL;

-- Add parcelamento and juros/multa columns to contas_receber
ALTER TABLE public.contas_receber 
  ADD COLUMN IF NOT EXISTS parcela_numero integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parcela_total integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parcela_grupo_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS juros_percentual numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS multa_percentual numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_juros numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_multa numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_desconto numeric DEFAULT 0;

-- Regras de conciliação automática
CREATE TABLE IF NOT EXISTS public.conciliacao_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo_match text NOT NULL DEFAULT 'descricao',
  padrao_texto text NOT NULL,
  categoria_destino text,
  acao text NOT NULL DEFAULT 'categorizar',
  ativo boolean DEFAULT true,
  prioridade integer DEFAULT 0,
  vezes_aplicada integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.conciliacao_regras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own conciliacao_regras" ON public.conciliacao_regras FOR ALL USING (auth.uid() = user_id);

-- DRE categorias contábeis
CREATE TABLE IF NOT EXISTS public.dre_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'receita',
  grupo text NOT NULL DEFAULT 'operacional',
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dre_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own dre_categorias" ON public.dre_categorias FOR ALL USING (auth.uid() = user_id);

-- Boletos
CREATE TABLE IF NOT EXISTS public.boletos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  conta_receber_id uuid REFERENCES public.contas_receber(id) ON DELETE SET NULL,
  conta_bancaria_id uuid REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
  numero_documento text,
  nosso_numero text,
  linha_digitavel text,
  codigo_barras text,
  valor_nominal numeric NOT NULL DEFAULT 0,
  valor_juros numeric DEFAULT 0,
  valor_multa numeric DEFAULT 0,
  valor_desconto numeric DEFAULT 0,
  data_emissao date,
  data_vencimento date NOT NULL,
  data_pagamento date,
  sacado_nome text,
  sacado_cnpj_cpf text,
  sacado_endereco text,
  sacado_cidade text,
  sacado_uf text,
  sacado_cep text,
  status text NOT NULL DEFAULT 'emitido',
  instrucoes text,
  observacoes text,
  api_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.boletos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own boletos" ON public.boletos FOR ALL USING (auth.uid() = user_id);

-- Add categoria column to transacoes_bancarias if not exists
ALTER TABLE public.transacoes_bancarias 
  ADD COLUMN IF NOT EXISTS categoria text DEFAULT NULL;
