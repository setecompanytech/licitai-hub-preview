-- =============================================================================
-- Praefectus — bloco único das 4 migrations pendentes (2026-08-18)
-- Projeto: uwtyuwktxalnpgrcbbgk — CONFIRA A URL ANTES DE EXECUTAR
-- Idempotente: pode ser colado mesmo que parte já tenha sido aplicada.
-- Rationale completo em supabase/migrations/ e SQL_MIGRATIONS.md
-- =============================================================================
BEGIN;

-- ── 20260817000001 — bonificação: tipos por faturamento e por NF-e quitada ───
ALTER TABLE public.comissoes_config
  DROP CONSTRAINT IF EXISTS comissoes_config_tipo_comissao_check;
ALTER TABLE public.comissoes_config
  ADD CONSTRAINT comissoes_config_tipo_comissao_check
  CHECK (tipo_comissao IN (
    'percentual_contrato', 'percentual_lucro', 'percentual_faturamento',
    'percentual_nf_quitada', 'valor_fixo', 'nota_fiscal'));

COMMENT ON COLUMN public.comissoes_config.tipo_comissao IS
  'Base de cálculo da bonificação. Tipos iniciados por "percentual" usam o '
  'campo percentual sobre a base correspondente; os demais usam valor_fixo. '
  'Espelho no front: src/lib/equipe/bonificacao.ts (autoridade única).';

-- ── 20260818000001 — só administrador troca o vendedor do contrato ───────────
CREATE OR REPLACE FUNCTION public.contratos_vendedor_somente_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NEW.vendedor_user_id IS DISTINCT FROM OLD.vendedor_user_id
     AND auth.uid() IS NOT NULL
     AND NOT public.is_empresa_admin(auth.uid(), NEW.empresa_id)
  THEN
    RAISE EXCEPTION
      'Somente o administrador da empresa pode alterar o vendedor responsável pelo contrato.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_contratos_vendedor_somente_admin ON public.contratos;
CREATE TRIGGER trg_contratos_vendedor_somente_admin
  BEFORE UPDATE ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.contratos_vendedor_somente_admin();

COMMENT ON COLUMN public.contratos.vendedor_user_id IS
  'Colaborador responsável pelo contrato: define a carteira que ele vê, a meta '
  'em que o contrato conta e quem recebe a bonificação. Só administrador altera '
  '(trigger trg_contratos_vendedor_somente_admin).';

-- ── 20260818000002 — meta medida sobre NF-e quitada ──────────────────────────
ALTER TABLE public.comercial_metas
  DROP CONSTRAINT IF EXISTS comercial_metas_base_meta_check;
ALTER TABLE public.comercial_metas
  ADD CONSTRAINT comercial_metas_base_meta_check
  CHECK (base_meta IN ('faturamento', 'nf_quitada', 'contratos_ganhos'));

COMMENT ON COLUMN public.comercial_metas.base_meta IS
  'Marco do ciclo comercial contra o qual a meta é comparada: contratos_ganhos '
  '(valor assinado), faturamento (nota emitida) ou nf_quitada (valor recebido). '
  'Espelho no front: BASES_META em src/lib/metas/painel.ts.';

-- ── 20260818000003 — quando a bonificação pode ser paga (política da empresa) ─
ALTER TABLE public.comissoes_config
  ADD COLUMN IF NOT EXISTS evento_pagamento text;

-- Config anterior a esta coluna herda o marco que o próprio tipo pressupõe:
-- nada muda de comportamento sem alguém decidir.
UPDATE public.comissoes_config
   SET evento_pagamento = CASE
         WHEN tipo_comissao IN ('percentual_nf_quitada', 'nota_fiscal') THEN 'nf_quitada'
         WHEN tipo_comissao = 'percentual_faturamento'                  THEN 'nota_emitida'
         ELSE 'contrato_assinado'
       END
 WHERE evento_pagamento IS NULL;

ALTER TABLE public.comissoes_config
  ALTER COLUMN evento_pagamento SET DEFAULT 'contrato_assinado';
ALTER TABLE public.comissoes_config
  DROP CONSTRAINT IF EXISTS comissoes_config_evento_pagamento_check;
