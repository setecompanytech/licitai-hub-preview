-- =============================================================================
-- Como a ATA de Registro de Preços será executada: contrato ou empenho
--
-- A Lei 14.133/2021, art. 95, permite substituir o termo de contrato por nota de
-- empenho — mas só em duas hipóteses: entrega imediata e integral, sem qualquer
-- obrigação futura; ou valor dentro do limite de dispensa por valor.
--
-- Fora disso, execução parcelada ou serviço contínuo EXIGE contrato formal.
-- Usar só o empenho nesses casos é falha grave do processo administrativo — e é
-- exatamente o caso que o sistema não tinha como perceber, porque a forma de
-- execução nunca foi declarada: pedidos simplesmente penduravam na linha de
-- `contratos`, fosse ela ATA ou contrato.
--
-- Declarada a forma, a tela passa a avisar quando o uso contradiz a hipótese:
-- vários pedidos numa ATA declarada como entrega imediata e integral.
--
-- Nulo em registro antigo, de propósito: ninguém declarou nada até aqui, e
-- inferir a hipótese a partir do que já existe seria adivinhar sobre a
-- regularidade de um processo alheio.
-- =============================================================================

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS forma_execucao text,
  ADD COLUMN IF NOT EXISTS art95_fundamento text;

ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS contratos_forma_execucao_check;

ALTER TABLE public.contratos
  ADD CONSTRAINT contratos_forma_execucao_check
  CHECK (forma_execucao IS NULL OR forma_execucao IN ('contrato_formal', 'empenho'));

ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS contratos_art95_fundamento_check;

ALTER TABLE public.contratos
  ADD CONSTRAINT contratos_art95_fundamento_check
  CHECK (art95_fundamento IS NULL OR art95_fundamento IN ('entrega_imediata', 'valor_dispensa'));

-- Fundamento só faz sentido quando a execução dispensa o contrato. Guardar um
-- sem o outro deixaria o registro afirmando meia coisa.
ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS contratos_art95_coerente;

ALTER TABLE public.contratos
  ADD CONSTRAINT contratos_art95_coerente
  CHECK (art95_fundamento IS NULL OR forma_execucao = 'empenho');

COMMENT ON COLUMN public.contratos.forma_execucao IS
  'Como a ATA será executada: contrato_formal (termo de contrato) ou empenho '
  '(nota de empenho substituindo o contrato, Lei 14.133/2021 art. 95). Nulo em '
  'registro anterior a 19/08/2026, e em contratos — onde o termo é o próprio '
  'instrumento. Espelho no front: FORMAS_EXECUCAO em src/lib/contratos/instrumentos.ts.';

COMMENT ON COLUMN public.contratos.art95_fundamento IS
  'Hipótese que dispensa o contrato: entrega_imediata (entrega integral, sem '
  'obrigação futura) ou valor_dispensa (dentro do limite de dispensa por valor). '
  'Só existe quando forma_execucao = empenho.';
