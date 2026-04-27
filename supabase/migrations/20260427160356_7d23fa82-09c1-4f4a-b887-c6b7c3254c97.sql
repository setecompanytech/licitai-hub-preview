
-- ============================================================
-- FASE 3: Conciliação reversível com auditoria
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fin_conciliacao_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  movimento_id UUID,
  lancamento_id UUID,
  acao TEXT NOT NULL CHECK (acao IN ('auto_match','manual_match','revert','ai_suggestion')),
  confianca NUMERIC(5,2),
  metodo TEXT NOT NULL CHECK (metodo IN ('deterministico','ia_descritor','manual')),
  detalhes JSONB DEFAULT '{}'::jsonb,
  revertido BOOLEAN DEFAULT false,
  revertido_por UUID,
  revertido_em TIMESTAMPTZ,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fin_conc_log_empresa ON public.fin_conciliacao_log(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fin_conc_log_mov ON public.fin_conciliacao_log(movimento_id);

ALTER TABLE public.fin_conciliacao_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_conc_log_select" ON public.fin_conciliacao_log FOR SELECT TO authenticated
USING (is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "fin_conc_log_insert" ON public.fin_conciliacao_log FOR INSERT TO authenticated
WITH CHECK (is_empresa_member(auth.uid(), empresa_id) AND user_id = auth.uid());

CREATE POLICY "fin_conc_log_update" ON public.fin_conciliacao_log FOR UPDATE TO authenticated
USING (is_empresa_member(auth.uid(), empresa_id));

-- Aprendizado de regras de descritor (cache IA)
CREATE TABLE IF NOT EXISTS public.fin_conciliacao_regras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  padrao_descritor TEXT NOT NULL,
  pessoa_id UUID,
  categoria_id UUID,
  plano_conta_id UUID REFERENCES public.fin_plano_contas(id) ON DELETE SET NULL,
  confianca NUMERIC(5,2) DEFAULT 80,
  vezes_usada INT DEFAULT 0,
  origem TEXT DEFAULT 'ia' CHECK (origem IN ('ia','manual','sistema')),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (empresa_id, padrao_descritor)
);

CREATE INDEX IF NOT EXISTS idx_fin_conc_regras_emp ON public.fin_conciliacao_regras(empresa_id, ativo);

ALTER TABLE public.fin_conciliacao_regras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_conc_regras_all" ON public.fin_conciliacao_regras FOR ALL TO authenticated
USING (is_empresa_member(auth.uid(), empresa_id))
WITH CHECK (is_empresa_member(auth.uid(), empresa_id));

-- ============================================================
-- FASE 4: Plano de contas padrão (one-click setup) + orçamento
-- ============================================================

CREATE OR REPLACE FUNCTION public.fin_seed_plano_contas_padrao(p_empresa_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_root_rec UUID; v_root_des UUID; v_root_cus UUID; v_root_imp UUID; v_root_fin UUID;
BEGIN
  IF NOT is_empresa_member(auth.uid(), p_empresa_id) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501';
  END IF;

  SELECT count(*) INTO v_count FROM public.fin_plano_contas WHERE empresa_id = p_empresa_id;
  IF v_count > 0 THEN
    RETURN jsonb_build_object('status','ja_existe','total', v_count);
  END IF;

  -- Nível 1 — Grupos
  INSERT INTO public.fin_plano_contas(empresa_id, codigo, nome, tipo, natureza, nivel, aceita_lancamentos)
  VALUES (p_empresa_id, '3', 'Receitas',          'receita', 'credito', 1, false) RETURNING id INTO v_root_rec;
  INSERT INTO public.fin_plano_contas(empresa_id, codigo, nome, tipo, natureza, nivel, aceita_lancamentos)
  VALUES (p_empresa_id, '4', 'Custos',            'custo',   'debito',  1, false) RETURNING id INTO v_root_cus;
  INSERT INTO public.fin_plano_contas(empresa_id, codigo, nome, tipo, natureza, nivel, aceita_lancamentos)
  VALUES (p_empresa_id, '5', 'Despesas Operacionais', 'despesa', 'debito', 1, false) RETURNING id INTO v_root_des;
  INSERT INTO public.fin_plano_contas(empresa_id, codigo, nome, tipo, natureza, nivel, aceita_lancamentos)
  VALUES (p_empresa_id, '6', 'Despesas Financeiras', 'despesa', 'debito', 1, false) RETURNING id INTO v_root_fin;
  INSERT INTO public.fin_plano_contas(empresa_id, codigo, nome, tipo, natureza, nivel, aceita_lancamentos)
  VALUES (p_empresa_id, '7', 'Impostos e Tributos', 'imposto', 'debito', 1, false) RETURNING id INTO v_root_imp;

  -- Nível 2 — Subcontas operacionais (folha)
  INSERT INTO public.fin_plano_contas(empresa_id, codigo, nome, tipo, natureza, nivel, pai_id, aceita_lancamentos) VALUES
    (p_empresa_id,'3.1','Receita de Licitações','receita','credito',2,v_root_rec,true),
    (p_empresa_id,'3.2','Receita de Vendas','receita','credito',2,v_root_rec,true),
    (p_empresa_id,'3.3','Receita de Serviços','receita','credito',2,v_root_rec,true),
    (p_empresa_id,'3.9','Outras Receitas','receita','credito',2,v_root_rec,true),
    (p_empresa_id,'4.1','Custo de Mercadorias','custo','debito',2,v_root_cus,true),
    (p_empresa_id,'4.2','Custo de Serviços','custo','debito',2,v_root_cus,true),
    (p_empresa_id,'4.3','Frete e Logística','custo','debito',2,v_root_cus,true),
    (p_empresa_id,'5.1','Folha de Pagamento','despesa','debito',2,v_root_des,true),
    (p_empresa_id,'5.2','Encargos e Benefícios','despesa','debito',2,v_root_des,true),
    (p_empresa_id,'5.3','Aluguel e Condomínio','despesa','debito',2,v_root_des,true),
    (p_empresa_id,'5.4','Utilidades (Água/Luz/Internet)','despesa','debito',2,v_root_des,true),
    (p_empresa_id,'5.5','Material de Escritório','despesa','debito',2,v_root_des,true),
    (p_empresa_id,'5.6','Marketing e Publicidade','despesa','debito',2,v_root_des,true),
    (p_empresa_id,'5.7','Tecnologia e SaaS','despesa','debito',2,v_root_des,true),
    (p_empresa_id,'5.8','Honorários (Contábil/Jurídico)','despesa','debito',2,v_root_des,true),
    (p_empresa_id,'5.9','Despesas Administrativas','despesa','debito',2,v_root_des,true),
    (p_empresa_id,'6.1','Tarifas Bancárias','despesa','debito',2,v_root_fin,true),
    (p_empresa_id,'6.2','Juros e Multas','despesa','debito',2,v_root_fin,true),
    (p_empresa_id,'6.3','IOF e CPMF','despesa','debito',2,v_root_fin,true),
    (p_empresa_id,'7.1','Simples Nacional (DAS)','imposto','debito',2,v_root_imp,true),
    (p_empresa_id,'7.2','ICMS','imposto','debito',2,v_root_imp,true),
    (p_empresa_id,'7.3','ISS','imposto','debito',2,v_root_imp,true),
    (p_empresa_id,'7.4','PIS/COFINS','imposto','debito',2,v_root_imp,true),
    (p_empresa_id,'7.5','IRPJ/CSLL','imposto','debito',2,v_root_imp,true),
    (p_empresa_id,'7.6','INSS Patronal','imposto','debito',2,v_root_imp,true),
    (p_empresa_id,'7.7','FGTS','imposto','debito',2,v_root_imp,true);

  RETURN jsonb_build_object('status','criado','total',31);
END $$;

-- Orçamento mensal por plano de contas
CREATE TABLE IF NOT EXISTS public.fin_orcamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  plano_conta_id UUID NOT NULL REFERENCES public.fin_plano_contas(id) ON DELETE CASCADE,
  centro_custo_id UUID,
  ano SMALLINT NOT NULL,
  mes SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor_orcado NUMERIC(15,2) NOT NULL DEFAULT 0,
  cenario TEXT DEFAULT 'realista' CHECK (cenario IN ('otimista','realista','pessimista')),
  observacoes TEXT,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (empresa_id, plano_conta_id, centro_custo_id, ano, mes, cenario)
);

CREATE INDEX IF NOT EXISTS idx_fin_orc_emp_periodo ON public.fin_orcamento(empresa_id, ano, mes);

ALTER TABLE public.fin_orcamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_orc_all" ON public.fin_orcamento FOR ALL TO authenticated
USING (is_empresa_member(auth.uid(), empresa_id))
WITH CHECK (is_empresa_member(auth.uid(), empresa_id));

-- ============================================================
-- FASE 5: Integrações fiscais (SPED, DCTFWeb, NF-e por CNPJ agendada)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fin_sped_arquivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('sped_fiscal','sped_contribuicoes','sped_contabil','ecf','ecd','dctfweb')),
  competencia DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','validado','transmitido','retificado','cancelado')),
  arquivo_url TEXT,
  hash_sha256 TEXT,
  recibo TEXT,
  total_registros INT,
  validacao JSONB DEFAULT '{}'::jsonb,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fin_sped_emp ON public.fin_sped_arquivos(empresa_id, competencia DESC);

