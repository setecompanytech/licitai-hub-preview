-- ============================================================================
-- Fase B — margem alvo por empresa (precificação assistida na entrada)
-- ============================================================================
-- Percentual TRANSCRITO pelo usuário (convenção 0–100, como alíquota — ver
-- CLAUDE.md/Percentuais), usado para sugerir preço de venda na entrada da
-- NF-e: preço = custo ÷ (1 − (tributos% + despesas% + margem_alvo%)/100).
-- Padrão 10% — herda o que a Calculadora de Margem usa como ponto de partida;
-- cada empresa ajusta o seu (princípio 7: política de cliente é configuração).
ALTER TABLE public.financeiro_config_custos
  ADD COLUMN IF NOT EXISTS margem_alvo numeric NOT NULL DEFAULT 10
  CHECK (margem_alvo >= 0 AND margem_alvo <= 90);

COMMENT ON COLUMN public.financeiro_config_custos.margem_alvo IS
  'Margem líquida alvo (% 0-100, transcrita) para o preço sugerido na entrada de NF-e.';

NOTIFY pgrst, 'reload schema';
