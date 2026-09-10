-- ============================================================================
-- Cadastro de Condições de Pagamento (modelo dos emissores de mercado)
-- ============================================================================
--
-- A condição de pagamento deixa de ser lista fixa no código e vira CADASTRO
-- por empresa, no desenho clássico dos ERPs: código sequencial, descrição,
-- tipo (à vista / a prazo / parcelado), forma de pagamento, regra para
-- vencimento em fim de semana (prorroga/antecipa/mantém), parcelas como
-- pares {dias, percentual} cuja soma DEVE fechar 100% (CHECK no banco — a
-- tela avisa, o banco garante), dia fixo de vencimento opcional, juro
-- diário e percentual de acréscimo.

-- Postgres não aceita subquery em CHECK: a soma vive numa função IMMUTABLE.
CREATE OR REPLACE FUNCTION public.soma_percentuais_parcelas(p jsonb)
RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$
  SELECT COALESCE(SUM((e->>'percentual')::numeric), 0) FROM jsonb_array_elements(p) e;
$$;

CREATE TABLE IF NOT EXISTS public.financeiro_condicoes_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo integer NOT NULL,
  descricao text NOT NULL,
  tipo text NOT NULL DEFAULT 'a_vista' CHECK (tipo IN ('a_vista','a_prazo','parcelado')),
  forma_pagamento text,
  vencimento_sabado text NOT NULL DEFAULT 'prorroga' CHECK (vencimento_sabado IN ('prorroga','antecipa','mantem')),
  vencimento_domingo text NOT NULL DEFAULT 'prorroga' CHECK (vencimento_domingo IN ('prorroga','antecipa','mantem')),
  -- [{"dias": 30, "percentual": 50}, ...] — a soma dos percentuais é 100.
  parcelas jsonb NOT NULL DEFAULT '[{"dias": 0, "percentual": 100}]'::jsonb,
  dia_vencimento integer CHECK (dia_vencimento BETWEEN 1 AND 31),
  juro_diario numeric NOT NULL DEFAULT 0 CHECK (juro_diario >= 0),
  percentual_acrescimo numeric NOT NULL DEFAULT 0 CHECK (percentual_acrescimo >= 0),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo),
  -- "Condição de Pagamento incompleta, não atingiu 100%": aqui é CONSTRAINT.
  CONSTRAINT parcelas_fecham_100 CHECK (
    public.soma_percentuais_parcelas(parcelas) BETWEEN 99.99 AND 100.01
  )
);

ALTER TABLE public.financeiro_condicoes_pagamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "membros leem condicoes de pagamento" ON public.financeiro_condicoes_pagamento;
CREATE POLICY "membros leem condicoes de pagamento" ON public.financeiro_condicoes_pagamento
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "membros criam condicoes de pagamento" ON public.financeiro_condicoes_pagamento;
CREATE POLICY "membros criam condicoes de pagamento" ON public.financeiro_condicoes_pagamento
  FOR INSERT WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "membros alteram condicoes de pagamento" ON public.financeiro_condicoes_pagamento;
CREATE POLICY "membros alteram condicoes de pagamento" ON public.financeiro_condicoes_pagamento
  FOR UPDATE USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "admin apaga condicoes de pagamento" ON public.financeiro_condicoes_pagamento;
CREATE POLICY "admin apaga condicoes de pagamento" ON public.financeiro_condicoes_pagamento
  FOR DELETE USING (public.is_empresa_admin(auth.uid(), empresa_id));

NOTIFY pgrst, 'reload schema';
