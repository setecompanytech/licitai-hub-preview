-- =============================================================================
-- MIGRATION: Metas do Comercial — Fase C (insumos do motor de projecao)
-- Data: 2026-08-03
-- Objetivo: dar ao motor os dois insumos que faltavam — o calendario de dias
--           uteis e os padroes de conversao usados quando nao ha historico.
--
-- Decisao (6): dias uteis = seg-sex menos as datas de comercial_feriados.
-- Com a tabela vazia o motor se comporta como "so seg-sex", entao nada quebra
-- enquanto o admin nao cadastrar feriado nenhum.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Calendario de feriados, alimentado pelo admin
--    Por empresa: filial em outro municipio tem feriado municipal diferente.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comercial_feriados (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  data       date NOT NULL,
  descricao  text NOT NULL,
  -- 'nacional' | 'estadual' | 'municipal' | 'ponto_facultativo' | 'outro'
  abrangencia text NOT NULL DEFAULT 'nacional',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comercial_feriados_data_unica UNIQUE (empresa_id, data)
);

CREATE INDEX IF NOT EXISTS idx_comercial_feriados_periodo
  ON public.comercial_feriados (empresa_id, data);

COMMENT ON TABLE public.comercial_feriados IS
  'Datas descontadas do calculo de dias uteis do modulo de metas. Vazia, o '
  'motor considera apenas segunda a sexta.';

ALTER TABLE public.comercial_feriados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comercial_feriados_select" ON public.comercial_feriados;
CREATE POLICY "comercial_feriados_select" ON public.comercial_feriados FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_feriados_insert" ON public.comercial_feriados;
CREATE POLICY "comercial_feriados_insert" ON public.comercial_feriados FOR INSERT
  WITH CHECK (public.is_empresa_admin(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_feriados_update" ON public.comercial_feriados;
CREATE POLICY "comercial_feriados_update" ON public.comercial_feriados FOR UPDATE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_feriados_delete" ON public.comercial_feriados;
CREATE POLICY "comercial_feriados_delete" ON public.comercial_feriados FOR DELETE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- -----------------------------------------------------------------------------
-- 2. Padroes conservadores de conversao
--    Usados quando o colaborador ainda nao tem historico. Ficam na
--    configuracao pelo mesmo motivo dos valores-alvo: nao virar constante no
--    codigo do motor.
-- -----------------------------------------------------------------------------
ALTER TABLE public.comercial_metas_config
  ADD COLUMN IF NOT EXISTS tx_ganho_padrao numeric(5,4) NOT NULL DEFAULT 0.2000
    CHECK (tx_ganho_padrao > 0 AND tx_ganho_padrao <= 1),
  ADD COLUMN IF NOT EXISTS tx_faturamento_padrao numeric(5,4) NOT NULL DEFAULT 0.7000
    CHECK (tx_faturamento_padrao > 0 AND tx_faturamento_padrao <= 1),
  -- Anos de historico exigidos para confiar no indice de sazonalidade
  ADD COLUMN IF NOT EXISTS min_anos_sazonalidade int NOT NULL DEFAULT 2
    CHECK (min_anos_sazonalidade >= 1);

COMMENT ON COLUMN public.comercial_metas_config.tx_ganho_padrao IS
  'Conversao participado -> ganho assumida quando falta historico. '
  'Conservadora de proposito: quanto menor, mais processos o motor exige.';
COMMENT ON COLUMN public.comercial_metas_config.tx_faturamento_padrao IS
  'Fracao do valor contratado que vira pedido faturado, assumida quando falta historico.';
