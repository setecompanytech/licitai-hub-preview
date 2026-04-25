CREATE TABLE IF NOT EXISTS public.fin_centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_fin_cc_empresa ON public.fin_centros_custo(empresa_id);
ALTER TABLE public.fin_centros_custo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fin_cc_select" ON public.fin_centros_custo;
DROP POLICY IF EXISTS "fin_cc_insert" ON public.fin_centros_custo;
DROP POLICY IF EXISTS "fin_cc_update" ON public.fin_centros_custo;
DROP POLICY IF EXISTS "fin_cc_delete" ON public.fin_centros_custo;

CREATE POLICY "fin_cc_select" ON public.fin_centros_custo FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_cc_insert" ON public.fin_centros_custo FOR INSERT WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_cc_update" ON public.fin_centros_custo FOR UPDATE USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_cc_delete" ON public.fin_centros_custo FOR DELETE USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP TRIGGER IF EXISTS trg_fin_cc_updated ON public.fin_centros_custo;
CREATE TRIGGER trg_fin_cc_updated BEFORE UPDATE ON public.fin_centros_custo FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.fin_projetos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nome text NOT NULL,
  descricao text,
  licitacao_id uuid,
  data_inicio date,
  data_fim date,
  valor_orcado numeric(15,2),
  status text NOT NULL DEFAULT 'ativo',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_fin_proj_empresa ON public.fin_projetos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_fin_proj_licitacao ON public.fin_projetos(licitacao_id);
ALTER TABLE public.fin_projetos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fin_proj_select" ON public.fin_projetos;
DROP POLICY IF EXISTS "fin_proj_insert" ON public.fin_projetos;
DROP POLICY IF EXISTS "fin_proj_update" ON public.fin_projetos;
DROP POLICY IF EXISTS "fin_proj_delete" ON public.fin_projetos;

CREATE POLICY "fin_proj_select" ON public.fin_projetos FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_proj_insert" ON public.fin_projetos FOR INSERT WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_proj_update" ON public.fin_projetos FOR UPDATE USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_proj_delete" ON public.fin_projetos FOR DELETE USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP TRIGGER IF EXISTS trg_fin_proj_updated ON public.fin_projetos;
CREATE TRIGGER trg_fin_proj_updated BEFORE UPDATE ON public.fin_projetos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.fin_lancamentos ADD COLUMN IF NOT EXISTS projeto_id uuid REFERENCES public.fin_projetos(id) ON DELETE SET NULL;
ALTER TABLE public.fin_lancamentos DROP CONSTRAINT IF EXISTS fk_fin_lanc_cc;
ALTER TABLE public.fin_lancamentos ADD CONSTRAINT fk_fin_lanc_cc FOREIGN KEY (centro_custo_id) REFERENCES public.fin_centros_custo(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fin_lanc_projeto ON public.fin_lancamentos(projeto_id);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_cc ON public.fin_lancamentos(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_status_venc ON public.fin_lancamentos(empresa_id, tipo, status, data_competencia);