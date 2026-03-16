
-- Tabela de tarefas para colaboradores
CREATE TABLE public.tarefas_colaborador (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  atribuido_a UUID NOT NULL,
  criado_por UUID NOT NULL,
  licitacao_id UUID REFERENCES public.licitacoes(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta', 'urgente')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  prazo DATE,
  concluida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de configuração de comissão por colaborador
CREATE TABLE public.comissoes_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  tipo_comissao TEXT NOT NULL DEFAULT 'percentual_contrato' CHECK (tipo_comissao IN ('percentual_contrato', 'percentual_lucro', 'valor_fixo', 'nota_fiscal')),
  percentual NUMERIC DEFAULT 0,
  valor_fixo NUMERIC DEFAULT 0,
  regra_desconto JSONB DEFAULT '{}',
  visibilidade_publica BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, user_id)
);

-- Tabela de registros de comissão (lançamentos)
CREATE TABLE public.comissoes_lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  licitacao_id UUID REFERENCES public.licitacoes(id) ON DELETE SET NULL,
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  valor_base NUMERIC NOT NULL DEFAULT 0,
  desconto_percentual NUMERIC DEFAULT 0,
  percentual_comissao NUMERIC DEFAULT 0,
  valor_comissao NUMERIC NOT NULL DEFAULT 0,
  nota_fiscal TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'pago', 'cancelado')),
  observacoes TEXT,
  pago_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Adicionar operador_id na tabela licitacoes para rastrear quem opera
ALTER TABLE public.licitacoes ADD COLUMN IF NOT EXISTS operador_id UUID;

-- RLS
ALTER TABLE public.tarefas_colaborador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comissoes_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comissoes_lancamentos ENABLE ROW LEVEL SECURITY;

-- Tarefas: membros da empresa podem ver
CREATE POLICY "Membros podem ver tarefas da empresa"
  ON public.tarefas_colaborador FOR SELECT TO authenticated
  USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "Admin pode gerenciar tarefas"
  ON public.tarefas_colaborador FOR ALL TO authenticated
  USING (public.is_empresa_admin(auth.uid(), empresa_id))
  WITH CHECK (public.is_empresa_admin(auth.uid(), empresa_id));

CREATE POLICY "Colaborador pode atualizar suas tarefas"
  ON public.tarefas_colaborador FOR UPDATE TO authenticated
  USING (atribuido_a = auth.uid())
  WITH CHECK (atribuido_a = auth.uid());

-- Comissões config: admin gerencia, colaborador vê a sua (ou todas se visibilidade_publica)
CREATE POLICY "Admin gerencia comissoes config"
  ON public.comissoes_config FOR ALL TO authenticated
  USING (public.is_empresa_admin(auth.uid(), empresa_id))
  WITH CHECK (public.is_empresa_admin(auth.uid(), empresa_id));

CREATE POLICY "Colaborador ve sua config"
  ON public.comissoes_config FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Comissões lançamentos
CREATE POLICY "Admin gerencia lancamentos"
  ON public.comissoes_lancamentos FOR ALL TO authenticated
  USING (public.is_empresa_admin(auth.uid(), empresa_id))
  WITH CHECK (public.is_empresa_admin(auth.uid(), empresa_id));

CREATE POLICY "Colaborador ve seus lancamentos"
  ON public.comissoes_lancamentos FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Colaborador ve lancamentos publicos"
  ON public.comissoes_lancamentos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.comissoes_config cc
      WHERE cc.empresa_id = comissoes_lancamentos.empresa_id
      AND cc.user_id = comissoes_lancamentos.user_id
      AND cc.visibilidade_publica = true
    )
    AND public.is_empresa_member(auth.uid(), empresa_id)
  );

-- Triggers de updated_at
CREATE TRIGGER tarefas_colaborador_updated_at BEFORE UPDATE ON public.tarefas_colaborador
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER comissoes_config_updated_at BEFORE UPDATE ON public.comissoes_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER comissoes_lancamentos_updated_at BEFORE UPDATE ON public.comissoes_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