ALTER TABLE public.comissoes_config
  ADD CONSTRAINT comissoes_config_evento_pagamento_check
  CHECK (evento_pagamento IN ('contrato_assinado', 'nota_emitida', 'nf_quitada'));

COMMENT ON COLUMN public.comissoes_config.evento_pagamento IS
  'Marco a partir do qual a bonificação pode ser paga: contrato_assinado, '
  'nota_emitida ou nf_quitada. Política da empresa, não do produto. Distinto '
  'de tipo_comissao, que define a BASE do cálculo. Espelho no front: '
  'EVENTOS_PAGAMENTO em src/lib/equipe/bonificacao.ts.';

CREATE OR REPLACE FUNCTION public.bonificacao_paga_so_apos_quitacao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_evento text;
  v_ok     boolean;
BEGIN
  IF NEW.status <> 'pago' OR COALESCE(OLD.status, '') = 'pago' THEN
    RETURN NEW;
  END IF;

  SELECT evento_pagamento INTO v_evento
    FROM public.comissoes_config
   WHERE empresa_id = NEW.empresa_id AND user_id = NEW.user_id AND ativo IS TRUE
   LIMIT 1;

  -- Empresa sem política declarada não é barrada por uma política inventada.
  IF v_evento IS NULL THEN
    RETURN NEW;
  END IF;

  v_ok := CASE v_evento
    WHEN 'nf_quitada' THEN EXISTS (
      SELECT 1 FROM public.contrato_pedidos cp
       WHERE cp.id = NEW.contrato_pedido_id AND cp.nf_quitada IS TRUE)
    WHEN 'nota_emitida' THEN EXISTS (
      SELECT 1 FROM public.contrato_pedidos cp
       WHERE cp.id = NEW.contrato_pedido_id AND cp.nota_fiscal IS NOT NULL)
    WHEN 'contrato_assinado' THEN EXISTS (
      SELECT 1 FROM public.contratos c
       WHERE c.data_assinatura IS NOT NULL
         AND (c.id = NEW.contrato_id
              OR c.id = (SELECT cp.contrato_id FROM public.contrato_pedidos cp
                          WHERE cp.id = NEW.contrato_pedido_id)))
    ELSE true
  END;

  IF NOT v_ok THEN
    RAISE EXCEPTION
      'Bonificação só pode ser paga a partir do marco configurado para este colaborador (%). Vincule o lançamento ao contrato ou pedido correspondente.',
      v_evento USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_bonificacao_paga_so_apos_quitacao ON public.comissoes_lancamentos;
CREATE TRIGGER trg_bonificacao_paga_so_apos_quitacao
  BEFORE UPDATE ON public.comissoes_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.bonificacao_paga_so_apos_quitacao();

COMMENT ON COLUMN public.comissoes_lancamentos.contrato_pedido_id IS
  'Pedido que comprova o marco de pagamento (nota emitida ou NF-e quitada), '
  'conforme comissoes_config.evento_pagamento do colaborador.';

COMMIT;

-- ── Conferência: as quatro devem dizer "aplicada" ────────────────────────────
select 'tipos de bonificação (20260817000001)' as migration,
       case when exists (select 1 from pg_constraint
              where conname = 'comissoes_config_tipo_comissao_check'
                and pg_get_constraintdef(oid) like '%percentual_nf_quitada%')
            then 'aplicada' else 'PENDENTE' end as status
union all
select 'vendedor só admin (20260818000001)',
       case when exists (select 1 from pg_trigger
              where tgname = 'trg_contratos_vendedor_somente_admin')
            then 'aplicada' else 'PENDENTE' end
union all
select 'meta sobre NF-e quitada (20260818000002)',
       case when exists (select 1 from pg_constraint
              where conname = 'comercial_metas_base_meta_check'
                and pg_get_constraintdef(oid) like '%nf_quitada%')
            then 'aplicada' else 'PENDENTE' end
union all
select 'marco de pagamento (20260818000003)',
       case when exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'comissoes_config'
                and column_name = 'evento_pagamento')
            then 'aplicada' else 'PENDENTE' end;
