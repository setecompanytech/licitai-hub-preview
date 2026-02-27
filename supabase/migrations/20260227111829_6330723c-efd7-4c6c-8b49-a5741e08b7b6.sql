
-- Table for federal contract/ARP data from contratos.sistema.gov.br
CREATE TABLE public.contratos_gov (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  orgao TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'arp', -- arp, contrato, compra
  descricao TEXT,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  quantidade_itens INTEGER NOT NULL DEFAULT 0,
  vigencia_inicio DATE,
  vigencia_fim DATE,
  modalidade TEXT,
  situacao TEXT DEFAULT 'vigente',
  ano INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contratos_gov ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own contratos_gov data"
  ON public.contratos_gov FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_contratos_gov_updated_at
  BEFORE UPDATE ON public.contratos_gov
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
