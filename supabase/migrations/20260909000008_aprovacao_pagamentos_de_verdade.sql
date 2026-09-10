-- ============================================================================
-- Aprovação de Pagamentos DE VERDADE (reconstrução, 09/09)
-- ============================================================================
--
-- A tela anterior era fachada: "aprovar" escrevia na observação (apagando o
-- que existia) e não tirava da fila; "rejeitar" CANCELAVA um título legítimo;
-- e a baixa nunca consultou nada — pagava-se sem aprovação. Alçadas cravadas
-- no código (princípio 7 violado).
--
-- O desenho novo:
-- 1) Estado próprio no lançamento (aprovacao_status/por/em/valor congelado);
-- 2) ENFORCEMENT por trigger: com o workflow ativo, marcar a_pagar como
--    'realizado' sem aprovação falha — em qualquer tela. 'conciliado' passa:
--    extrato bancário é fato consumado, barrar seria ficção (a trilha mostra
--    que passou pelo banco). INSERT direto como realizado (importação de
--    histórico/OFX) também passa: importar passado não é autorizar pagamento;
-- 3) Valor é congelado na aprovação: mudou o valor, cai para reaprovação;
-- 4) Opt-in POR EMPRESA (desligado por padrão) com alçada configurável:
--    até limite_admin a equipe do Financeiro aprova; acima, só admin;
-- 5) Rejeitar devolve para revisão com motivo — não cancela o título;
-- 6) Alçada verificada NO SERVIDOR (RPC), não por badge de tela;
-- 7) Trilha própria em financeiro_aprovacoes_log.

-- 1) Estado no lançamento -----------------------------------------------------
ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS aprovacao_status text
    CHECK (aprovacao_status IN ('pendente','aprovado','rejeitado'));
ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS aprovado_por uuid;
ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz;
ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS aprovacao_valor numeric;
ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS aprovacao_motivo text;

