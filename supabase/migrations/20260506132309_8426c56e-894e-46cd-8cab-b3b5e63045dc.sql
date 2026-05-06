-- Substituir constraint UNIQUE rígida por uma que reflete a realidade contábil:
-- Uma empresa pode ter múltiplas APLICAÇÕES FINANCEIRAS (CDB, LCI, LCA, Fundos, Poupança)
-- vinculadas à mesma conta-corrente bancária (mesmo banco/agência/conta).
-- Cada aplicação é um ATIVO FINANCEIRO DISTINTO (NBC TG 26 / CPC 03).
-- A unicidade deve considerar também o TIPO e o NOME identificador da aplicação.

ALTER TABLE public.financeiro_contas
  DROP CONSTRAINT IF EXISTS financeiro_contas_empresa_id_banco_codigo_agencia_conta_key;

-- Nova unicidade: (empresa, banco, agencia, conta, tipo, nome)
-- Permite: CC + Aplicação CDB + Aplicação LCI + Poupança no mesmo banco/agência/conta
-- Bloqueia: duplicar exatamente a mesma conta com mesmo nome
CREATE UNIQUE INDEX IF NOT EXISTS financeiro_contas_unica_por_aplicacao
  ON public.financeiro_contas (
    empresa_id,
    COALESCE(banco_codigo, ''),
    COALESCE(agencia, ''),
    COALESCE(conta, ''),
    tipo,
    lower(nome)
  );

-- Índice auxiliar para consulta rápida de aplicações vinculadas a uma CC principal
CREATE INDEX IF NOT EXISTS idx_financeiro_contas_vinculada
  ON public.financeiro_contas (conta_vinculada_id)
  WHERE conta_vinculada_id IS NOT NULL;

COMMENT ON COLUMN public.financeiro_contas.conta_vinculada_id IS
  'Conta-corrente principal à qual esta aplicação financeira está vinculada (CDB/LCI/LCA/Fundo/Poupança rentabilizam o caixa da CC origem).';