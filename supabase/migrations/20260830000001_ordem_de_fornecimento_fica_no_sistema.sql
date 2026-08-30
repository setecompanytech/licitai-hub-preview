-- ═══════════════════════════════════════════════════════════════════════════
-- A Ordem de Fornecimento / Nota de Empenho fica no sistema
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O upload de pedido em Gestão de Contratos lê o PDF, manda o texto para a IA,
-- preenche o formulário — e **descarta o arquivo**. Nenhuma chamada a storage,
-- nenhum registro em `contrato_arquivos`.
--
-- É o mesmo defeito que o Financeiro tinha em 25/08 com a NF-e, e a
-- consequência é a mesma: o pedido existe e a AUTORIZAÇÃO dele não. Numa
-- divergência com o órgão sobre quantidade empenhada, é a nota de empenho que
-- se apresenta — e ela não está em lugar nenhum.
--
-- ── E o empenho não é objeto no sistema ─────────────────────────────────────
--
-- `contrato_pedidos` não guarda o número do empenho. Sem ele:
--
--   • não dá para saber quantos pedidos saíram do mesmo empenho;
--   • não dá para avisar quando a soma deles passa o valor empenhado;
--   • o controle de saldo é só contra o contrato inteiro, que é grosso demais
--     — um empenho estimativo de R$ 40 mil pode estourar sem que o contrato
--     de R$ 175 mil dê qualquer sinal.
--
-- O art. 60 da Lei 4.320/64 é claro: despesa não pode ser realizada sem prévio
-- empenho. Controlar consumo sem controlar empenho é controlar metade.

ALTER TABLE public.contrato_pedidos
  ADD COLUMN IF NOT EXISTS numero_empenho     text,
  ADD COLUMN IF NOT EXISTS tipo_empenho       text,
  ADD COLUMN IF NOT EXISTS valor_empenho      numeric(15,2),
  -- O PDF da Ordem/Empenho, guardado em `contrato_arquivos`.
  ADD COLUMN IF NOT EXISTS arquivo_ordem_id   uuid
    REFERENCES public.contrato_arquivos(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.contrato_pedidos.numero_empenho IS
  'Número da nota de empenho que autoriza este pedido (ex.: 2026NE003716). '
  'É por ele que se sabe quantos pedidos saíram do mesmo empenho e se a soma '
  'deles passou o valor empenhado.';

COMMENT ON COLUMN public.contrato_pedidos.tipo_empenho IS
  'ordinario | global | estimativo. Muda o que o saldo significa: no ordinário '
  'o valor é certo e único; no global é o teto de várias entregas; no '
  'estimativo é previsão, e ultrapassar exige reforço.';

COMMENT ON COLUMN public.contrato_pedidos.valor_empenho IS
  'Valor total empenhado no documento — não o do pedido. Um empenho global de '
  'R$ 40.000 pode gerar oito pedidos de R$ 5.000; é contra este número que a '
  'soma deles é conferida.';

COMMENT ON COLUMN public.contrato_pedidos.arquivo_ordem_id IS
  'O PDF da Ordem de Fornecimento ou Nota de Empenho, em contrato_arquivos. '
  'ON DELETE SET NULL: apagado o arquivo, o pedido continua — mas fica '
  'visível que a autorização saiu do sistema.';

ALTER TABLE public.contrato_pedidos
  DROP CONSTRAINT IF EXISTS chk_tipo_empenho;
ALTER TABLE public.contrato_pedidos
  ADD CONSTRAINT chk_tipo_empenho
  CHECK (tipo_empenho IS NULL OR tipo_empenho IN ('ordinario','global','estimativo'))
  NOT VALID;

CREATE INDEX IF NOT EXISTS idx_pedidos_empenho
  ON public.contrato_pedidos(contrato_id, numero_empenho)
  WHERE numero_empenho IS NOT NULL;

-- ── O tipo do arquivo ───────────────────────────────────────────────────────
-- `contrato_arquivos.tipo` é texto livre. Registrar o valor que a tela passa a
-- usar deixa claro para quem vier depois que "ordem_fornecimento" não é um
-- palpite de quem escreveu a tela.
COMMENT ON COLUMN public.contrato_arquivos.tipo IS
  'contrato | aditivo | ata | apostilamento | ordem_fornecimento | outro. '
  'ordem_fornecimento guarda a OF ou a nota de empenho que autoriza um pedido, '
  'ligada de volta por contrato_pedidos.arquivo_ordem_id.';

-- ── Conferência ─────────────────────────────────────────────────────────────
--
-- 1. Pedidos por empenho, com a soma contra o valor empenhado. Linha em que
--    `soma_dos_pedidos` passa `valor_empenho` é despesa sem cobertura:
--
--    SELECT c.numero_contrato, p.numero_empenho, p.tipo_empenho,
--           max(p.valor_empenho)  AS valor_empenho,
--           count(*)              AS pedidos,
--           SUM(p.valor_total)    AS soma_dos_pedidos
--      FROM public.contrato_pedidos p
--      JOIN public.contratos c ON c.id = p.contrato_id
--     WHERE p.numero_empenho IS NOT NULL
--       AND p.status <> 'cancelado'
--     GROUP BY 1, 2, 3
--     ORDER BY SUM(p.valor_total) - max(p.valor_empenho) DESC;
--
-- 2. Pedidos sem a Ordem guardada — os que não têm como provar a autorização:
--
--    SELECT c.numero_contrato, p.numero_pedido, p.data_pedido, p.valor_total
--      FROM public.contrato_pedidos p
--      JOIN public.contratos c ON c.id = p.contrato_id
--     WHERE p.arquivo_ordem_id IS NULL
--       AND p.status <> 'cancelado'
--     ORDER BY p.data_pedido DESC;
