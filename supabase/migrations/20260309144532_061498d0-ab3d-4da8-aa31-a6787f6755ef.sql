
-- Tabela de Gestão de Contratos (pós-venda)
CREATE TABLE public.contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  licitacao_id uuid REFERENCES public.licitacoes(id) ON DELETE SET NULL,
  numero_contrato text NOT NULL,
  objeto text NOT NULL,
  orgao_contratante text NOT NULL,
  valor_global numeric NOT NULL DEFAULT 0,
  valor_consumido numeric NOT NULL DEFAULT 0,
  saldo_remanescente numeric GENERATED ALWAYS AS (valor_global - valor_consumido) STORED,
  data_assinatura date,
  data_inicio date,
  data_fim date,
  vigencia_meses integer,
  status text NOT NULL DEFAULT 'vigente',
  modalidade text,
  uf text,
  municipio text,
  fiscal_nome text,
  fiscal_email text,
  fiscal_telefone text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own contratos" ON public.contratos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tabela de aditivos contratuais
CREATE TABLE public.contrato_aditivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  numero_aditivo text NOT NULL,
  tipo text NOT NULL DEFAULT 'valor',
  valor_aditivo numeric DEFAULT 0,
  prazo_adicional_dias integer DEFAULT 0,
  justificativa text,
  data_aditivo date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contrato_aditivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own aditivos" ON public.contrato_aditivos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime for notificacoes
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
