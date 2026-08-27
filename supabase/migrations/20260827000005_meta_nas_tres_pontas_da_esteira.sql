-- ═══════════════════════════════════════════════════════════════════════════
-- A meta passa a olhar as três pontas da esteira, não uma de cada vez
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `comercial_metas` guardava UM valor em reais (`meta_faturamento`) e uma
-- ESCOLHA (`base_meta`) de contra o quê compará-lo: contratos ganhos,
-- faturamento ou NF-e quitada.
--
-- Só que essas três não são formas diferentes de medir a mesma coisa. São três
-- MOMENTOS do mesmo dinheiro:
--
--   contrato ganho  →  o negócio fechou   (valor assinado)
--   faturamento     →  a nota saiu        (pedido faturado)
--   NF-e quitada    →  o dinheiro entrou  (valor recebido)
--
-- Um contrato assinado em março vira faturamento em maio e quitação em julho.
-- Escolher uma base é escolher em que ponto da esteira olhar — e olhar um
-- ponto só esconde onde ela travou.
--
-- Um vendedor pode estar com contratos em dia e quitação a zero: fechou
-- negócio, não entregou. Outro pode ter faturamento alto e quitação baixa:
-- entregou, não recebeu. Com uma base só, o painel mostra um desses como
-- "meta batida" e o outro como "risco crítico" — dependendo apenas de qual
-- base o administrador escolheu, não do que aconteceu.
--
-- ── O que muda ──────────────────────────────────────────────────────────────
-- Entra `meta_quitacao`. `meta_faturamento` e `meta_contratos` já existiam —
-- a segunda, aliás, existia e NUNCA foi exibida no painel.
--
-- `base_meta` não some: passa a significar META PRINCIPAL — a que dispara o
-- alerta de risco e alimenta a projeção de fechamento. As outras duas ficam
-- visíveis como acompanhamento. Assim quem já usa não vê comportamento mudar,
-- e ganha as outras duas de graça.

ALTER TABLE public.comercial_metas
  ADD COLUMN IF NOT EXISTS meta_quitacao numeric(14,2);

COMMENT ON COLUMN public.comercial_metas.meta_faturamento IS
  'Meta de faturamento do mês, em reais — soma dos pedidos faturados '
  '(contrato_pedidos.data_pedido). É a ponta do meio da esteira: a nota saiu, '
  'o dinheiro ainda não entrou.';

COMMENT ON COLUMN public.comercial_metas.meta_quitacao IS
  'Meta de NF-e quitada do mês, em reais — soma dos pedidos com data_quitacao. '
  'É a última ponta da esteira, a única que representa dinheiro em caixa. '
  'Nula significa que não foi definida, não que é zero.';

COMMENT ON COLUMN public.comercial_metas.meta_contratos IS
  'Meta de contratos ganhos no mês, em quantidade. Primeira ponta da esteira: '
  'o negócio fechou, e vira faturamento nos meses seguintes. Existia desde o '
  'início e nunca foi exibida no painel.';

COMMENT ON COLUMN public.comercial_metas.meta_participacoes IS
  'Meta de propostas enviadas no mês, em quantidade. É o ANTES da esteira — '
  'o esforço que produz os contratos.';

COMMENT ON COLUMN public.comercial_metas.base_meta IS
  'A meta PRINCIPAL: qual das três dispara o alerta de risco e alimenta a '
  'projeção de fechamento. Valores: contratos_ganhos, faturamento, nf_quitada. '
  'As outras duas continuam medidas e exibidas — a principal é a que manda no '
  'alarme, para o painel não gritar três vezes pelo mesmo mês.';

-- ── Coerência: a meta principal precisa ter valor ───────────────────────────
-- Eleger como principal uma meta que ninguém definiu produz alerta sobre o
-- nada — "0% de uma meta de R$ 0,00" — que é pior do que não alertar.
ALTER TABLE public.comercial_metas
  DROP CONSTRAINT IF EXISTS chk_meta_principal_tem_valor;
ALTER TABLE public.comercial_metas
  ADD CONSTRAINT chk_meta_principal_tem_valor
  CHECK (
    (base_meta = 'faturamento'      AND COALESCE(meta_faturamento, 0) > 0)
    OR (base_meta = 'nf_quitada'      AND COALESCE(meta_quitacao, 0) > 0)
    OR (base_meta = 'contratos_ganhos' AND COALESCE(meta_contratos, 0) > 0)
  ) NOT VALID;

COMMENT ON CONSTRAINT chk_meta_principal_tem_valor ON public.comercial_metas IS
  'A meta eleita como principal precisa ter valor. Sem isto, o painel alerta '
  'sobre "0% de uma meta de R$ 0,00" — barulho que ensina a ignorar o alarme.';

-- ── Migração do que já existe ───────────────────────────────────────────────
-- Quem tinha `base_meta = nf_quitada` guardava o alvo em `meta_faturamento`,
-- porque era a única coluna de valor. Esse número é meta de QUITAÇÃO, e é para
-- lá que ele vai. `meta_faturamento` fica com o mesmo valor: sem outra
-- informação, faturar o que se pretende receber é a leitura conservadora — e o
-- administrador ajusta quando abrir a tela.
UPDATE public.comercial_metas
   SET meta_quitacao = meta_faturamento
 WHERE base_meta = 'nf_quitada'
   AND meta_quitacao IS NULL;

-- ── Conferência ─────────────────────────────────────────────────────────────
--   SELECT base_meta, count(*),
--          count(meta_faturamento) AS com_faturamento,
--          count(meta_quitacao)    AS com_quitacao,
--          count(meta_contratos)   AS com_contratos
--     FROM public.comercial_metas GROUP BY 1 ORDER BY 1;
--
-- Depois de as três estarem preenchidas onde precisam:
--   ALTER TABLE public.comercial_metas VALIDATE CONSTRAINT chk_meta_principal_tem_valor;
