-- ═══════════════════════════════════════════════════════════════════════════
-- Invariantes do Financeiro — o banco passa a recusar o impossível
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A auditoria de 25/08 mostrou que o banco aceitava tudo o que lhe davam:
-- transferência de R$ 300.000 saindo de uma conta com R$ 39,75, conta de
-- aplicação com saldo negativo, coluna numeric(5,4) com DEFAULT 15 que não
-- comportava o próprio padrão, vencimento em 2031, e uma tabela de
-- configuração vazia por quatro meses sem que nada estranhasse.
--
-- Sem invariante, o sistema não distingue erro de digitação de fato — trata os
-- dois com a mesma seriedade, e é por isso que um campo errado contamina sete
-- camadas a jusante. O banco é a última instância que pode dizer "esse estado
-- não existe no mundo".
--
-- ── Por que NOT VALID ───────────────────────────────────────────────────────
-- Todas as restrições entram como NOT VALID: passam a valer para toda linha
-- nova ou alterada, e NÃO rejeitam o que já está gravado. É deliberado. Há
-- dado torto na base agora (os oito pares de PIX com origem errada, entre
-- outros), e barrar a migration por causa dele adiaria a proteção de tudo o
-- que vier depois. Corrigido o passado, cada uma vira VALID com um comando —
-- o roteiro está no fim do arquivo.

-- ── 1. Transferência sem destino não é transferência ────────────────────────
-- Uma transferência é uma relação entre DUAS contas. Sem a segunda, o saldo
-- não tem para onde ir e o dinheiro some da soma da empresa.
ALTER TABLE public.financeiro_lancamentos
  DROP CONSTRAINT IF EXISTS chk_transferencia_tem_destino;
ALTER TABLE public.financeiro_lancamentos
  ADD CONSTRAINT chk_transferencia_tem_destino
  CHECK (tipo <> 'transferencia' OR conta_destino_id IS NOT NULL) NOT VALID;

-- ── 2. conta_destino_id só existe em transferência ──────────────────────────
-- Este é o defeito nº 2 da fórmula do saldo, agora barrado na entrada: um
-- a_receber com conta_destino_id preenchido era somado nas DUAS contas, porque
-- a seleção era (conta_id = X OR conta_destino_id = X). A fórmula foi
-- corrigida; a restrição impede que o caso volte a existir.
ALTER TABLE public.financeiro_lancamentos
  DROP CONSTRAINT IF EXISTS chk_destino_so_em_transferencia;
ALTER TABLE public.financeiro_lancamentos
  ADD CONSTRAINT chk_destino_so_em_transferencia
  CHECK (tipo = 'transferencia' OR conta_destino_id IS NULL) NOT VALID;

-- ── 3. Transferência entre a mesma conta é ruído ────────────────────────────
-- Origem igual a destino não move dinheiro. Aparece quando alguém escolhe a
-- conta errada no segundo campo e não percebe, e depois aparece no extrato
-- como um par que não faz nada.
ALTER TABLE public.financeiro_lancamentos
  DROP CONSTRAINT IF EXISTS chk_transferencia_contas_distintas;
ALTER TABLE public.financeiro_lancamentos
  ADD CONSTRAINT chk_transferencia_contas_distintas
  CHECK (conta_destino_id IS NULL OR conta_id IS DISTINCT FROM conta_destino_id) NOT VALID;

-- ── 4. Lançamento realizado tem data de realização ──────────────────────────
-- "Realizado" e "conciliado" afirmam que o dinheiro se moveu. Sem a data, não
-- há como situar o movimento no tempo — e é a data que decide competência,
-- apuração e indicador.
ALTER TABLE public.financeiro_lancamentos
  DROP CONSTRAINT IF EXISTS chk_realizado_tem_data;
ALTER TABLE public.financeiro_lancamentos
  ADD CONSTRAINT chk_realizado_tem_data
  CHECK (status NOT IN ('realizado','conciliado') OR data_realizado IS NOT NULL) NOT VALID;

-- ── 5. Vencimento plausível ─────────────────────────────────────────────────
-- A ETHOS tem 154 contas a pagar previstas com vencimento até 10/08/2031.
-- Contrato administrativo de dez anos existe (Lei 14.133, art. 108), então a
-- faixa é generosa DE PROPÓSITO: quinze anos à frente da competência e cinco
-- atrás. Não é para julgar prazo de contrato — é para pegar o dedo que
-- escorregou no ano.
ALTER TABLE public.financeiro_lancamentos
  DROP CONSTRAINT IF EXISTS chk_vencimento_plausivel;
