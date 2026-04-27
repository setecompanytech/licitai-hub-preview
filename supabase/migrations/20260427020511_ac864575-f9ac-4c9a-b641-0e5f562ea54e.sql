
-- ===== Conexões Open Finance (provedor agregador: Pluggy/Belvo/etc) =====
CREATE TABLE IF NOT EXISTS public.financeiro_open_finance_conexoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  conta_id uuid REFERENCES public.financeiro_contas(id) ON DELETE SET NULL,
  provedor text NOT NULL CHECK (provedor IN ('pluggy','belvo','manual')),
  banco_nome text NOT NULL,
  banco_codigo text,
  item_id_externo text, -- id do "item"/conexão no agregador
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','ativa','erro','revogada','expirada')),
  ultima_sincronizacao timestamptz,
  proxima_sincronizacao timestamptz,
  frequencia_horas integer NOT NULL DEFAULT 12,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  erro_mensagem text,
  criado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fof_empresa ON public.financeiro_open_finance_conexoes(empresa_id, status);

ALTER TABLE public.financeiro_open_finance_conexoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fof_sel_member" ON public.financeiro_open_finance_conexoes
  FOR SELECT USING (is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fof_ins_member" ON public.financeiro_open_finance_conexoes
  FOR INSERT WITH CHECK (is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fof_upd_member" ON public.financeiro_open_finance_conexoes
  FOR UPDATE USING (is_empresa_member(auth.uid(), empresa_id))
  WITH CHECK (is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fof_del_admin" ON public.financeiro_open_finance_conexoes
  FOR DELETE USING (is_empresa_admin(auth.uid(), empresa_id));

CREATE TRIGGER trg_fof_updated_at
  BEFORE UPDATE ON public.financeiro_open_finance_conexoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Log de sincronizações Open Finance =====
CREATE TABLE IF NOT EXISTS public.financeiro_open_finance_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conexao_id uuid NOT NULL REFERENCES public.financeiro_open_finance_conexoes(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('iniciado','sucesso','erro')),
  movimentos_novos integer NOT NULL DEFAULT 0,
  saldo_atual numeric(15,2),
  duracao_ms integer,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fof_sync_conexao ON public.financeiro_open_finance_sync_log(conexao_id, created_at DESC);

ALTER TABLE public.financeiro_open_finance_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fof_log_sel_member" ON public.financeiro_open_finance_sync_log
  FOR SELECT USING (is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fof_log_ins_member" ON public.financeiro_open_finance_sync_log
  FOR INSERT WITH CHECK (is_empresa_member(auth.uid(), empresa_id));

-- ===== Demonstrações Contábeis (snapshots gerados) =====
CREATE TABLE IF NOT EXISTS public.financeiro_demonstracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('balanco_patrimonial','dfc_indireta','dmpl','dre_completa')),
  competencia_inicio date NOT NULL,
  competencia_fim date NOT NULL,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb, -- estrutura completa do relatório
  total_ativo numeric(15,2),
  total_passivo numeric(15,2),
  resultado_liquido numeric(15,2),
  observacoes text,
  gerado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fin_demo_empresa ON public.financeiro_demonstracoes(empresa_id, tipo, competencia_fim DESC);

ALTER TABLE public.financeiro_demonstracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_demo_sel_member" ON public.financeiro_demonstracoes
  FOR SELECT USING (is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_demo_ins_member" ON public.financeiro_demonstracoes
  FOR INSERT WITH CHECK (is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_demo_del_admin" ON public.financeiro_demonstracoes
  FOR DELETE USING (is_empresa_admin(auth.uid(), empresa_id));