ALTER TABLE public.fin_sped_arquivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_sped_all" ON public.fin_sped_arquivos FOR ALL TO authenticated
USING (is_empresa_member(auth.uid(), empresa_id))
WITH CHECK (is_empresa_member(auth.uid(), empresa_id));

-- Agendamentos de importação NF-e SEFAZ por CNPJ
CREATE TABLE IF NOT EXISTS public.fin_sefaz_agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cnpj TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  frequencia TEXT NOT NULL DEFAULT 'diaria' CHECK (frequencia IN ('horaria','diaria','semanal')),
  ultimo_nsu TEXT,
  ultima_execucao TIMESTAMPTZ,
  proxima_execucao TIMESTAMPTZ,
  total_importadas INT DEFAULT 0,
  ultimo_status TEXT,
  ultimo_erro TEXT,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (empresa_id, cnpj)
);

ALTER TABLE public.fin_sefaz_agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_sefaz_agend_all" ON public.fin_sefaz_agendamentos FOR ALL TO authenticated
USING (is_empresa_member(auth.uid(), empresa_id))
WITH CHECK (is_empresa_member(auth.uid(), empresa_id));

-- Apuração de impostos calculada (cruzamento NF-e x DCTFWeb x SPED)
CREATE TABLE IF NOT EXISTS public.fin_apuracao_impostos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  competencia DATE NOT NULL,
  tributo TEXT NOT NULL CHECK (tributo IN ('icms','iss','pis','cofins','irpj','csll','inss','das','fgts')),
  base_calculo NUMERIC(15,2) DEFAULT 0,
  aliquota NUMERIC(7,4) DEFAULT 0,
  valor_apurado NUMERIC(15,2) DEFAULT 0,
  valor_retido NUMERIC(15,2) DEFAULT 0,
  valor_devido NUMERIC(15,2) DEFAULT 0,
  valor_pago NUMERIC(15,2) DEFAULT 0,
  divergencia NUMERIC(15,2) GENERATED ALWAYS AS (valor_devido - valor_pago) STORED,
  origem JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','conciliado','divergente','pago')),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (empresa_id, competencia, tributo)
);

CREATE INDEX IF NOT EXISTS idx_fin_apur_imp_emp ON public.fin_apuracao_impostos(empresa_id, competencia DESC);

ALTER TABLE public.fin_apuracao_impostos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_apur_imp_all" ON public.fin_apuracao_impostos FOR ALL TO authenticated
USING (is_empresa_member(auth.uid(), empresa_id))
WITH CHECK (is_empresa_member(auth.uid(), empresa_id));

-- Trigger para updated_at em todas as novas tabelas
CREATE TRIGGER trg_upd_fin_conc_regras BEFORE UPDATE ON public.fin_conciliacao_regras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_upd_fin_orc BEFORE UPDATE ON public.fin_orcamento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_upd_fin_sped BEFORE UPDATE ON public.fin_sped_arquivos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_upd_fin_sefaz_agend BEFORE UPDATE ON public.fin_sefaz_agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_upd_fin_apur_imp BEFORE UPDATE ON public.fin_apuracao_impostos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