ALTER TABLE public.financeiro_lancamentos
  ADD CONSTRAINT chk_vencimento_plausivel
  CHECK (
    data_vencimento IS NULL
    OR data_competencia IS NULL
    OR (data_vencimento >= data_competencia - interval '5 years'
    AND  data_vencimento <= data_competencia + interval '15 years')
  ) NOT VALID;

-- ── 6. Competência dentro do tempo do sistema ───────────────────────────────
-- Ano digitado errado é o erro de teclado mais comum em data. 1900 e 2199 não
-- são competências de ninguém.
ALTER TABLE public.financeiro_lancamentos
  DROP CONSTRAINT IF EXISTS chk_competencia_plausivel;
ALTER TABLE public.financeiro_lancamentos
  ADD CONSTRAINT chk_competencia_plausivel
  CHECK (data_competencia IS NULL
      OR (data_competencia >= DATE '2000-01-01' AND data_competencia <= DATE '2100-01-01')) NOT VALID;

-- ── 7. Saldo de abertura de conta não é nulo por omissão ────────────────────
-- `saldo_inicial` NULL e `saldo_inicial` zero significam coisas diferentes na
-- cabeça de quem cadastra — "ainda não informei" e "abriu zerada" — mas a
-- fórmula do saldo trata as duas como zero, via COALESCE. A coluna passa a ter
-- padrão explícito para que a ausência seja uma escolha registrada.
ALTER TABLE public.financeiro_contas
  ALTER COLUMN saldo_inicial SET DEFAULT 0;

COMMENT ON COLUMN public.financeiro_contas.saldo_inicial IS
  'Saldo da conta na data de abertura no sistema. Zero significa "abriu '
  'zerada", e é o padrão. A fórmula do saldo soma este valor aos movimentos — '
  'saldo de abertura não informado produz conta com saldo negativo sem que '
  'haja erro de lançamento algum.';

COMMENT ON CONSTRAINT chk_destino_so_em_transferencia ON public.financeiro_lancamentos IS
  'conta_destino_id fora de transferência fazia o lançamento somar nas duas '
  'contas, porque financeiro_recalcular_saldo_conta seleciona por '
  '(conta_id = X OR conta_destino_id = X).';

-- ── Roteiro para validar o passado ──────────────────────────────────────────
--
-- Cada consulta abaixo lista o que impede a restrição de virar VALID. Rode,
-- corrija o que aparecer, e então promova a restrição.
--
-- 1. Transferência sem destino:
--    SELECT id, data_competencia, valor, descricao FROM public.financeiro_lancamentos
--     WHERE tipo = 'transferencia' AND conta_destino_id IS NULL;
--
-- 2. Destino fora de transferência:
--    SELECT id, tipo, data_competencia, valor, descricao FROM public.financeiro_lancamentos
--     WHERE tipo <> 'transferencia' AND conta_destino_id IS NOT NULL;
--
-- 3. Origem igual a destino:
--    SELECT id, data_competencia, valor, descricao FROM public.financeiro_lancamentos
--     WHERE conta_id IS NOT DISTINCT FROM conta_destino_id AND conta_destino_id IS NOT NULL;
--
-- 4. Realizado sem data:
--    SELECT id, status, data_competencia, valor, descricao FROM public.financeiro_lancamentos
--     WHERE status IN ('realizado','conciliado') AND data_realizado IS NULL;
--
-- 5/6. Datas implausíveis:
--    SELECT id, data_competencia, data_vencimento, valor, descricao
--      FROM public.financeiro_lancamentos
--     WHERE data_vencimento > data_competencia + interval '15 years'
--        OR data_vencimento < data_competencia - interval '5 years'
--        OR data_competencia NOT BETWEEN DATE '2000-01-01' AND DATE '2100-01-01';
--
-- Depois de zerar cada lista:
--    ALTER TABLE public.financeiro_lancamentos VALIDATE CONSTRAINT chk_transferencia_tem_destino;
--    ALTER TABLE public.financeiro_lancamentos VALIDATE CONSTRAINT chk_destino_so_em_transferencia;
--    ALTER TABLE public.financeiro_lancamentos VALIDATE CONSTRAINT chk_transferencia_contas_distintas;
--    ALTER TABLE public.financeiro_lancamentos VALIDATE CONSTRAINT chk_realizado_tem_data;
--    ALTER TABLE public.financeiro_lancamentos VALIDATE CONSTRAINT chk_vencimento_plausivel;
--    ALTER TABLE public.financeiro_lancamentos VALIDATE CONSTRAINT chk_competencia_plausivel;