-- 2) Configuração por empresa -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.financeiro_config_aprovacao (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT false,
  limite_admin numeric NOT NULL DEFAULT 10000 CHECK (limite_admin >= 0),
  janela_dias integer NOT NULL DEFAULT 30 CHECK (janela_dias BETWEEN 1 AND 365),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financeiro_config_aprovacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "membros leem config de aprovacao" ON public.financeiro_config_aprovacao;
CREATE POLICY "membros leem config de aprovacao" ON public.financeiro_config_aprovacao
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "admin cria config de aprovacao" ON public.financeiro_config_aprovacao;
CREATE POLICY "admin cria config de aprovacao" ON public.financeiro_config_aprovacao
  FOR INSERT WITH CHECK (public.is_empresa_admin(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "admin altera config de aprovacao" ON public.financeiro_config_aprovacao;
CREATE POLICY "admin altera config de aprovacao" ON public.financeiro_config_aprovacao
  FOR UPDATE USING (public.is_empresa_admin(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "admin apaga config de aprovacao" ON public.financeiro_config_aprovacao;
CREATE POLICY "admin apaga config de aprovacao" ON public.financeiro_config_aprovacao
  FOR DELETE USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- 3) Trilha de auditoria ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.financeiro_aprovacoes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  lancamento_id uuid REFERENCES public.financeiro_lancamentos(id) ON DELETE SET NULL,
  acao text NOT NULL CHECK (acao IN ('aprovado','rejeitado')),
  valor numeric NOT NULL,
  descricao text,
  motivo text,
  usuario_id uuid NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financeiro_aprovacoes_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "membros leem trilha de aprovacao" ON public.financeiro_aprovacoes_log;
CREATE POLICY "membros leem trilha de aprovacao" ON public.financeiro_aprovacoes_log
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));
-- Escrita só pela RPC (SECURITY DEFINER) — nenhuma policy de INSERT/UPDATE/DELETE.

-- 4) A decisão, com alçada verificada no servidor -----------------------------
CREATE OR REPLACE FUNCTION public.aprovar_pagamento(
  p_lancamento_id uuid,
  p_acao text,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_l record;
  v_cfg record;
  v_is_admin boolean;
  v_is_fin boolean;
BEGIN
  IF p_acao NOT IN ('aprovar','rejeitar') THEN
    RAISE EXCEPTION 'Ação inválida.';
  END IF;

  SELECT id, empresa_id, tipo, status, valor, descricao, aprovacao_status
    INTO v_l FROM public.financeiro_lancamentos WHERE id = p_lancamento_id;
  IF v_l.id IS NULL THEN RAISE EXCEPTION 'Lançamento não encontrado.'; END IF;
  IF v_l.tipo <> 'a_pagar' THEN RAISE EXCEPTION 'Só contas a PAGAR passam pelo workflow de aprovação.'; END IF;
  IF v_l.status IN ('realizado','conciliado','cancelado') THEN
    RAISE EXCEPTION 'Lançamento % já não aguarda aprovação.', v_l.status;
  END IF;

  SELECT ativo, limite_admin INTO v_cfg
    FROM public.financeiro_config_aprovacao WHERE empresa_id = v_l.empresa_id;
  IF v_cfg IS NULL OR NOT v_cfg.ativo THEN
    RAISE EXCEPTION 'O workflow de aprovação não está ativo para esta empresa.';
  END IF;

  v_is_admin := public.is_empresa_admin(auth.uid(), v_l.empresa_id);
  v_is_fin := EXISTS (
    SELECT 1 FROM public.empresa_membros m
     WHERE m.empresa_id = v_l.empresa_id AND m.user_id = auth.uid() AND m.equipe = 'financeiro'
  );
  IF NOT (v_is_admin OR (v_is_fin AND v_l.valor <= v_cfg.limite_admin)) THEN
    RAISE EXCEPTION 'Alçada insuficiente: acima de % só o administrador da empresa aprova.',
      to_char(v_cfg.limite_admin, 'FM999G999G990D00');
  END IF;

  IF p_acao = 'rejeitar' AND (p_motivo IS NULL OR length(trim(p_motivo)) < 4) THEN
    RAISE EXCEPTION 'Rejeição exige motivo — é ele que orienta a revisão.';
  END IF;

  UPDATE public.financeiro_lancamentos SET
    aprovacao_status = CASE WHEN p_acao = 'aprovar' THEN 'aprovado' ELSE 'rejeitado' END,
    aprovado_por = auth.uid(),
    aprovado_em = now(),
    aprovacao_valor = CASE WHEN p_acao = 'aprovar' THEN valor ELSE aprovacao_valor END,
    aprovacao_motivo = CASE WHEN p_acao = 'aprovar' THEN NULL ELSE p_motivo END
  WHERE id = p_lancamento_id;

  INSERT INTO public.financeiro_aprovacoes_log
    (empresa_id, lancamento_id, acao, valor, descricao, motivo, usuario_id)
  VALUES
    (v_l.empresa_id, v_l.id,
     CASE WHEN p_acao = 'aprovar' THEN 'aprovado' ELSE 'rejeitado' END,
     v_l.valor, v_l.descricao, p_motivo, auth.uid());

  RETURN jsonb_build_object('ok', true, 'acao', p_acao, 'valor', v_l.valor);
END;
$$;

GRANT EXECUTE ON FUNCTION public.aprovar_pagamento(uuid, text, text) TO authenticated;

-- 5) Enforcement + revalidação ------------------------------------------------
CREATE OR REPLACE FUNCTION public.exigir_aprovacao_pagamento()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ativo boolean;
BEGIN
  IF NEW.tipo <> 'a_pagar' THEN RETURN NEW; END IF;

  SELECT ativo INTO v_ativo
    FROM public.financeiro_config_aprovacao WHERE empresa_id = NEW.empresa_id;
  IF NOT COALESCE(v_ativo, false) THEN RETURN NEW; END IF;

  -- Valor mudou depois de aprovado → volta para a fila (o valor é congelado
  -- na aprovação exatamente para pegar edição posterior).
  IF OLD.aprovacao_status = 'aprovado'
     AND NEW.valor IS DISTINCT FROM OLD.valor THEN
    NEW.aprovacao_status := 'pendente';
    NEW.aprovado_por := NULL;
    NEW.aprovado_em := NULL;
    NEW.aprovacao_motivo := 'Valor alterado após a aprovação — reaprovação necessária.';
  END IF;

  -- A baixa manual exige aprovação. Conciliado passa: o extrato provou que o
  -- dinheiro saiu, e registrar o fato não é autorizá-lo.
  IF NEW.status = 'realizado'
     AND OLD.status IS DISTINCT FROM 'realizado'
     AND COALESCE(NEW.aprovacao_status, '') <> 'aprovado' THEN
    RAISE EXCEPTION 'Pagamento sem aprovação: o workflow de alçada está ativo. Aprove em Financeiro › Aprovação de Pagamentos antes da baixa.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exigir_aprovacao_pagamento ON public.financeiro_lancamentos;
CREATE TRIGGER trg_exigir_aprovacao_pagamento
  BEFORE UPDATE ON public.financeiro_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.exigir_aprovacao_pagamento();

NOTIFY pgrst, 'reload schema';
